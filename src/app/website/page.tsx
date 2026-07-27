import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/app-header";
import type { Artikel } from "@/lib/database.types";
import {
  WebsiteLijst,
  type PaginaSeoRow,
  type ArtikelRow,
} from "./website-lijst";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  gepubliceerd: "bg-green-100 text-green-800 ring-green-600/20",
  concept: "bg-slate-100 text-slate-600 ring-slate-400/20",
  gearchiveerd: "bg-amber-100 text-amber-800 ring-amber-600/20",
};

export default async function WebsitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data } = await admin
    .from("artikelen")
    .select("*")
    .order("publicatiedatum", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  const artikelen = (data ?? []) as Artikel[];

  // Per-pagina SEO-overrides (titel + meta-description) voor de statische pagina's.
  const { data: seoData } = await admin
    .from("pagina_seo")
    .select("pad, seo_titel, meta_description, updated_at")
    .order("pad", { ascending: true });
  const seoRows = (seoData ?? []) as PaginaSeoRow[];

  // Gekoppelde video-afleveringen (per artikel) uit de content-queue — we linken
  // enkel naar de social content op /socials; de details staan daar.
  type Afl = { id: string; artikel_id: string | null };
  const artikelIds = artikelen.map((a) => a.id);
  let afleveringen: Afl[] = [];
  if (artikelIds.length) {
    const { data: aflData } = await admin
      .from("content_queue")
      .select("id, artikel_id")
      .in("artikel_id", artikelIds)
      .order("created_at", { ascending: false });
    afleveringen = (aflData ?? []) as Afl[];
  }
  const eersteAflevering = new Map<string, string>();
  for (const r of afleveringen) {
    if (!r.artikel_id || eersteAflevering.has(r.artikel_id)) continue;
    eersteAflevering.set(r.artikel_id, r.id);
  }

  const artikelRijen: ArtikelRow[] = artikelen.map((a) => ({
    id: a.id,
    titel: a.titel,
    slug: a.slug,
    seo_titel: a.seo_titel,
    beschrijving: a.beschrijving,
    categorie: a.categorie,
    status: a.status,
    publicatiedatum: a.publicatiedatum,
    afbeelding_url: a.afbeelding_url,
    content_processed: a.content_processed,
    afleveringId: eersteAflevering.get(a.id) ?? null,
  }));

  const telling = (s: string) => artikelen.filter((a) => a.status === s).length;

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-slate-900">Website</h1>
          <p className="mt-1 text-sm text-slate-500">
            Alles per pagina op één plek: SEO-titel + meta-description, en per
            artikel ook de uitgelichte afbeelding en de social content.
          </p>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {["gepubliceerd", "concept", "gearchiveerd"].map((s) => (
            <span
              key={s}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                STATUS_STYLE[s] ?? STATUS_STYLE.concept
              }`}
            >
              {s}
              <span className="font-bold">{telling(s)}</span>
            </span>
          ))}
        </div>

        <WebsiteLijst seoRows={seoRows} artikelen={artikelRijen} />
      </main>
    </div>
  );
}
