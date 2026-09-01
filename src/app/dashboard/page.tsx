import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { DashboardChart, type DayPoint } from "@/components/dashboard-chart";
import { DashboardFilter } from "@/components/dashboard-filter";
import { AdsSyncButton } from "./ads-sync-button";
import { scoreLead } from "@/lib/lead-score";
import { PARTNER_FUNNEL, PARTNER_STATUS_LABELS } from "@/lib/aanbieders-constants";
import { telPerBron } from "@/lib/lead-bron";
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
      <div className="break-words text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
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

  // Aanbieders: wat staat er live op de site + waar staat de wervingsfunnel.
  const { data: aanbiedersData } = await supabase
    .from("aanbieders")
    .select("actief,partner_status");
  const alleAanbieders = (aanbiedersData ?? []) as {
    actief: boolean;
    partner_status: string;
  }[];
  const aanbiedersLive = alleAanbieders.filter((a) => a.actief).length;
  const funnelTelling = (s: string) =>
    alleAanbieders.filter((a) => a.partner_status === s).length;

  // Modellen die daadwerkelijk op de site staan: actief model bij actieve aanbieder.
  const { count: modellenLive } = await supabase
    .from("woningen")
    .select("id, aanbieders!inner(actief)", { count: "exact", head: true })
    .eq("actief", true)
    .eq("aanbieders.actief", true);
  const erfscanByLead = new Map<string, Erfscan>(
    (erfscans ?? []).map((e) => [e.lead_id, e as Erfscan]),
  );

  // Alleen erfcheck-leads binnen de gekozen periode meetellen (besluit-alerts
  // en andere niet-erfcheck-types tellen niet mee in de statistieken). Handmatig
  // uitgesloten test-leads (excluded_from_stats) tellen ook niet mee.
  const rows = (leads ?? [])
    .filter(
      (lead) =>
        lead.type === "erfcheck" &&
        !lead.excluded_from_stats &&
        inRange(lead.created_at),
    )
    .map((lead) => {
      const erfscan = erfscanByLead.get(lead.id) ?? null;
      return { lead: lead as Lead, erfscan, score: scoreLead(lead as Lead, erfscan) };
    });

  const total = rows.length;
  const qualified = rows.filter((r) => r.score.score >= 40).length;
  const gewonnen = rows.filter((r) => r.lead.status === "gewonnen").length;
  const verloren = rows.filter((r) => r.lead.status === "verloren").length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  // Vervolgaanvragen in dezelfde periode: het kennismakingsgesprek en de betaalde
  // haalbaarheidsscan zijn de twee conversiedoelen van de erfcheck-opvolging.
  const aanvragenVanType = (type: string) =>
    (leads ?? []).filter(
      (l) => l.type === type && !l.excluded_from_stats && inRange(l.created_at),
    ).length;
  const gesprekken = aanvragenVanType("kennismaking");
  const scans = aanvragenVanType("haalbaarheidsscan");

  // Via welk kanaal kwamen de leads binnen (Google Ads, organisch, ChatGPT, …).
  // Zelfde set als de kaart 'Aantal leads', zodat de totalen op elkaar aansluiten.
  const bronnen = telPerBron(rows.map((r) => r.lead));
  const bronMax = Math.max(1, ...bronnen.map((b) => b.aantal));

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

  // Besluit-alert-leads (grijs in de grafiek). Niet dubbel tellen: is hetzelfde
  // e-mailadres óók een erfcheck-lead, dan telt alleen de erfcheck-lead.
  const erfcheckEmails = new Set(
    (leads ?? [])
      .filter((l) => l.type === "erfcheck" && l.email)
      .map((l) => l.email!.toLowerCase()),
  );
  const besluitPerDay = new Map<string, number>();
  for (const l of leads ?? []) {
    if (l.type !== "besluit-alert" || l.excluded_from_stats) continue;
    if (!inRange(l.created_at)) continue;
    if (l.email && erfcheckEmails.has(l.email.toLowerCase())) continue;
    const d = (l.created_at ?? "").slice(0, 10);
    if (d) besluitPerDay.set(d, (besluitPerDay.get(d) ?? 0) + 1);
  }

  // Kennismakingsgesprek-aanvragen (het conversiedoel van de erfcheck-opvolging).
  // Niet ontdubbeld tegen de erfcheck-lead: het gesprek ís juist de conversie van
  // die lead en hoort als eigen gebeurtenis op z'n eigen dag zichtbaar te zijn.
  const gesprekPerDay = new Map<string, number>();
  for (const l of leads ?? []) {
    if (l.type !== "kennismaking" || l.excluded_from_stats) continue;
    if (!inRange(l.created_at)) continue;
    const d = (l.created_at ?? "").slice(0, 10);
    if (d) gesprekPerDay.set(d, (gesprekPerDay.get(d) ?? 0) + 1);
  }

  const fromMs = new Date(from + "T00:00:00Z").getTime();
  const chartData: DayPoint[] = Array.from({ length: nDays }, (_, i) => {
    const iso = isoDay(new Date(fromMs + i * 86400000));
    return {
      date: iso,
      leads: leadsPerDay.get(iso) ?? 0,
      besluit: besluitPerDay.get(iso) ?? 0,
      gesprek: gesprekPerDay.get(iso) ?? 0,
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

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
          <StatCard
            label="Gesprekken"
            value={gesprekken}
            sub={`${pct(gesprekken)}%`}
            tone="groen"
          />
          <StatCard
            label="Haalbaarheidsscans"
            value={scans}
            sub={`${pct(scans)}%`}
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

        {/* Waar komen de leads vandaan: het kanaal dat de bezoeker naar de site
            bracht (UTM/gclid/referrer), niet het formulier waar hij invulde. */}
        <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Leads per bron</h2>
          <p className="mt-0.5 mb-3 text-xs text-slate-500">
            Kanaal waarlangs de bezoeker binnenkwam ({periodLabel}). Afgeleid uit
            UTM-tags, de Google-klik-id en de verwijzende site.{" "}
            <strong>Direct</strong> = geen herkomst meegegeven (ingetypt, bookmark of
            referrer weggevallen).
          </p>
          {bronnen.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">
              Geen leads in deze periode.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {bronnen.map((b) => (
                <li key={b.bron} className="flex items-center gap-3">
                  <span
                    className="min-w-0 flex-1 truncate text-sm text-slate-700 sm:w-44 sm:flex-none"
                    title={b.bron}
                  >
                    {b.bron}
                  </span>
                  {/* Balk alleen waar er ruimte voor is; op mobiel telt de lijst zelf. */}
                  <span className="hidden h-2 flex-1 overflow-hidden rounded-full bg-slate-100 sm:block">
                    <span
                      className="block h-full rounded-full bg-navy/70"
                      style={{ width: `${(b.aantal / bronMax) * 100}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right text-sm font-semibold text-slate-900">
                    {b.aantal}
                  </span>
                  <span className="w-12 shrink-0 text-right text-xs text-slate-400">
                    {pct(b.aantal)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Aanbieders: aanbod op de site + de wervingsfunnel (altijd actueel,
            niet afhankelijk van de gekozen periode). */}
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Aanbieders
          </h2>
          <Link
            href="/aanbieders/partners"
            className="text-xs font-medium text-navy hover:underline"
          >
            Naar de funnel →
          </Link>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Aanbieders live" value={aanbiedersLive} />
          <StatCard label="Modellen live" value={modellenLive ?? 0} />
          {PARTNER_FUNNEL.map((s, i) => (
            <StatCard
              key={s}
              label={`${i + 1}. ${PARTNER_STATUS_LABELS[s]}`}
              value={funnelTelling(s)}
              tone={s === "partner" ? "groen" : undefined}
            />
          ))}
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
