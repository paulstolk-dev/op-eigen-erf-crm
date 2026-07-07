import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/app-header";
import { euro } from "@/lib/aanbieders-constants";
import { FotoGrid } from "./foto-grid";
import { PublishBar } from "./publish-bar";
import type { Aanbieder, Woning, ScrapeAfbeelding } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function ResearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: aanbieder } = await admin
    .from("aanbieders")
    .select("*")
    .eq("id", id)
    .single<Aanbieder>();
  if (!aanbieder) notFound();

  const { data: woningenData } = await admin
    .from("woningen")
    .select("*")
    .eq("aanbieder_id", id)
    .order("naam", { ascending: true });
  const woningen = (woningenData ?? []) as Woning[];

  const { data: fotoData } = await admin
    .from("scrape_afbeeldingen")
    .select("*")
    .eq("aanbieder_id", id);
  const fotos = (fotoData ?? []) as ScrapeAfbeelding[];

  // Signed URLs voor de privé kandidaatfoto's.
  const paden = fotos.map((f) => f.storage_path).filter((p): p is string => Boolean(p));
  const urlByPath = new Map<string, string>();
  if (paden.length) {
    const { data: signed } = await admin.storage
      .from("aanbieder-scrape")
      .createSignedUrls(paden, 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }
  const fotosByWoning = new Map<string, { id: string; url: string | null; gekozen: boolean }[]>();
  for (const f of fotos) {
    if (!f.woning_id) continue;
    const arr = fotosByWoning.get(f.woning_id) ?? [];
    arr.push({
      id: f.id,
      url: f.storage_path ? urlByPath.get(f.storage_path) ?? null : null,
      gekozen: f.gekozen,
    });
    fotosByWoning.set(f.woning_id, arr);
  }

  const domein = aanbieder.website_url
    ? new URL(aanbieder.website_url).hostname.replace(/^www\./, "")
    : null;

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Link href="/aanbieders/research" className="text-sm text-slate-500 hover:text-navy">
          ← Terug naar research
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{aanbieder.naam}</h1>
            <div className="mt-1 text-sm text-slate-500">
              {aanbieder.website_url ? (
                <a href={aanbieder.website_url} target="_blank" rel="noreferrer" className="hover:underline">
                  {domein}
                </a>
              ) : (
                "—"
              )}
              {aanbieder.prijspeil ? ` · prijspeil ${aanbieder.prijspeil}` : ""}
            </div>
          </div>
          <PublishBar aanbiederId={aanbieder.id} />
        </div>

        {aanbieder.beschrijving && (
          <p className="mt-3 max-w-2xl text-sm text-slate-600">{aanbieder.beschrijving}</p>
        )}

        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">
          Modellen ({woningen.length})
        </h2>
        <div className="space-y-4">
          {woningen.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
              Geen modellen geëxtraheerd.
            </div>
          )}
          {woningen.map((w) => (
            <div key={w.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium text-slate-900">{w.naam}</h3>
                <div className="text-sm text-slate-500">
                  {w.oppervlakte_m2 ? `${w.oppervlakte_m2} m²` : "opp. n.b."}
                  {w.slaapkamers != null ? ` · ${w.slaapkamers} slk` : ""}
                  {w.prijs_incl_btw != null
                    ? ` · ${w.is_vanaf_prijs ? "vanaf " : ""}${euro(w.prijs_incl_btw)}`
                    : " · prijs op aanvraag"}
                </div>
              </div>
              {w.beschrijving && (
                <p className="mt-1 text-sm text-slate-600">{w.beschrijving}</p>
              )}
              {w.bron_url && (
                <a
                  href={w.bron_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-slate-400 hover:underline"
                >
                  bron »
                </a>
              )}
              <div className="mt-3">
                <FotoGrid fotos={fotosByWoning.get(w.id) ?? []} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
