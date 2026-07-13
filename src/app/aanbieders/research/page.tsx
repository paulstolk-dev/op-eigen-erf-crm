import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/app-header";
import { ZoekKnop } from "./zoek-knop";
import { ScrapeUrl } from "./scrape-url";
import {
  SCRAPE_REVIEW_STATUS,
  SCRAPE_REVIEW_STATUS_LABELS,
  SCRAPE_REVIEW_STATUS_STYLES,
  hostnameOf,
} from "@/lib/aanbieders-constants";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  naam: string;
  website_url: string | null;
  review_status: string;
  bron: string | null;
};

export default async function ResearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  // Gescrapete concept-aanbieders (bron='scrape') + bestaande aanbieders waaronder
  // een refresh-scrape concept-modellen/foto's heeft gestaged (die hebben
  // scrape_afbeeldingen). Zo verschijnt bv. Mevena hier na "Modellen bijwerken via scrape".
  const [{ data: scrapeAanb }, { data: fotoAanbRows }] = await Promise.all([
    admin
      .from("aanbieders")
      .select("id,naam,website_url,review_status,bron")
      .eq("bron", "scrape"),
    admin.from("scrape_afbeeldingen").select("aanbieder_id"),
  ]);
  const scrapeIds = new Set((scrapeAanb ?? []).map((a) => a.id));
  const extraIds = [
    ...new Set(
      (fotoAanbRows ?? []).map((f) => f.aanbieder_id).filter(Boolean) as string[],
    ),
  ].filter((x) => !scrapeIds.has(x));
  let extra: Row[] = [];
  if (extraIds.length) {
    const { data } = await admin
      .from("aanbieders")
      .select("id,naam,website_url,review_status,bron")
      .in("id", extraIds);
    extra = (data ?? []) as Row[];
  }
  const rows = [...((scrapeAanb ?? []) as Row[]), ...extra];

  // Aantallen modellen/foto's per gescrapete aanbieder.
  const ids = rows.map((r) => r.id);
  const modelCount = new Map<string, number>();
  const fotoCount = new Map<string, number>();
  if (ids.length) {
    const [{ data: woningen }, { data: fotos }] = await Promise.all([
      // Alleen concept-modellen (actief=false) tellen — dat is wat er te beoordelen valt.
      admin.from("woningen").select("aanbieder_id").eq("actief", false).in("aanbieder_id", ids),
      admin.from("scrape_afbeeldingen").select("aanbieder_id").in("aanbieder_id", ids),
    ]);
    for (const w of woningen ?? [])
      modelCount.set(w.aanbieder_id!, (modelCount.get(w.aanbieder_id!) ?? 0) + 1);
    for (const f of fotos ?? [])
      if (f.aanbieder_id)
        fotoCount.set(f.aanbieder_id, (fotoCount.get(f.aanbieder_id) ?? 0) + 1);
  }

  // Nieuw eerst.
  const orde: Record<string, number> = { nieuw: 0, ok: 1, afgewezen: 2 };
  rows.sort((a, b) => (orde[a.review_status] ?? 9) - (orde[b.review_status] ?? 9));
  const telling = (s: string) => rows.filter((r) => r.review_status === s).length;

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Link href="/aanbieders" className="text-sm text-slate-500 hover:text-navy">
          ← Terug naar aanbieders
        </Link>
        <div className="mb-5 mt-2">
          <h1 className="text-lg font-semibold text-slate-900">Research — nieuwe aanbieders</h1>
          <p className="text-sm text-slate-500">
            Gescrapete concept-aanbieders + modellen ter beoordeling. Publiceren zet ze live op
            de site; foto&apos;s blijven privé tot je ze kiest.
          </p>
        </div>

        <div className="mb-5 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Automatisch zoeken
            </p>
            <ZoekKnop />
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Specifieke website scrapen
            </p>
            <ScrapeUrl />
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3">
          {SCRAPE_REVIEW_STATUS.map((s) => (
            <div key={s} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {SCRAPE_REVIEW_STATUS_LABELS[s]}
              </div>
              <div className="mt-1 text-xl font-semibold text-slate-900">{telling(s)}</div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Aanbieder</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Website</th>
                <th className="px-4 py-3 font-medium">Modellen</th>
                <th className="px-4 py-3 font-medium">Foto&apos;s</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    Nog geen gescrapete aanbieders. Klik &quot;Zoek nieuwe aanbieders&quot;.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/aanbieders/research/${r.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {r.naam}
                    </Link>
                    {r.bron !== "scrape" && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        bestaand
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                    {hostnameOf(r.website_url)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{modelCount.get(r.id) ?? 0}</td>
                  <td className="px-4 py-3 text-slate-600">{fotoCount.get(r.id) ?? 0}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        SCRAPE_REVIEW_STATUS_STYLES[r.review_status] ??
                        SCRAPE_REVIEW_STATUS_STYLES.nieuw
                      }`}
                    >
                      {SCRAPE_REVIEW_STATUS_LABELS[r.review_status] ?? r.review_status}
                    </span>
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
