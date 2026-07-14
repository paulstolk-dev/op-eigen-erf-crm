import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/app-header";
import type { Artikel } from "@/lib/database.types";
import { ArtikelAfbeelding } from "./artikel-afbeelding";
import { ArtikelContent } from "./artikel-content";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  gepubliceerd: "bg-green-100 text-green-800 ring-green-600/20",
  concept: "bg-slate-100 text-slate-600 ring-slate-400/20",
  gearchiveerd: "bg-amber-100 text-amber-800 ring-amber-600/20",
};

function datumNL(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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

  // Gekoppelde video-afleveringen (per artikel) uit de content-queue.
  type Afl = {
    id: string;
    slug: string;
    status: string;
    broll_status: string;
    video_url: string | null;
    video_url_landscape: string | null;
    artikel_id: string | null;
  };
  const artikelIds = artikelen.map((a) => a.id);
  let afleveringen: Afl[] = [];
  if (artikelIds.length) {
    const { data: aflData } = await admin
      .from("content_queue")
      .select("id, slug, status, broll_status, video_url, video_url_landscape, artikel_id")
      .in("artikel_id", artikelIds)
      .order("created_at", { ascending: false });
    afleveringen = (aflData ?? []) as Afl[];
  }
  const aflByArtikel = new Map<string, Afl[]>();
  for (const r of afleveringen) {
    if (!r.artikel_id) continue;
    const arr = aflByArtikel.get(r.artikel_id) ?? [];
    arr.push(r);
    aflByArtikel.set(r.artikel_id, arr);
  }

  const telling = (s: string) => artikelen.filter((a) => a.status === s).length;

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-slate-900">Website — artikelen</h1>
          <p className="mt-1 text-sm text-slate-500">
            Alle kennisbank-artikelen uit Supabase. Voeg per artikel een uitgelichte
            afbeelding toe.
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

        {artikelen.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Nog geen artikelen.
          </div>
        ) : (
          <ul className="space-y-2">
            {artikelen.map((a) => (
              <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <ArtikelAfbeelding artikelId={a.id} url={a.afbeelding_url} />
                  <div className="min-w-[14rem] flex-1">
                    <p className="text-sm font-semibold text-slate-900">{a.titel}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {a.categorie ?? "—"} · {datumNL(a.publicatiedatum)}
                      {a.slug ? ` · /${a.slug}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                      a.content_processed
                        ? "bg-green-100 text-green-800 ring-green-600/20"
                        : "bg-slate-100 text-slate-500 ring-slate-400/20"
                    }`}
                  >
                    {a.content_processed ? "✓ verwerkt" : "niet verwerkt"}
                  </span>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                      STATUS_STYLE[a.status] ?? STATUS_STYLE.concept
                    }`}
                  >
                    {a.status}
                  </span>
                </div>

                <details className="mt-1">
                  <summary className="cursor-pointer text-xs font-medium text-navy hover:underline">
                    Content (video + socials)
                  </summary>
                  <ArtikelContent
                    artikelId={a.id}
                    initial={{
                      content_processed: a.content_processed,
                      ytvideo_url: a.ytvideo_url ?? "",
                      instareel_url: a.instareel_url ?? "",
                      instapost_tekst: a.instapost_tekst ?? "",
                      yt_post_tekst: a.yt_post_tekst ?? "",
                    }}
                  />

                  {(aflByArtikel.get(a.id) ?? []).length > 0 && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Video-afleveringen
                      </p>
                      <ul className="space-y-2">
                        {(aflByArtikel.get(a.id) ?? []).map((r) => (
                          <li
                            key={r.id}
                            className="flex flex-wrap items-center gap-2.5 text-sm text-slate-700"
                          >
                            <span className="font-medium text-slate-900">{r.slug}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {r.status}
                            </span>
                            {r.broll_status !== "geen" && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                                b-roll: {r.broll_status}
                              </span>
                            )}
                            {r.video_url ? (
                              <a
                                href={r.video_url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-navy hover:bg-slate-50"
                              >
                                9:16 ↓
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">9:16 —</span>
                            )}
                            {r.video_url_landscape ? (
                              <a
                                href={r.video_url_landscape}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-navy hover:bg-slate-50"
                              >
                                16:9 ↓
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">16:9 —</span>
                            )}
                            <a
                              href={`/socials/${r.id}`}
                              className="text-xs font-medium text-slate-500 hover:underline"
                            >
                              bewerken →
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </details>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
