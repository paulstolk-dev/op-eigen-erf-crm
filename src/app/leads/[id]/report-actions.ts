"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runReportGeneration, rerenderReportPdf } from "@/lib/generate-report-flow";
import { logLeadEmail } from "@/lib/hubspot";
import { reportBaseUrl } from "@/lib/erfcheck-report";
import { portalBaseUrl } from "@/lib/portaal-magic-link";
import type { Lead, Erfscan } from "@/lib/database.types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  return { supabase, user };
}

type Result = { ok: boolean; error?: string };

// Plain-text mailtekst → veilige HTML met klikbare links.
function toHtml(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const linked = esc.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#0a1b2b">$1</a>',
  );
  return linked
    .split("\n")
    .map((l) => l || "&nbsp;")
    .join("<br>");
}

/** Claude stelt het rapport op → branded PDF → Storage → status 'rendered'. */
export async function generateReport(leadId: string): Promise<Result> {
  await requireUser();
  try {
    const res = await runReportGeneration(leadId);
    if (res.ok) revalidatePath(`/leads/${leadId}`);
    return res;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Onbekende fout" };
  }
}

/** Alleen de PDF opnieuw renderen (geen LLM/kosten) — na een layout-wijziging. */
export async function rerenderReport(leadId: string): Promise<Result> {
  await requireUser();
  try {
    const res = await rerenderReportPdf(leadId);
    if (res.ok) revalidatePath(`/leads/${leadId}`);
    return res;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Onbekende fout" };
  }
}

/** Concept-mail aanpassingen opslaan. */
export async function saveDraft(leadId: string, subject: string, body: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("erfscans")
    .update({ draft_email_subject: subject, draft_email_body: body })
    .eq("lead_id", leadId);
  if (error) throw new Error(error.message);
  revalidatePath(`/leads/${leadId}`);
}

/** Concept + PDF versturen naar de lead via Resend → status 'sent'. */
export async function sendReport(leadId: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single<Lead>();
  const { data: erfscan } = await supabase
    .from("erfscans")
    .select("*")
    .eq("lead_id", leadId)
    .single<Erfscan>();

  // Test-modus: stuur alles naar REPORT_TEST_RECIPIENT i.p.v. de echte lead.
  const testTo = process.env.REPORT_TEST_RECIPIENT;
  const to = testTo || lead?.email;
  if (!to)
    return {
      ok: false,
      error: "Geen ontvanger (lead zonder e-mail en geen REPORT_TEST_RECIPIENT).",
    };
  if (!erfscan?.draft_email_body) return { ok: false, error: "Geen concept-mail." };
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY niet gezet." };

  // Klantgerichte Erf Check-pagina op opeigenerf.nl (/mijn/erf?erf=<token>): duurzaam
  // report_token, geen login, gebrand domein. Verpakt in de /l/<token>-klik-redirect
  // zodat de klik meetelt in de meetlaag. De /r/<token>-pagina op het CRM blijft als
  // interne/fallback-view bestaan.
  const token = lead!.report_token;
  const erfUrl = `${portalBaseUrl()}/mijn/erf?erf=${token}`;
  const pageUrl = token
    ? `${reportBaseUrl()}/l/${token}?${new URLSearchParams({
        u: Buffer.from(erfUrl, "utf8").toString("base64url"),
        l: "erfcheck-mijn-erf",
      }).toString()}`
    : erfUrl;
  const bodyText = erfscan.draft_email_body || "";
  // De mailtemplate bevat de erfcheck-link doorgaans al inline (de /l/-tracker naar
  // /mijn/erf); alleen als die ontbreekt plakken we er een knop onder (geen dubbele link).
  const heeftLink =
    bodyText.includes("/mijn/erf") ||
    (token ? bodyText.includes(`/l/${token}`) || bodyText.includes(`/r/${token}`) : false);
  const button = heeftLink
    ? ""
    : `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0"><tr><td style="border-radius:8px;background:#0a1b2b">
    <a href="${pageUrl}" style="display:inline-block;padding:12px 22px;color:#fff;font-weight:600;font-size:15px;text-decoration:none;border-radius:8px">Bekijk je Erf Check online »</a>
  </td></tr></table>`;
  const html = toHtml(bodyText) + button;
  const fromEmail = process.env.REPORT_FROM_EMAIL || "opeigenerf <info@opeigenerf.nl>";
  const cleanSubject = erfscan.draft_email_subject || "Je Erf Check van opeigenerf.nl";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      // BCC-kopie naar het archief-adres, behalve in testmodus (gaat toch al naar test-adres).
      ...(!testTo ? { bcc: process.env.REPORT_BCC || "info@opeigenerf.nl" } : {}),
      subject: (testTo ? `[TEST → ${lead?.email ?? "?"}] ` : "") + cleanSubject,
      html,
    }),
  });
  if (!res.ok) return { ok: false, error: `Resend: ${await res.text()}` };
  // Resend-email-id: koppelt de nurture-meetlaag aan de webhook-events (open/klik).
  const providerMessageId =
    ((await res.json().catch(() => null)) as { id?: string } | null)?.id ?? null;

  const sentAtIso = new Date().toISOString();

  // Verzonden Erf Check-mail op de HubSpot-tijdlijn loggen (best-effort, niet in
  // testmodus — dan gaat de mail immers naar het testadres, niet naar de lead).
  if (!testTo && lead?.email) {
    await logLeadEmail(leadId, {
      subject: cleanSubject,
      html,
      from: fromEmail,
      to: lead.email,
      sentAtIso,
    }).catch(() => {});
  }

  const admin = createAdminClient();
  await admin
    .from("erfscans")
    .update({ status: "sent", sent_at: sentAtIso })
    .eq("lead_id", leadId);

  // Meetlaag: de Erf Check-mail loggen (stroom 'erfcheck', geen flow-stap) zodat hij
  // én z'n opens/kliks via de Resend-webhook meetellen in de nurture-statistieken.
  // Best-effort en niet in testmodus (dan gaat de mail naar het testadres).
  if (!testTo && lead?.email && providerMessageId) {
    try {
      await (admin as any).rpc("nurture_log_message", {
        p_lead: leadId,
        p_step: null,
        p_to: lead.email,
        p_subject: cleanSubject,
        p_pmid: providerMessageId,
      });
    } catch {
      /* meetlaag-log mag de verzending nooit blokkeren */
    }
  }

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}
