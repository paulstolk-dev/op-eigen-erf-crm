import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadEmail } from "@/lib/hubspot";
import { reportBaseUrl } from "@/lib/erfcheck-report";
import { portalBaseUrl } from "@/lib/portaal-magic-link";
import type { Lead, Erfscan } from "@/lib/database.types";

// Verzendlogica van de Erf Check-mail, los van de UI-actie zodat zowel de knop
// op de leaddetail als de automatische generatie-route hem kan gebruiken.
// Draait op de admin-client: er is bij auto-verzenden geen ingelogde gebruiker.

export type SendReportResult = { ok: boolean; error?: string };

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

/**
 * Verstuurt de concept-mail van de erfcheck naar de lead en zet de erfscan op
 * 'sent'. Idempotentie-guard: is er al een sent_at, dan sturen we niets meer
 * (voorkomt dubbele mails bij een herhaalde trigger/retry).
 */
export async function verstuurErfcheckRapport(
  leadId: string,
): Promise<SendReportResult> {
  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single<Lead>();
  const { data: erfscan } = await admin
    .from("erfscans")
    .select("*")
    .eq("lead_id", leadId)
    .single<Erfscan>();

  if (erfscan?.sent_at) return { ok: false, error: "Rapport is al verstuurd." };

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
  // zodat de klik meetelt in de meetlaag.
  const token = lead!.report_token;
  const erfUrl = `${portalBaseUrl()}/mijn/erf?erf=${token}`;
  const pageUrl = token
    ? `${reportBaseUrl()}/l/${token}?${new URLSearchParams({
        u: Buffer.from(erfUrl, "utf8").toString("base64url"),
        l: "erfcheck-mijn-erf",
      }).toString()}`
    : erfUrl;
  const bodyText = erfscan.draft_email_body || "";
  // De mailtemplate bevat de erfcheck-link doorgaans al inline; alleen als die
  // ontbreekt plakken we er een knop onder (geen dubbele link).
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
      // BCC-kopie naar het archief-adres, behalve in testmodus.
      ...(!testTo ? { bcc: process.env.REPORT_BCC || "148836607@bcc.eu1.hubspot.com" } : {}),
      subject: (testTo ? `[TEST → ${lead?.email ?? "?"}] ` : "") + cleanSubject,
      html,
    }),
  });
  if (!res.ok) return { ok: false, error: `Resend: ${await res.text()}` };
  // Resend-email-id: koppelt de nurture-meetlaag aan de webhook-events (open/klik).
  const providerMessageId =
    ((await res.json().catch(() => null)) as { id?: string } | null)?.id ?? null;

  const sentAtIso = new Date().toISOString();

  // Verzonden Erf Check-mail op de HubSpot-tijdlijn loggen (best-effort).
  if (!testTo && lead?.email) {
    await logLeadEmail(leadId, {
      subject: cleanSubject,
      html,
      from: fromEmail,
      to: lead.email,
      sentAtIso,
    }).catch(() => {});
  }

  await admin
    .from("erfscans")
    .update({ status: "sent", sent_at: sentAtIso })
    .eq("lead_id", leadId);

  // Meetlaag: de Erf Check-mail loggen (stroom 'erfcheck', geen flow-stap).
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

  return { ok: true };
}
