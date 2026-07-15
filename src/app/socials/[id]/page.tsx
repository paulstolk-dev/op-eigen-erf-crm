import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/app-header";
import type { RegelgevingProps, Caption } from "@/lib/socials";
import type { ContentQueueItem, Artikel } from "@/lib/database.types";
import { SocialReview } from "./review";
import { PropsEditor } from "./props-editor";
import { ArtikelFields } from "./artikel-fields";

export const dynamic = "force-dynamic";

export default async function SocialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("content_queue")
    .select("*")
    .eq("id", id)
    .maybeSingle<ContentQueueItem>();
  if (!data) notFound();

  const props = data.props as unknown as RegelgevingProps;
  const caption = data.caption as unknown as Caption;

  // Gekoppeld artikel (indien aanwezig) — de social-uitwerkingen bewerken we hier.
  let artikel: Artikel | null = null;
  if (data.artikel_id) {
    const admin = createAdminClient();
    const { data: a } = await admin
      .from("artikelen")
      .select("*")
      .eq("id", data.artikel_id)
      .maybeSingle<Artikel>();
    artikel = a ?? null;
  }

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/socials" className="text-sm text-slate-500 hover:text-navy">
        ← Terug naar Socials
      </Link>

      <div className="mt-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-erf">
            {props?.kicker}
          </span>
          {props?.nogNietDefinitief && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
              ⚠ nog niet definitief
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{props?.titel || data.slug}</h1>
        <p className="mt-1 text-xs text-slate-400">
          {data.slug} · bron: {props?.bron} · bijgewerkt {props?.laatstBijgewerkt}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Script + video (review-materiaal) */}
        <div className="space-y-5">
          {data.video_url ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={data.video_url} controls className="mx-auto max-h-[70vh]" />
            </div>
          ) : (
            <div className="flex aspect-[9/16] max-h-[70vh] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-400">
              Nog geen video gerenderd.
              <br />
              Render met het Remotion-project (map <code>video/</code>).
            </div>
          )}

          {(data.video_url || data.video_url_landscape) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500">Download:</span>
              {data.video_url && (
                <a
                  href={data.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-slate-300 px-2.5 py-1 font-medium text-navy hover:bg-slate-50"
                >
                  9:16 (short/reel) ↓
                </a>
              )}
              {data.video_url_landscape && (
                <a
                  href={data.video_url_landscape}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-slate-300 px-2.5 py-1 font-medium text-navy hover:bg-slate-50"
                >
                  16:9 (YouTube) ↓
                </a>
              )}
            </div>
          )}

          <PropsEditor id={data.id} props={props} />
        </div>

        {/* Review-acties */}
        <SocialReview
          id={data.id}
          status={data.status}
          instagram={caption?.instagram ?? ""}
          youtubeTitle={caption?.youtube_title ?? ""}
          videoUrl={data.video_url ?? ""}
          reviewNotes={data.review_notes ?? ""}
          hideCaption={!!artikel}
        />
      </div>

      {artikel && (
        <div className="mt-6">
          <ArtikelFields
            afleveringId={data.id}
            artikelId={artikel.id}
            artikelTitel={artikel.titel}
            initial={{
              content_processed: artikel.content_processed,
              ytvideo_url: artikel.ytvideo_url ?? "",
              instareel_url: artikel.instareel_url ?? "",
              // Instagram-tekst: val terug op de gegenereerde caption als het
              // artikelveld nog leeg is (de inhoud van de oude "Instagram-caption").
              instapost_tekst: artikel.instapost_tekst ?? caption?.instagram ?? "",
              youtube_title: caption?.youtube_title ?? "",
              yt_post_tekst: artikel.yt_post_tekst ?? "",
            }}
          />
        </div>
      )}
      </main>
    </div>
  );
}
