"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runReportGeneration, rerenderReportPdf } from "@/lib/generate-report-flow";
import { verstuurErfcheckRapport } from "@/lib/send-erfcheck-report";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  return { supabase, user };
}

type Result = { ok: boolean; error?: string };

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

/** Concept + PDF versturen naar de lead via Resend → status 'sent'.
 *  De verzendlogica zelf staat in lib/send-erfcheck-report.ts, zodat de
 *  automatische generatie-route exact dezelfde mail kan sturen. */
export async function sendReport(leadId: string): Promise<Result> {
  await requireUser();
  const res = await verstuurErfcheckRapport(leadId);
  if (res.ok) revalidatePath(`/leads/${leadId}`);
  return res;
}
