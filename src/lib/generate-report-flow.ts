import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateReportContent } from "@/lib/generate-report";
import { renderReportPdf } from "@/app/leads/[id]/report-pdf";
import type { ReportContent } from "@/lib/report-schema";
import type { Lead, Erfscan } from "@/lib/database.types";

// Minimale rapport-content voor een PDF-only re-render. De compacte PDF gebruikt
// uit de content alleen de conclusie (rest is statisch/dossier-gedreven), dus we
// kunnen de bestaande erfscan-conclusie + concept-mail hergebruiken zonder de LLM.
function stubContent(erfscan: Erfscan): ReportContent {
  const con = erfscan.conclusie;
  const conclusie = con === "groen" || con === "oranje" || con === "rood" ? con : "oranje";
  return {
    doel_type: "onbekend",
    conclusie,
    advies_vervolgstap: "haalbaarheidsscan",
    samenvatting: "",
    kort: { ruimte_achtererf: "", vergunningvrij: "", route: "", risicos: "", vervolgstap: "" },
    locatie_perceel: "",
    regelcheck: "",
    kansen: [],
    aandachtspunten: [],
    advies_tekst: "",
    concept_mail: {
      onderwerp: erfscan.draft_email_subject ?? "",
      body: erfscan.draft_email_body ?? "",
    },
  };
}

// Alleen de PDF opnieuw renderen (geen LLM, geen kosten): hergebruikt de bestaande
// conclusie/concept-mail. Handig na een layout-wijziging in de PDF. Behoudt de
// status en concept-mail; ververst enkel het PDF-bestand + updated_at.
export async function rerenderReportPdf(
  leadId: string,
): Promise<{ ok: boolean; error?: string }> {
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
  if (!lead || !erfscan) return { ok: false, error: "Lead of erfscan niet gevonden." };
  if (!erfscan.report_pdf_path)
    return { ok: false, error: "Nog geen rapport — gebruik eerst 'Opnieuw genereren'." };

  const pdf = await renderReportPdf(lead, erfscan, stubContent(erfscan));
  const path = `${leadId}/rapport.pdf`;
  const { error: upErr } = await admin.storage
    .from("erfscans")
    .upload(path, pdf, { contentType: "application/pdf", upsert: true, cacheControl: "0" });
  if (upErr) return { ok: false, error: `Upload mislukt: ${upErr.message}` };

  // Trigger set_updated_at → cache-buster (?v=updated_at) ververst de bekijk-link.
  const { error } = await admin
    .from("erfscans")
    .update({ report_pdf_path: path })
    .eq("lead_id", leadId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Kern van de rapportgeneratie zonder auth: Claude → branded PDF → Storage →
// erfscans bijgewerkt (status 'rendered' + concept-mail). Gebruikt door zowel
// de handmatige knop als de automatische /api/generate-report route.
export async function runReportGeneration(
  leadId: string,
): Promise<{ ok: boolean; error?: string }> {
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
  if (!lead || !erfscan) return { ok: false, error: "Lead of erfscan niet gevonden." };

  // Bij auto-generatie is er nog geen mens-bevestigde conclusie: neem de
  // suggestie van de engine over zodat het rapport een kleur heeft.
  let eff = erfscan;
  if (!erfscan.conclusie) {
    const sug = (
      erfscan.dossier as { conclusie_suggestie?: { waarde?: string } } | null
    )?.conclusie_suggestie?.waarde;
    if (sug === "groen" || sug === "oranje" || sug === "rood") {
      await admin.from("erfscans").update({ conclusie: sug }).eq("lead_id", leadId);
      eff = { ...erfscan, conclusie: sug };
    }
  }

  const content = await generateReportContent(lead, eff);
  const pdf = await renderReportPdf(lead, eff, content);

  const path = `${leadId}/rapport.pdf`;
  const { error: upErr } = await admin.storage
    .from("erfscans")
    .upload(path, pdf, {
      contentType: "application/pdf",
      upsert: true,
      // Vaste padnaam wordt overschreven bij regenereren; geen CDN-cache,
      // anders zie je na 'Opnieuw genereren' nog even de oude PDF.
      cacheControl: "0",
    });
  if (upErr) return { ok: false, error: `Upload mislukt: ${upErr.message}` };

  const { error } = await admin
    .from("erfscans")
    .update({
      status: "rendered",
      report_pdf_path: path,
      draft_email_subject: content.concept_mail.onderwerp,
      draft_email_body: content.concept_mail.body,
    })
    .eq("lead_id", leadId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
