"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runReportGeneration } from "@/lib/generate-report-flow";
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

  const admin = createAdminClient();
  const attachments: { filename: string; content: string }[] = [];
  if (erfscan.report_pdf_path) {
    const { data: blob } = await admin.storage
      .from("erfscans")
      .download(erfscan.report_pdf_path);
    if (blob) {
      const buf = Buffer.from(await blob.arrayBuffer());
      attachments.push({
        filename: "erfcheck-rapport.pdf",
        content: buf.toString("base64"),
      });
    }
  }

  const html = toHtml(erfscan.draft_email_body || "");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.REPORT_FROM_EMAIL || "opeigenerf <noreply@opeigenerf.nl>",
      to,
      // BCC-kopie naar het archief-adres, behalve in testmodus (gaat toch al naar test-adres).
      ...(!testTo ? { bcc: process.env.REPORT_BCC || "info@opeigenerf.nl" } : {}),
      subject:
        (testTo ? `[TEST → ${lead?.email ?? "?"}] ` : "") +
        (erfscan.draft_email_subject || "Je Erf Check van opeigenerf.nl"),
      html,
      attachments,
    }),
  });
  if (!res.ok) return { ok: false, error: `Resend: ${await res.text()}` };

  await admin
    .from("erfscans")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("lead_id", leadId);
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}
