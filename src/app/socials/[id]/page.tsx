import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RegelgevingProps, Caption } from "@/lib/socials";
import type { ContentQueueItem } from "@/lib/database.types";
import { SocialReview } from "./review";
import { PropsEditor } from "./props-editor";

export const dynamic = "force-dynamic";

export default async function SocialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_queue")
    .select("*")
    .eq("id", id)
    .maybeSingle<ContentQueueItem>();
  if (!data) notFound();

  const props = data.props as unknown as RegelgevingProps;
  const caption = data.caption as unknown as Caption;

  return (
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
        />
      </div>
    </main>
  );
}
