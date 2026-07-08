import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { DashboardChart, type DayPoint } from "@/components/dashboard-chart";
import { DashboardFilter } from "@/components/dashboard-filter";
import { AdsSyncButton } from "./ads-sync-button";
import { scoreLead } from "@/lib/lead-score";
import type { Lead, Erfscan } from "@/lib/database.types";

export const dynamic = "force-dynamic";

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

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Aantal dagen tussen twee ISO-datums (inclusief), zodat we een preset kunnen herkennen.
function dayCount(from: string, to: string): number {
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Standaardperiode: laatste 30 dagen. Overschrijfbaar via ?from=&to=.
  const today = new Date();
  const defaultTo = isoDay(today);
  const defaultFrom = isoDay(new Date(today.getTime() - 29 * 86400000));
  const from = sp.from || defaultFrom;
  const to = sp.to || defaultTo;
  // Inclusief de hele einddag: vergelijk op datum-deel.
  const inRange = (d?: string | null) => {
    const day = (d ?? "").slice(0, 10);
    return day >= from && day <= to;
  };
  const nDays = dayCount(from, to);
  const presetDays = [7, 30, 90, 365].includes(nDays) ? nDays : null;

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  const { data: erfscans } = await supabase.from("erfscans").select("*");
  const { data: adSpend } = await supabase
    .from("ad_spend")
    .select("date,cost_eur,clicks");
  const erfscanByLead = new Map<string, Erfscan>(
    (erfscans ?? []).map((e) => [e.lead_id, e as Erfscan]),
  );

  // Alleen leads binnen de gekozen periode meetellen.
  const rows = (leads ?? [])
    .filter((lead) => inRange(lead.created_at))
    .map((lead) => {
      const erfscan = erfscanByLead.get(lead.id) ?? null;
      return { lead: lead as Lead, erfscan, score: scoreLead(lead as Lead, erfscan) };
    });

  const total = rows.length;
  const qualified = rows.filter((r) => r.score.score >= 40).length;
  const gewonnen = rows.filter((r) => r.lead.status === "gewonnen").length;
  const verloren = rows.filter((r) => r.lead.status === "verloren").length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  // Marketing: ads-spend en kosten per lead over dezelfde periode.
  const spend = (adSpend ?? [])
    .filter((r) => inRange(r.date))
    .reduce((s, r) => s + Number(r.cost_eur), 0);
  const eur = (n: number, dec = 2) =>
    n.toLocaleString("nl-NL", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  const hasSpend = (adSpend ?? []).length > 0;
  const kostenPerLead = hasSpend && total ? eur(spend / total) : "—";
  const kostenPerQualified = hasSpend && qualified ? eur(spend / qualified) : "—";

  // Kliks + CTL (click-to-lead): welk deel van de kliks werd een lead.
  const clicks = (adSpend ?? [])
    .filter((r) => inRange(r.date))
    .reduce((s, r) => s + (r.clicks ?? 0), 0);
  const ctl =
    hasSpend && clicks
      ? `${((total / clicks) * 100).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}%`
      : "—";

  // Dagelijkse reeks over de gekozen periode: leads/dag + ads-kosten/dag.
  const leadsPerDay = new Map<string, number>();
  for (const r of rows) {
    const d = (r.lead.created_at ?? "").slice(0, 10);
    if (d) leadsPerDay.set(d, (leadsPerDay.get(d) ?? 0) + 1);
  }
  const costPerDay = new Map<string, number>();
  for (const s of adSpend ?? []) {
    if (inRange(s.date))
      costPerDay.set(s.date, (costPerDay.get(s.date) ?? 0) + Number(s.cost_eur));
  }
  const fromMs = new Date(from + "T00:00:00Z").getTime();
  const chartData: DayPoint[] = Array.from({ length: nDays }, (_, i) => {
    const iso = isoDay(new Date(fromMs + i * 86400000));
    return {
      date: iso,
      leads: leadsPerDay.get(iso) ?? 0,
      cost: costPerDay.get(iso) ?? 0,
    };
  });

  const periodLabel =
    presetDays === 7
      ? "laatste 7 dagen"
      : presetDays === 30
        ? "laatste 30 dagen"
        : presetDays === 90
          ? "laatste 90 dagen"
          : presetDays === 365
            ? "laatste 12 maanden"
            : `${from} t/m ${to}`;

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">
              Statistieken over de geselecteerde periode ({periodLabel}).
            </p>
          </div>
          <DashboardFilter from={from} to={to} activeDays={presetDays} />
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Aantal leads" value={total} />
          <StatCard
            label="Qualified (score ≥ 40)"
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

        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Marketing
          </h2>
          <AdsSyncButton />
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Ad-spend" value={hasSpend ? eur(spend, 0) : "—"} />
          <StatCard label="Kliks" value={hasSpend ? clicks.toLocaleString("nl-NL") : "—"} />
          <StatCard label="CTL (klik → lead)" value={ctl} tone="erf" />
          <StatCard label="Kosten / lead" value={kostenPerLead} tone="erf" />
          <StatCard
            label="Kosten / qualified"
            value={kostenPerQualified}
            tone="erf"
          />
        </div>

        <div className="mb-5">
          <DashboardChart data={chartData} periodLabel={periodLabel} />
        </div>

        <div className="flex justify-end">
          <Link
            href="/leads"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Bekijk alle leads →
          </Link>
        </div>
      </main>
    </div>
  );
}
