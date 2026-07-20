import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { logLeadEmail } from "@/lib/hubspot";
import { reportBaseUrl } from "@/lib/erfcheck-report";
import {
  getSetting,
  SETTING_KEYS,
  DEFAULT_NURTURE_FROM,
  DEFAULT_NURTURE_REPLY_TO,
  DEFAULT_NURTURE_BCC,
  parseNurtureFlow,
  type NurtureFlow,
} from "@/lib/settings";
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
  erfcheck_url: string;
  token: string;
};

// Herschrijft een externe link naar de klik-redirect /l/<token>?u=…&l=<label>, zodat
// een klik als bezoek op de lead wordt geregistreerd. CRM-eigen links (bijv. de
// /r/-pagina, die zichzelf al trackt) en niet-http links laten we ongemoeid.
function trackedHref(v: MergeValues, rawUrl: string, label: string): string {
  if (!v.token) return rawUrl;
  const base = reportBaseUrl();
  let host: string;
  let crmHost: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
    crmHost = new URL(base).hostname.toLowerCase();
  } catch {
    return rawUrl; // mailto:, tel:, relatief of ongeldig → niet wrappen
  }
  if (host === crmHost) return rawUrl;
  const u = Buffer.from(rawUrl, "utf8").toString("base64url");
  const q = new URLSearchParams({ u });
  if (label) q.set("l", label.slice(0, 120));
  return `${base}/l/${v.token}?${q.toString()}`;
}

function applyMerge(text: string, v: MergeValues): string {
  return text
    .replace(/\{\{\s*voornaam\s*\}\}/g, v.voornaam)
    .replace(/\{\{\s*adres\s*\}\}/g, v.adres)
    .replace(/\{\{\s*verdict\s*\}\}/g, v.verdict)
    .replace(/\{\{\s*perceel_m2\s*\}\}/g, v.perceel_m2)
    .replace(/\{\{\s*erfcheck_url\s*\}\}/g, v.erfcheck_url)
    .replace(/Hoi\s+,/g, "Hoi,"); // nette aanhef als voornaam ontbreekt
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Plain-text body -> HTML: escape, links klikbaar (via de klik-tracker), regels -> <br>.
function bodyToHtml(text: string, v: MergeValues): string {
  const linked = esc(text).replace(/(https?:\/\/[^\s<]+)/g, (m) => {
    const raw = m.replace(/&amp;/g, "&"); // esc() maakte & → &amp;: echte bestemming herstellen
    const href = esc(trackedHref(v, raw, "body"));
    return `<a href="${href}" style="color:#0a1b2b">${m}</a>`;
  });
  return linked.split("\n").map((l) => l || "&nbsp;").join("<br>");
}

// Rendert een stap naar een verzendklare {subject, html} met de merge-velden.
export function renderNurtureEmail(
  step: EmailSequenceStep,
  v: MergeValues,
): { subject: string; html: string } {
  const subject = applyMerge(step.onderwerp, v);
  const preview = step.preview ? applyMerge(step.preview, v) : "";
  const bodyHtml = bodyToHtml(applyMerge(step.body, v), v);

  const button =
    step.cta_primary_label && step.cta_primary_url
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="border-radius:8px;background:#0a1b2b">
          <a href="${esc(trackedHref(v, applyMerge(step.cta_primary_url, v), step.cta_primary_label))}" style="display:inline-block;padding:12px 22px;color:#fff;font-weight:600;font-size:15px;text-decoration:none;border-radius:8px">${esc(step.cta_primary_label)}</a>
        </td></tr></table>`
      : "";

  const secondary =
    step.cta_secondary_label && step.cta_secondary_url
      ? `<p style="margin:12px 0 0"><a href="${esc(trackedHref(v, applyMerge(step.cta_secondary_url, v), step.cta_secondary_label))}" style="color:#718d69;font-weight:600;text-decoration:none">${esc(step.cta_secondary_label)} →</a></p>`
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
    report_token: string | null;
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
    erfcheck_url: lead.report_token ? `${reportBaseUrl()}/r/${lead.report_token}` : "",
    token: lead.report_token ?? "",
  };
}

// Toegestane erfcheck-conclusies o.b.v. de verdict-instelling (null = alle).
function verdictSet(v: NurtureFlow["verdict"]): Set<string> | null {
  if (v === "alle") return null;
  if (v === "alleen_geschikt") return new Set(["groen"]);
  return new Set(["groen", "oranje"]); // geschikt_twijfel
}

// Valt 'nu' (Europe/Amsterdam) binnen het ingestelde verzendvenster?
function binnenVerzendvenster(flow: NurtureFlow): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const dayKey = ({ Mon: "ma", Tue: "di", Wed: "wo", Thu: "do", Fri: "vr", Sat: "za", Sun: "zo" } as Record<string, string>)[wd];
  if (!dayKey || !flow.dagen[dayKey as keyof NurtureFlow["dagen"]]) return false;
  const nu = `${hh}:${mm}`;
  return nu >= flow.venster_van && nu <= flow.venster_tot;
}

// Verstuurt per lead maximaal één due-en-nog-niet-verzonden stap (paceert de
// reeks, voorkomt bursts). Anker = het moment dat het rapport is verstuurd.
export async function runNurture(opts?: {
  force?: boolean;
  leadId?: string;
}): Promise<{
  ok: boolean;
  verstuurd: number;
  error?: string;
}> {
  const admin = createAdminClient();

  // Flow-instellingen (master aan/uit, verzendvenster, verdict-doelgroep).
  const flow = parseNurtureFlow(await getSetting(SETTING_KEYS.nurtureFlow));
  if (!flow.actief) return { ok: true, verstuurd: 0 };
  if (!opts?.force && !binnenVerzendvenster(flow)) return { ok: true, verstuurd: 0 };
  const verdictToegestaan = verdictSet(flow.verdict);
  const clickedCache = new Map<string, Set<string>>();

  const { data: steps } = await admin
    .from("email_sequence_steps")
    .select("*")
    .eq("actief", true)
    .order("volgorde", { ascending: true });
  if (!steps || steps.length === 0) return { ok: true, verstuurd: 0 };

  let q = admin
    .from("erfscans")
    .select(
      "lead_id, sent_at, conclusie, dossier, leads(voornaam,naam,email,status,postcode,huisnummer,report_token)",
    )
    .not("sent_at", "is", null);
  if (opts?.leadId) q = q.eq("lead_id", opts.leadId);
  const { data: rows } = await q;
  const scans = (rows ?? []) as unknown as ErfscanRow[];
  if (scans.length === 0) return { ok: true, verstuurd: 0 };

  const { data: sends } = await admin
    .from("email_sequence_sends")
    .select("lead_id, step_id");
  const gedaan = new Set((sends ?? []).map((s) => `${s.lead_id}:${s.step_id}`));

  // Suppressie-lijst (bounces/klachten/afmeldingen) — nooit meer mailen.
  const { data: supp } = await (admin as any).rpc("nurture_suppressed_emails");
  const suppressed = new Set(
    ((supp ?? []) as string[]).map((e) => e.toLowerCase()),
  );

  // Afzender + reply-to + bcc zijn instelbaar via de UI (app_settings); anders env/default.
  const from = await getSetting(SETTING_KEYS.nurtureFrom, DEFAULT_NURTURE_FROM);
  const replyTo = await getSetting(
    SETTING_KEYS.nurtureReplyTo,
    DEFAULT_NURTURE_REPLY_TO,
  );
  const bcc = (await getSetting(SETTING_KEYS.nurtureBcc, DEFAULT_NURTURE_BCC)).trim();
  const now = Date.now();
  let verstuurd = 0;

  for (const row of scans) {
    const lead = row.leads;
    if (!lead?.email || !row.sent_at) continue;
    if (lead.status === "gewonnen" || lead.status === "verloren") continue; // exit-on-conversion
    if (suppressed.has(lead.email.toLowerCase())) continue; // bounce/klacht/afmelding
    // Doelgroep op erf-verdict: erf-ongeschikte leads (rood) standaard uitgesloten.
    if (verdictToegestaan && !verdictToegestaan.has(row.conclusie ?? "")) continue;

    const anchor = new Date(row.sent_at).getTime();
    const v = mergeFor(row);

    // Eerste due-en-onverzonden stap voor deze lead (max. één per run).
    // Met force: negeer de wachttijd en stuur de eerstvolgende onverzonden stap.
    const step = steps.find(
      (st) =>
        !gedaan.has(`${row.lead_id}:${st.id}`) &&
        (opts?.force || now >= anchor + st.dag_na_start * DAY),
    );
    if (!step) continue;

    // Verzendconditie per stap. 'niet_geklikt_vorige' → alleen sturen als de lead
    // de vorige stap NIET klikte (meetlaag). 'niet_geconverteerd' is gedekt door de
    // gewonnen/verloren-uitsluiting hierboven. 'altijd' → geen extra check.
    if ((step as { send_condition?: string }).send_condition === "niet_geklikt_vorige") {
      const idx = steps.indexOf(step);
      const prev = idx > 0 ? steps[idx - 1] : null;
      if (prev) {
        let clicked = clickedCache.get(row.lead_id);
        if (!clicked) {
          const { data: cl } = await (admin as any).rpc("nurture_clicked_step_ids", {
            p_lead: row.lead_id,
          });
          clicked = new Set(((cl ?? []) as string[]));
          clickedCache.set(row.lead_id, clicked);
        }
        if (clicked.has(prev.id)) continue; // vorige geklikt → deze stap overslaan
      }
    }

    const { subject, html } = renderNurtureEmail(step as EmailSequenceStep, v);
    const sent = await sendEmail({
      to: lead.email,
      subject,
      html,
      from,
      replyTo,
      ...(bcc ? { bcc } : {}),
    });
    if (!sent.ok) continue; // RESEND niet gezet of fout -> later opnieuw proberen

    await admin
      .from("email_sequence_sends")
      .insert({ lead_id: row.lead_id, step_id: step.id });
    // Meetlaag: log het verzonden bericht + het Resend-id (koppelt de webhooks).
    await (admin as any).rpc("nurture_log_message", {
      p_lead: row.lead_id,
      p_step: step.id,
      p_to: lead.email,
      p_subject: subject,
      p_pmid: sent.id,
    });
    // Verstuurde mail op de HubSpot-tijdlijn van het contact + de deal loggen.
    const logged = await logLeadEmail(row.lead_id, {
      subject,
      html,
      from,
      to: lead.email,
      sentAtIso: new Date().toISOString(),
    }).catch(() => ({ ok: false }) as { ok: boolean });
    if (logged.ok) {
      await admin
        .from("email_sequence_sends")
        .update({ hubspot_logged_at: new Date().toISOString() })
        .eq("lead_id", row.lead_id)
        .eq("step_id", step.id);
    }
    verstuurd++;
  }

  return { ok: true, verstuurd };
}

// Logt reeds-verstuurde nurture-mails alsnog op de HubSpot-tijdlijn. Idempotent:
// slaat sends met hubspot_logged_at over. Herrendert de mail met de opgeslagen
// stap + huidige lead/erfscan-data en gebruikt het oorspronkelijke sent_at.
export async function backfillNurtureHubspot(): Promise<{
  ok: boolean;
  gelogd: number;
  overgeslagen: number;
}> {
  const admin = createAdminClient();

  const { data: steps } = await admin.from("email_sequence_steps").select("*");
  const stepById = new Map(
    (steps ?? []).map((s) => [s.id, s as EmailSequenceStep]),
  );

  const { data: sends } = await admin
    .from("email_sequence_sends")
    .select("id, lead_id, step_id, sent_at, hubspot_logged_at")
    .is("hubspot_logged_at", null)
    .order("sent_at", { ascending: true });
  if (!sends || sends.length === 0) return { ok: true, gelogd: 0, overgeslagen: 0 };

  const from = await getSetting(SETTING_KEYS.nurtureFrom, DEFAULT_NURTURE_FROM);

  let gelogd = 0;
  let overgeslagen = 0;
  for (const s of sends) {
    const step = stepById.get(s.step_id);
    if (!step) {
      overgeslagen++;
      continue;
    }
    const { data: scan } = await admin
      .from("erfscans")
      .select(
        "lead_id, sent_at, conclusie, dossier, leads(voornaam,naam,email,status,postcode,huisnummer,report_token)",
      )
      .eq("lead_id", s.lead_id)
      .maybeSingle();
    const row = scan as unknown as ErfscanRow | null;
    const lead = row?.leads;
    if (!lead?.email) {
      overgeslagen++;
      continue;
    }
    const { subject, html } = renderNurtureEmail(step, mergeFor(row!));
    const res = await logLeadEmail(s.lead_id, {
      subject,
      html,
      from,
      to: lead.email,
      sentAtIso: new Date(s.sent_at ?? Date.now()).toISOString(),
    }).catch(() => ({ ok: false }) as { ok: boolean });
    if (res.ok) {
      await admin
        .from("email_sequence_sends")
        .update({ hubspot_logged_at: new Date().toISOString() })
        .eq("id", s.id);
      gelogd++;
    } else {
      overgeslagen++;
    }
  }

  return { ok: true, gelogd, overgeslagen };
}
