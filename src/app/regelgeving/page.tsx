import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { ReviewButtons } from "./review-buttons";
import { AnalysePanel } from "./analyse-panel";

export const dynamic = "force-dynamic";

type Wijziging = {
  id: string;
  gemeente_slug: string;
  artikel: string;
  type: string;
  bron_url: string | null;
  review_status: string;
  created_at: string;
  delta: {
    zekerheid?: string;
    signalen?: string[];
    analyse?: {
      omgevingsplan_status: string;
      afwijking_richting: string;
      afwijking_samenvatting: string;
      kernparameters?: { label: string; waarde: string }[];
      citaten?: string[];
    };
  } | null;
};

type Gemeente = {
  slug: string;
  naam: string;
  dso_laatst_gepolld: string | null;
  dso_ontwerp_aanwezig: boolean;
  omgevingsplan_status: string | null;
  research_status: string;
};

const TYPE_LABEL: Record<string, string> = {
  ontwerp_nieuw: "Ontwerp (nieuw)",
  ontwerp_gewijzigd: "Ontwerp (gewijzigd)",
  vastgesteld_gewijzigd: "Vastgesteld",
  artikel_verdwenen: "Verplaatst / vervallen",
  onbekend: "Onbekend",
};
const TYPE_STYLE: Record<string, string> = {
  artikel_verdwenen: "bg-red-100 text-red-700 ring-red-600/20",
  vastgesteld_gewijzigd: "bg-blue-100 text-blue-800 ring-blue-600/20",
  ontwerp_nieuw: "bg-violet-100 text-violet-800 ring-violet-600/20",
  ontwerp_gewijzigd: "bg-violet-100 text-violet-800 ring-violet-600/20",
  onbekend: "bg-slate-100 text-slate-600 ring-slate-400/20",
};

function datumNL(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function RegelgevingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Leest via de user-context (RLS: CRM-allowlist mag deze tabellen lezen) — geen
  // service-role key nodig.
  const { data: wRaw } = await (supabase as any)
    .from("gemeente_wijzigingen")
    .select("*")
    .order("created_at", { ascending: false });
  const { data: gRaw } = await (supabase as any)
    .from("gemeenten")
    .select("*")
    .order("naam", { ascending: true });

  const wijzigingen = (wRaw ?? []) as Wijziging[];
  const gemeenten = (gRaw ?? []) as Gemeente[];
  const naamVan = new Map(gemeenten.map((g) => [g.slug, g.naam]));
  const wijzPerGemeente = new Map<string, number>();
  for (const w of wijzigingen)
    wijzPerGemeente.set(w.gemeente_slug, (wijzPerGemeente.get(w.gemeente_slug) ?? 0) + 1);

  // Nieuw eerst, dan op datum.
  const rangschik = { nieuw: 0, verwerkt: 1, afgewezen: 2 } as Record<string, number>;
  const signalen = [...wijzigingen].sort(
    (a, b) =>
      (rangschik[a.review_status] ?? 9) - (rangschik[b.review_status] ?? 9) ||
      b.created_at.localeCompare(a.created_at),
  );
  const nieuwCount = wijzigingen.filter((w) => w.review_status === "nieuw").length;
  const bewaakt = gemeenten.filter((g) => g.research_status !== "niet_onderzocht").length;

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Regelgeving</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitoring van gemeentelijke wijzigingen in de vergunningvrij-regels voor
            bijbehorende bouwwerken (bruidsschat). De poller signaleert; jij beoordeelt
            en werkt de content bij.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
            Nieuwe signalen <span className="font-bold">{nieuwCount}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-400/20">
            Gemeenten bewaakt <span className="font-bold">{bewaakt}</span>
          </span>
        </div>

        {/* Signalen */}
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Gesignaleerde wijzigingen</h2>
        <div className="mb-8 space-y-3">
          {signalen.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
              Nog geen gesignaleerde wijzigingen.
            </div>
          )}
          {signalen.map((w) => {
            const zekerheid = w.delta?.zekerheid;
            const sig = w.delta?.signalen ?? [];
            return (
              <div key={w.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {naamVan.get(w.gemeente_slug) ?? w.gemeente_slug}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TYPE_STYLE[w.type] ?? TYPE_STYLE.onbekend}`}
                      >
                        {TYPE_LABEL[w.type] ?? w.type}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm text-slate-600">
                      Vindplaats <span className="font-medium text-slate-800">{w.artikel}</span>
                      {zekerheid && (
                        <span
                          className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            zekerheid === "hoog" ? "bg-navy/10 text-navy" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {zekerheid}
                        </span>
                      )}
                      {" · "}
                      {datumNL(w.created_at)}
                      {w.bron_url && (
                        <>
                          {" · "}
                          <a href={w.bron_url} target="_blank" rel="noreferrer" className="text-navy hover:underline">
                            bron ↗
                          </a>
                        </>
                      )}
                    </div>
                    {sig.length > 0 && (
                      <div className="mt-1 text-xs text-slate-400">{sig.join(", ")}</div>
                    )}
                  </div>
                  <ReviewButtons id={w.id} status={w.review_status} />
                </div>
                <AnalysePanel
                  id={w.id}
                  gemeenteSlug={w.gemeente_slug}
                  artikel={w.artikel}
                  initial={w.delta?.analyse ?? null}
                />
              </div>
            );
          })}
        </div>

        {/* Gemeenten */}
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Bewaakte gemeenten</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Gemeente</th>
                <th className="px-4 py-3 font-medium">Laatst gecontroleerd</th>
                <th className="px-4 py-3 font-medium">Ontwerp open</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Status</th>
                <th className="px-4 py-3 font-medium">Signalen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gemeenten.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    Nog geen gemeenten geseed.
                  </td>
                </tr>
              )}
              {gemeenten.map((g) => (
                <tr key={g.slug} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{g.naam}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {datumNL(g.dso_laatst_gepolld)}
                  </td>
                  <td className="px-4 py-3">
                    {g.dso_ontwerp_aanwezig ? (
                      <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-inset ring-violet-600/20">
                        Ja
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                    {g.omgevingsplan_status || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {wijzPerGemeente.get(g.slug) ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
