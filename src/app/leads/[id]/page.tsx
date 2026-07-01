import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { typeLabel, erfscanStatusLabel, ERFSCAN_STATUS_STYLES } from "@/lib/constants";
import { StatusSelect } from "./status-select";
import { NotesSection } from "./notes-section";
import { ErfscanPanel } from "./erfscan-panel";
import { ErfscanReview } from "./erfscan-review";
import { ReportPanel } from "./report-panel";
import { ScoreBadge } from "@/components/score-badge";
import { scoreLead, SCORE_ACTIE } from "@/lib/lead-score";
import type { Lead, LeadNote, Erfscan } from "@/lib/database.types";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single<Lead>();

  if (!lead) notFound();

  const { data: notes } = await supabase
    .from("lead_notes")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  const { data: erfscan } = await supabase
    .from("erfscans")
    .select("*")
    .eq("lead_id", id)
    .maybeSingle<Erfscan>();

  const leadScore = scoreLead(lead, erfscan);

  // Signed URL voor de privé-luchtfoto (server-side, service role).
  let luchtfotoUrl: string | null = null;
  if (erfscan?.luchtfoto_path) {
    try {
      const admin = createAdminClient();
      const { data: signed } = await admin.storage
        .from("erfscans")
        .createSignedUrl(erfscan.luchtfoto_path, 3600);
      luchtfotoUrl = signed?.signedUrl ?? null;
    } catch {
      luchtfotoUrl = null; // service-role key ontbreekt of file weg
    }
  }

  let reportPdfUrl: string | null = null;
  if (erfscan?.report_pdf_path) {
    try {
      const admin = createAdminClient();
      const { data: signed } = await admin.storage
        .from("erfscans")
        .createSignedUrl(erfscan.report_pdf_path, 3600);
      reportPdfUrl = signed?.signedUrl ?? null;
    } catch {
      reportPdfUrl = null;
    }
  }

  const address = [
    [lead.postcode, lead.huisnummer, lead.toevoeging]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join("");

  const details = (lead.details ?? {}) as Record<string, unknown>;
  const detailEntries = Object.entries(details).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Terug naar dashboard
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {lead.naam ||
                [lead.voornaam, lead.achternaam].filter(Boolean).join(" ") ||
                lead.email ||
                "Lead"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>{typeLabel(lead.type)}</span>
              <span>·</span>
              <StatusBadge status={lead.status} />
              {erfscan && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                    ERFSCAN_STATUS_STYLES[erfscan.status] ??
                    "bg-slate-100 text-slate-700 ring-slate-500/20"
                  }`}
                >
                  {erfscanStatusLabel(erfscan.status)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Status wijzigen:</span>
            <StatusSelect leadId={lead.id} current={lead.status} />
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {/* Lead info */}
          <section className="md:col-span-2 space-y-6">
            {erfscan ? (
              <>
                <ErfscanPanel erfscan={erfscan} luchtfotoUrl={luchtfotoUrl} />
                <ErfscanReview
                  leadId={lead.id}
                  initialTier3={
                    (erfscan.tier3 ?? {}) as unknown as Record<string, string>
                  }
                  initialConclusie={erfscan.conclusie}
                  leadPostcode={lead.postcode ?? ""}
                  leadHuisnummer={lead.huisnummer ?? ""}
                  suggesties={
                    ((erfscan.dossier as { tier3_suggesties?: unknown })
                      ?.tier3_suggesties ?? {}) as Record<
                      string,
                      {
                        waarde?: string;
                        zekerheid?: string;
                        bron?: string;
                        detail?: string;
                        url?: string;
                      }
                    >
                  }
                  conclusieSuggestie={
                    (erfscan.dossier as { conclusie_suggestie?: unknown })
                      ?.conclusie_suggestie as {
                      waarde?: string;
                      zekerheid?: string;
                      pluspunten?: string[];
                      blokkers?: string[];
                      checks?: string[];
                    }
                  }
                />
                <ReportPanel
                  leadId={lead.id}
                  status={erfscan.status}
                  draftSubject={erfscan.draft_email_subject ?? ""}
                  draftBody={erfscan.draft_email_body ?? ""}
                  pdfUrl={reportPdfUrl}
                  leadEmail={lead.email}
                />
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                Nog geen erfscan voor deze lead.
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">
                Contactgegevens
              </h2>
              <dl className="grid grid-cols-2 gap-4">
                <Field label="Voornaam" value={lead.voornaam} />
                <Field label="Achternaam" value={lead.achternaam} />
                <Field label="E-mail" value={lead.email} />
                <Field label="Telefoon" value={lead.telefoon} />
                <Field label="Adres" value={address} />
                <Field label="Bron" value={lead.source} />
              </dl>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">
                Aanvraag
              </h2>
              <dl className="grid grid-cols-2 gap-4">
                <Field label="Doelgroep" value={lead.audience} />
                <Field label="Startdatum" value={lead.startdatum} />
                <Field label="Budget" value={lead.budget} />
                <Field label="Planning" value={lead.planning} />
              </dl>
            </div>

            {detailEntries.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">
                  Volledige payload (details)
                </h2>
                <dl className="grid grid-cols-2 gap-4">
                  {detailEntries.map(([k, v]) => (
                    <Field
                      key={k}
                      label={k}
                      value={
                        typeof v === "object"
                          ? JSON.stringify(v)
                          : String(v)
                      }
                    />
                  ))}
                </dl>
              </div>
            )}
          </section>

          {/* Rechterkolom: leadscore + notities */}
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Leadscore</h2>
                <ScoreBadge score={leadScore.score} label={leadScore.label} />
              </div>
              <p className="mb-3 text-sm text-slate-600">{SCORE_ACTIE[leadScore.label]}</p>
              <ul className="space-y-1">
                {leadScore.breakdown.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-600">{f.factor}</span>
                    <span
                      className={
                        f.punten >= 0
                          ? "font-medium text-green-600"
                          : "font-medium text-red-600"
                      }
                    >
                      {f.punten > 0 ? `+${f.punten}` : f.punten}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-slate-400">
                Leadscore = kwaliteit/prioriteit van de lead. Los van de
                erfcheck-conclusie (haalbaarheid).
              </p>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Notities</h2>
              <NotesSection leadId={lead.id} notes={(notes ?? []) as LeadNote[]} />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
