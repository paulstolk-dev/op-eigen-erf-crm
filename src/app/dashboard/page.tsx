import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
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
  value: number;
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
                <th className="px-4 py-3 font-medium">Volgende actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
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
