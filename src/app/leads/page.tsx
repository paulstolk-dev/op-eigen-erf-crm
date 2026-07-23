import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { SyncHubspotButton } from "./sync-hubspot-button";
import { StatusBadge } from "@/components/status-badge";
import { ScoreBadge } from "@/components/score-badge";
import { scoreLead } from "@/lib/lead-score";
import { CONCLUSIE_LABELS, CONCLUSIE_STYLES } from "@/lib/constants";
import type { Lead, Erfscan } from "@/lib/database.types";

// Waar staat de lead in de opvolg-flow? Anker = het rapport is verstuurd.
type FlowStep = { id: string; sleutel: string };
function flowStatus(
  erfscan: Erfscan | null,
  status: string,
  sent: Set<string>,
  steps: FlowStep[],
): { label: string; cls: string; plain?: boolean; title?: string } {
  if (!erfscan?.sent_at)
    return { label: "—", cls: "", plain: true, title: "Rapport nog niet verstuurd" };
  if (status === "gewonnen" || status === "verloren")
    return { label: "Uit flow", cls: "bg-slate-100 text-slate-500 ring-slate-400/20" };
  const next = steps.find((s) => !sent.has(s.id));
  if (!next)
    return { label: "Afgerond", cls: "bg-green-100 text-green-700 ring-green-600/20" };
  return {
    label: next.sleutel.toUpperCase(),
    cls: "bg-navy/10 text-navy ring-navy/20",
    title: "Volgende opvolgmail",
  };
}
const EMPTY = new Set<string>();

export const dynamic = "force-dynamic";

function datum(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Indicatief plaatsbaar oppervlak op het achtererf (zelfde bron als de leadscore).
function achtererf(erfscan?: Erfscan | null): string {
  const r = ((erfscan?.dossier ?? {}) as Record<string, any>).ruimtelijk ?? {};
  const m2 =
    typeof r.max_vergunningvrij_m2 === "number"
      ? r.max_vergunningvrij_m2
      : typeof r.achtererf_proxy_m2 === "number"
        ? r.achtererf_proxy_m2
        : null;
  return m2 != null ? `± ${m2} m²` : "—";
}

function adres(lead: Lead, erfscan?: Erfscan | null): string {
  const d = (erfscan?.dossier ?? {}) as Record<string, any>;
  return (
    d.locatie?.woonplaats ||
    d.locatie?.gemeente ||
    [lead.postcode, lead.huisnummer].filter(Boolean).join(" ") ||
    "—"
  );
}

// Rapportstatus per lead: verzonden > gegenereerd (concept) > nog niets.
function reportBadge(
  erfscan?: Erfscan | null,
): { label: string; cls: string } | null {
  if (!erfscan) return null;
  if (erfscan.sent_at)
    return {
      label: "Verzonden",
      cls: "bg-green-100 text-green-700 ring-green-600/20",
    };
  if (erfscan.report_pdf_path || erfscan.draft_email_body)
    return {
      label: "Gegenereerd",
      cls: "bg-amber-100 text-amber-700 ring-amber-600/20",
    };
  return null;
}

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  const { data: erfscans } = await supabase.from("erfscans").select("*");
  const erfscanByLead = new Map<string, Erfscan>(
    (erfscans ?? []).map((e) => [e.lead_id, e as Erfscan]),
  );

  // Flow-positie: actieve stappen + wat er per lead al verzonden is.
  const { data: flowSteps } = await supabase
    .from("email_sequence_steps")
    .select("id,sleutel,volgorde")
    .eq("actief", true)
    .order("volgorde", { ascending: true });
  const activeSteps = (flowSteps ?? []) as FlowStep[];
  const { data: flowSends } = await supabase
    .from("email_sequence_sends")
    .select("lead_id,step_id");
  const sentByLead = new Map<string, Set<string>>();
  for (const s of flowSends ?? []) {
    if (!sentByLead.has(s.lead_id)) sentByLead.set(s.lead_id, new Set());
    sentByLead.get(s.lead_id)!.add(s.step_id);
  }

  const rows = (leads ?? [])
    .map((lead) => {
      const erfscan = erfscanByLead.get(lead.id) ?? null;
      return { lead: lead as Lead, erfscan, score: scoreLead(lead as Lead, erfscan) };
    })
    .sort(
      (a, b) =>
        new Date(b.lead.created_at ?? 0).getTime() -
        new Date(a.lead.created_at ?? 0).getTime(),
    );

  // Besluit-alert-inschrijvingen krijgen geen erfcheck; los weergeven.
  const leadRows = rows.filter((r) => r.lead.type !== "besluit-alert");
  const besluitRows = rows.filter((r) => r.lead.type === "besluit-alert");

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Leads</h1>
            <p className="text-sm text-slate-500">
              Leads op datum van binnenkomst (nieuw → oud), met leadscore, erfcheck-conclusie en positie in de opvolg-flow.
            </p>
          </div>
          <SyncHubspotButton />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Ontvangen</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Adres</th>
                <th className="px-4 py-3 font-medium">Achtererf</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Geopend</th>
                <th className="px-4 py-3 font-medium">Conclusie</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Rapport</th>
                <th className="px-4 py-3 font-medium">Flow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leadRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    Nog geen leads.
                  </td>
                </tr>
              )}
              {leadRows.map(({ lead, erfscan, score }) => {
                const naam =
                  lead.naam ||
                  [lead.voornaam, lead.achternaam].filter(Boolean).join(" ") ||
                  lead.email ||
                  "—";
                const conclusie = erfscan?.conclusie;
                const rapport = reportBadge(erfscan);
                return (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {naam}
                      </Link>
                      {lead.excluded_from_stats && (
                        <span
                          title="Uitgesloten van de dashboard-telling"
                          className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800"
                        >
                          Test
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {datum(lead.created_at)}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                      {adres(lead, erfscan)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {achtererf(erfscan)}
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={score.score} label={score.label} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {(() => {
                        const n = erfscan?.view_count ?? 0;
                        return n > 0 ? (
                          <span
                            className="font-medium text-slate-900"
                            title={
                              erfscan?.last_viewed_at
                                ? `Laatst geopend: ${datum(erfscan.last_viewed_at)}`
                                : undefined
                            }
                          >
                            {n}×
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {conclusie ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                            CONCLUSIE_STYLES[conclusie] ??
                            "bg-slate-100 text-slate-600 ring-slate-500/20"
                          }`}
                        >
                          {CONCLUSIE_LABELS[conclusie] ?? conclusie}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {rapport ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${rapport.cls}`}
                        >
                          {rapport.label}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const flow = flowStatus(
                          erfscan,
                          lead.status,
                          sentByLead.get(lead.id) ?? EMPTY,
                          activeSteps,
                        );
                        return flow.plain ? (
                          <span className="text-slate-300" title={flow.title}>
                            {flow.label}
                          </span>
                        ) : (
                          <span
                            title={flow.title}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${flow.cls}`}
                          >
                            {flow.label}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {besluitRows.length > 0 && (
          <div className="mt-8">
            <div className="mb-2">
              <h2 className="text-sm font-semibold text-slate-900">Besluit-alerts</h2>
              <p className="text-xs text-slate-500">
                Inschrijvingen voor een besluit-alert. Hiervoor wordt geen
                erfcheck aangemaakt.
              </p>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">E-mail</th>
                    <th className="px-4 py-3 font-medium">Ontvangen</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {besluitRows.map(({ lead }) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {lead.email || "—"}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {datum(lead.created_at)}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <StatusBadge status={lead.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
