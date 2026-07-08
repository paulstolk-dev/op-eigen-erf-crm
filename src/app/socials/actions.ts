"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateSocialContent } from "@/lib/socials-generate";
import { CONTENT_STATUSSEN, type ContentStatus } from "@/lib/socials";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  return { supabase, user };
}

type Result = { ok: boolean; error?: string };

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "aflevering"
  );
}

/** Genereert `aantal` concept-afleveringen via Claude en zet ze in de queue. */
export async function generateSocials(aantal: number, thema?: string): Promise<Result> {
  const { supabase } = await requireUser();
  try {
    const items = await generateSocialContent(aantal, thema);
    if (items.length === 0) return { ok: false, error: "Geen afleveringen gegenereerd." };

    // Bestaande slugs ophalen om botsingen te vermijden.
    const { data: bestaand } = await supabase.from("content_queue").select("slug");
    const gebruikt = new Set((bestaand ?? []).map((r) => r.slug));

    const rows = items.map((it) => {
      let slug = slugify(it.slug || it.props.titel);
      while (gebruikt.has(slug)) slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
      gebruikt.add(slug);
      return {
        slug,
        props: it.props,
        caption: it.caption,
        status: "concept",
      };
    });

    const { error } = await supabase.from("content_queue").insert(rows);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/socials");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Onbekende fout" };
  }
}

/** Caption / review-notitie / video-URL opslaan. */
export async function saveSocial(
  id: string,
  data: {
    instagram: string;
    youtube_title: string;
    review_notes: string;
    video_url: string;
  },
): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("content_queue")
    .update({
      caption: { instagram: data.instagram, youtube_title: data.youtube_title },
      review_notes: data.review_notes || null,
      video_url: data.video_url || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/socials");
  revalidatePath(`/socials/${id}`);
  return { ok: true };
}

/** Statusovergang (concept → gerenderd → goedgekeurd → ingepland, of terug). */
export async function setSocialStatus(id: string, status: string): Promise<Result> {
  const { supabase } = await requireUser();
  if (!CONTENT_STATUSSEN.includes(status as ContentStatus))
    return { ok: false, error: "Onbekende status." };
  const { error } = await supabase
    .from("content_queue")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/socials");
  revalidatePath(`/socials/${id}`);
  return { ok: true };
}

/** Aflevering verwijderen. */
export async function deleteSocial(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("content_queue").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/socials");
  return { ok: true };
}
