import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import type { EmailSequenceStep } from "@/lib/database.types";

const VERDICT: Record<string, string> = {
  groen: "Kansrijk",
  oranje: "Twijfelachtig",
  rood: "Complex",
};

const DAY = 86_400_000;

type MergeValues = {
  voornaam: string;
  adres: string;
  verdict: string;
  perceel_m2: string;
};

function applyMerge(text: string, v: MergeValues): string {
  return text
    .replace(/\{\{\s*voornaam\s*\}\}/g, v.voornaam)
    .replace(/\{\{\s*adres\s*\}\}/g, v.adres)
    .replace(/\{\{\s*verdict\s*\}\}/g, v.verdict)
    .replace(/\{\{\s*perceel_m2\s*\}\}/g, v.perceel_m2)
    .replace(/Hoi\s+,/g, "Hoi,"); // nette aanhef als voornaam ontbreekt
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Plain-text body -> HTML: escape, links klikbaar, regels -> <br>.
function bodyToHtml(text: string): string {
  const linked = esc(text).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#0a1b2b">$1</a>',
  );
  return linked.split("\n").map((l) => l || "&nbsp;").join("<br>");
}

// Rendert een stap naar een verzendklare {subject, html} met de merge-velden.
export function renderNurtureEmail(
  step: EmailSequenceStep,
  v: MergeValues,
): { subject: string; html: string } {
  const subject = applyMerge(step.onderwerp, v);
  const preview = step.preview ? applyMerge(step.preview, v) : "";
  const bodyHtml = bodyToHtml(applyMerge(step.body, v));

  const button =
    step.cta_primary_label && step.cta_primary_url
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="border-radius:8px;background:#0a1b2b">
          <a href="${step.cta_primary_url}" style="display:inline-block;padding:12px 22px;color:#fff;font-weight:600;font-size:15px;text-decoration:none;border-radius:8px">${esc(step.cta_primary_label)}</a>
        </td></tr></table>`
      : "";

  const secondary =
    step.cta_secondary_label && step.cta_secondary_url
      ? `<p style="margin:12px 0 0"><a href="${step.cta_secondary_url}" style="color:#718d69;font-weight:600;text-decoration:none">${esc(step.cta_secondary_label)} →</a></p>`
      : "";

  const html = `<!-- preheader -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preview)}</div>
<div style="font-family:system-ui,-apple-system,Arial,sans-serif;color:#1f2937;font-size:15px;line-height:1.55;max-width:600px">
  <div>${bodyHtml}</div>
  ${button}
  ${secondary}
</div>`;

  return { subject, html };
}

type ErfscanRow = {
  lead_id: string;
  sent_at: string | null;
  conclusie: string | null;
  dossier: Record<string, unknown> | null;
  leads: {
    voornaam: string | null;
    naam: string | null;
    email: string | null;
    status: string | null;
    postcode: string | null;
    huisnummer: string | null;
  } | null;
};

function mergeFor(row: ErfscanRow): MergeValues {
  const d = (row.dossier ?? {}) as {
    locatie?: { weergavenaam?: string };
    perceel?: { oppervlakte_m2?: number };
  };
  const lead = row.leads!;
  const adres =
    d.locatie?.weergavenaam ||
    [lead.postcode, lead.huisnummer].filter(Boolean).join(" ") ||
    "je erf";
  const opp = d.perceel?.oppervlakte_m2;
  return {
    voornaam: lead.voornaam || lead.naam?.split(" ")[0] || "",
    adres,
    verdict: row.conclusie ? VERDICT[row.conclusie] ?? row.conclusie : "nog te bepalen",
    perceel_m2: opp != null ? `± ${opp} m²` : "n.b.",
  };
}

// Verstuurt per lead maximaal één due-en-nog-niet-verzonden stap (paceert de
// reeks, voorkomt bursts). Anker = het moment dat het rapport is verstuurd.
export async function runNurture(): Promise<{
  ok: boolean;
  verstuurd: number;
  error?: string;
}> {
  const admin = createAdminClient();

  const { data: steps } = await admin
    .from("email_sequence_steps")
    .select("*")
    .eq("actief", true)
    .order("volgorde", { ascending: true });
  if (!steps || steps.length === 0) return { ok: true, verstuurd: 0 };

  const { data: rows } = await admin
    .from("erfscans")
    .select(
      "lead_id, sent_at, conclusie, dossier, leads(voornaam,naam,email,status,postcode,huisnummer)",
    )
    .not("sent_at", "is", null);
  const scans = (rows ?? []) as unknown as ErfscanRow[];
  if (scans.length === 0) return { ok: true, verstuurd: 0 };

  const { data: sends } = await admin
    .from("email_sequence_sends")
    .select("lead_id, step_id");
  const gedaan = new Set((sends ?? []).map((s) => `${s.lead_id}:${s.step_id}`));

  const from =
    process.env.NURTURE_FROM_EMAIL ||
    process.env.REPORT_FROM_EMAIL ||
    "opeigenerf <noreply@opeigenerf.nl>";
  const replyTo = process.env.NURTURE_REPLY_TO || "info@opeigenerf.nl";
  const now = Date.now();
  let verstuurd = 0;

  for (const row of scans) {
    const lead = row.leads;
    if (!lead?.email || !row.sent_at) continue;
    if (lead.status === "gewonnen" || lead.status === "verloren") continue; // exit-on-conversion

    const anchor = new Date(row.sent_at).getTime();
    const v = mergeFor(row);

    // Eerste due-en-onverzonden stap voor deze lead (max. één per run).
    const step = steps.find(
      (st) =>
        !gedaan.has(`${row.lead_id}:${st.id}`) &&
        now >= anchor + st.dag_na_start * DAY,
    );
    if (!step) continue;

    const { subject, html } = renderNurtureEmail(step as EmailSequenceStep, v);
    const ok = await sendEmail({ to: lead.email, subject, html, from, replyTo });
    if (!ok) continue; // RESEND niet gezet of fout -> later opnieuw proberen

    await admin
      .from("email_sequence_sends")
      .insert({ lead_id: row.lead_id, step_id: step.id });
    verstuurd++;
  }

  return { ok: true, verstuurd };
}
