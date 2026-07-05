import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runReportGeneration } from "@/lib/generate-report-flow";
import { sendEmail } from "@/lib/email";
import { scoreLead } from "@/lib/lead-score";
import type { Lead, Erfscan } from "@/lib/database.types";

export const runtime = "nodejs";
export const maxDuration = 120;

// Auto-rapportgeneratie. Wordt aangeroepen door de DB-trigger op erfscans zodra
// de erfscan klaar is (status 'needs_review'), of handmatig. Genereert het
// rapport + concept-mail en stuurt een interne notificatie met erfgrootte,
// leadscore, concept-mail en het PDF-rapport naar LEAD_NOTIFY_EMAIL.
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    /* lege body toegestaan */
  }

  const secret = process.env.ERFSCAN_SECRET;
  if (secret) {
    const provided =
      request.headers.get("x-erfscan-secret") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      (typeof body.secret === "string" ? body.secret : undefined);
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const record = (body.record ?? {}) as Record<string, unknown>;
  const leadId = (body.lead_id ?? record.lead_id) as string | undefined;
  if (!leadId) {
    return NextResponse.json({ error: "lead_id ontbreekt" }, { status: 422 });
  }

  const gen = await runReportGeneration(leadId);
  if (!gen.ok) {
    return NextResponse.json({ error: gen.error }, { status: 500 });
  }

  // Interne notificatie (faalt stil — mag de generatie niet ongedaan maken).
  try {
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
    const notify = process.env.LEAD_NOTIFY_EMAIL;

    if (lead && erfscan && notify) {
      const d = (erfscan.dossier ?? {}) as {
        perceel?: { oppervlakte_m2?: number };
        ruimtelijk?: { achtererf_proxy_m2?: number; max_vergunningvrij_m2?: number };
        locatie?: { woonplaats?: string; gemeente?: string };
      };
      const perceel = d.perceel?.oppervlakte_m2;
      const achtererf = d.ruimtelijk?.achtererf_proxy_m2;
      const maxvv = d.ruimtelijk?.max_vergunningvrij_m2;
      const score = scoreLead(lead, erfscan);
      const naam =
        lead.naam ||
        [lead.voornaam, lead.achternaam].filter(Boolean).join(" ") ||
        lead.email ||
        "onbekend";
      const plaats = d.locatie?.woonplaats || d.locatie?.gemeente || "";
      const conclusie = erfscan.conclusie
        ? erfscan.conclusie[0].toUpperCase() + erfscan.conclusie.slice(1)
        : "—";
      const m2 = (v?: number) => (v != null ? `${v} m²` : "n.b.");

      const attachments: { filename: string; content: string }[] = [];
      if (erfscan.report_pdf_path) {
        const { data: blob } = await admin.storage
          .from("erfscans")
          .download(erfscan.report_pdf_path);
        if (blob) {
          attachments.push({
            filename: "erfcheck-rapport.pdf",
            content: Buffer.from(await blob.arrayBuffer()).toString("base64"),
          });
        }
      }

      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const conceptBody = esc(erfscan.draft_email_body || "").replace(/\n/g, "<br>");

      const html = `
<div style="font-family:system-ui,Arial,sans-serif;color:#0a1b2b;max-width:640px">
  <h2 style="margin:0 0 4px">Nieuw erfcheck-concept — ${esc(naam)}</h2>
  <p style="margin:0 0 16px;color:#64748b">${esc(plaats)}</p>

  <table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">
    <tr><td style="padding:2px 16px 2px 0;color:#64748b">Leadscore</td><td><strong>${score.score}</strong> (${score.label})</td></tr>
    <tr><td style="padding:2px 16px 2px 0;color:#64748b">Erfcheck-conclusie</td><td><strong>${conclusie}</strong></td></tr>
    <tr><td style="padding:2px 16px 2px 0;color:#64748b">Perceelgrootte</td><td>${m2(perceel)}</td></tr>
    <tr><td style="padding:2px 16px 2px 0;color:#64748b">Achtererf (indicatie)</td><td>${m2(achtererf)}</td></tr>
    <tr><td style="padding:2px 16px 2px 0;color:#64748b">Max. vergunningvrij (indicatie)</td><td>${m2(maxvv)}</td></tr>
  </table>

  <h3 style="margin:0 0 6px;font-size:14px">Concept-mail aan de lead</h3>
  <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:14px">
    <div style="color:#64748b;margin-bottom:6px">Onderwerp: <strong>${esc(erfscan.draft_email_subject || "")}</strong></div>
    <div>${conceptBody}</div>
  </div>

  <p style="margin:16px 0 0;font-size:13px;color:#64748b">
    Het volledige rapport zit als PDF in de bijlage. Bekijk en verstuur in het
    <a href="${(process.env.NEXT_PUBLIC_SITE_URL || "https://crm.opeigenerf.nl") + "/leads/" + leadId}" style="color:#0a1b2b">CRM</a>.
  </p>
</div>`;

      await sendEmail({
        to: notify,
        subject: `Erfcheck-concept: ${naam} — ${score.label} (score ${score.score})`,
        html,
        attachments,
      });
    }
  } catch (e) {
    console.error("[generate-report] notificatie mislukt:", e);
  }

  return NextResponse.json({ ok: true, lead_id: leadId });
}
