import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { DashboardChart, type DayPoint } from "@/components/dashboard-chart";
import { StatusBadge } from "@/components/status-badge";
import { ScoreBadge } from "@/components/score-badge";
import { scoreLead, SCORE_ACTIE_KORT } from "@/lib/lead-score";
import { CONCLUSIE_LABELS, CONCLUSIE_STYLES } from "@/lib/constants";
import type { Lead, Erfscan } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const AUDIENCE_LABEL: Record<string, string> = {
  ouders: "Ouders",
  kind: "Kind",
  kinderen: "Kind",
  mantelzorg: "Mantelzorg",
  verhuur: "Verhuur",
  zelf: "Zelf",
};

function doelLabel(a?: string | null): string {
  if (!a) return "—";
  return AUDIENCE_LABEL[a.toLowerCase()] ?? a;
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

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "erf" | "groen" | "rood";
}) {
  const subColor =
    tone === "groen"
      ? "text-green-600"
      : tone === "rood"
        ? "text-red-600"
        : tone === "erf"
          ? "text-erf"
          : "text-slate-400";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-slate-900">{value}</span>
        {sub && <span className={`text-sm font-medium ${subColor}`}>{sub}</span>}
      </div>
    </div>
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

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  const { data: erfscans } = await supabase.from("erfscans").select("*");
  const { data: adSpend } = await supabase.from("ad_spend").select("date,cost_eur");
  const erfscanByLead = new Map<string, Erfscan>(
    (erfscans ?? []).map((e) => [e.lead_id, e as Erfscan]),
  );

  const rows = (leads ?? [])
    .map((lead) => {
      const erfscan = erfscanByLead.get(lead.id) ?? null;
      return { lead: lead as Lead, erfscan, score: scoreLead(lead as Lead, erfscan) };
    })
    .sort((a, b) => b.score.score - a.score.score);

  const total = rows.length;
  const qualified = rows.filter((r) => r.score.score > 50).length;
  const gewonnen = rows.filter((r) => r.lead.status === "gewonnen").length;
  const verloren = rows.filter((r) => r.lead.status === "verloren").length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  // Marketing: kosten per lead over de laatste 30 dagen (spend ÷ leads).
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const cutoffDate = cutoff.slice(0, 10);
  const spend30 = (adSpend ?? [])
    .filter((r) => r.date >= cutoffDate)
    .reduce((s, r) => s + Number(r.cost_eur), 0);
  const leads30 = rows.filter((r) => (r.lead.created_at ?? "") >= cutoff);
  const qualified30 = leads30.filter((r) => r.score.score > 50).length;
  const eur = (n: number, dec = 2) =>
    n.toLocaleString("nl-NL", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  const hasSpend = (adSpend ?? []).length > 0;
  const kostenPerLead =
    hasSpend && leads30.length ? eur(spend30 / leads30.length) : "—";
  const kostenPerQualified =
    hasSpend && qualified30 ? eur(spend30 / qualified30) : "—";

  // Dagelijkse reeks (laatste 30 dagen): leads/dag + ads-kosten/dag.
  const DAYS = 30;
  const now = Date.now();
  const leadsPerDay = new Map<string, number>();
  for (const r of rows) {
    const d = (r.lead.created_at ?? "").slice(0, 10);
    if (d) leadsPerDay.set(d, (leadsPerDay.get(d) ?? 0) + 1);
  }
  const costPerDay = new Map<string, number>();
  for (const s of adSpend ?? []) {
    costPerDay.set(s.date, (costPerDay.get(s.date) ?? 0) + Number(s.cost_eur));
  }
  const chartData: DayPoint[] = Array.from({ length: DAYS }, (_, i) => {
    const iso = new Date(now - (DAYS - 1 - i) * 86400000)
      .toISOString()
      .slice(0, 10);
    return {
      date: iso,
      leads: leadsPerDay.get(iso) ?? 0,
      cost: costPerDay.get(iso) ?? 0,
    };
  });

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Leads op prioriteit (leadscore), met erfcheck-conclusie en volgende actie.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Aantal leads" value={total} />
          <StatCard
            label="Qualified (score > 50)"
            value={qualified}
            sub={`${pct(qualified)}%`}
            tone="erf"
          />
          <StatCard
            label="Verloren"
            value={verloren}
            sub={`${pct(verloren)}%`}
            tone="rood"
          />
          <StatCard
            label="Gewonnen"
            value={gewonnen}
            sub={`${pct(gewonnen)}%`}
            tone="groen"
          />
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Ad-spend (30d)" value={hasSpend ? eur(spend30, 0) : "—"} />
          <StatCard label="Kosten / lead (30d)" value={kostenPerLead} tone="erf" />
          <StatCard
            label="Kosten / qualified (30d)"
            value={kostenPerQualified}
            tone="erf"
          />
        </div>

        <div className="mb-5">
          <DashboardChart data={chartData} />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Adres</th>
                <th className="px-4 py-3 font-medium">Doel</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Status</th>
                <th className="px-4 py-3 font-medium">Conclusie</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Rapport</th>
                <th className="px-4 py-3 font-medium">Volgende actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    Nog geen leads.
                  </td>
                </tr>
              )}
              {rows.map(({ lead, erfscan, score }) => {
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
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                      {adres(lead, erfscan)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{doelLabel(lead.audience)}</td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={score.score} label={score.label} />
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <StatusBadge status={lead.status} />
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
                    <td className="px-4 py-3 text-slate-700">
                      {SCORE_ACTIE_KORT[score.label]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
