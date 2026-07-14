"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSocialContent, generateArtikelSocial } from "@/lib/socials-generate";
import { setSetting, SETTING_KEYS } from "@/lib/settings";
import { CONTENT_STATUSSEN, regelgevingSchema, type ContentStatus } from "@/lib/socials";

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

/** Master-prompt voor de per-artikel video-generatie opslaan (app_settings). */
export async function saveArtikelPrompt(prompt: string): Promise<Result> {
  await requireUser();
  if (!prompt.trim()) return { ok: false, error: "Prompt mag niet leeg zijn." };
  try {
    await setSetting(SETTING_KEYS.socialsArtikelPrompt, prompt.trim());
    revalidatePath("/socials");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Opslaan mislukt." };
  }
}

/**
 * Genereert één video-aflevering (tekstlaag + 3 Veo-b-roll-prompts + captions)
 * voor een specifiek artikel en zet die als concept in de queue. De zware
 * beeld-/render-stappen (Veo + Remotion) draaien daarna op de renderworker.
 */
export async function generateArtikelVideo(artikelId: string): Promise<Result> {
  await requireUser();
  const admin = createAdminClient();
  const { data: artikel } = await admin
    .from("artikelen")
    .select("id, titel, samenvatting, beschrijving, categorie")
    .eq("id", artikelId)
    .maybeSingle();
  if (!artikel) return { ok: false, error: "Artikel niet gevonden." };
  try {
    const gen = await generateArtikelSocial(artikel);
    // Slug uniek maken t.o.v. de queue.
    let slug = slugify(gen.slug || gen.props.titel);
    const { data: bestaand } = await admin.from("content_queue").select("slug");
    const gebruikt = new Set((bestaand ?? []).map((r) => r.slug));
    while (gebruikt.has(slug)) slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
    // Bestandspaden in de broll uitlijnen op de definitieve slug.
    const broll = gen.broll.map((s) => ({ ...s, bestand: `broll/${slug}-${s.shot}.mp4` }));

    const { error } = await admin.from("content_queue").insert({
      slug,
      props: gen.props,
      caption: gen.caption,
      broll,
      artikel_id: artikel.id,
      status: "concept",
      broll_status: "geen",
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/socials");
    revalidatePath("/website");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Generatie mislukt." };
  }
}

/**
 * Start een render op de Railway-renderserver. Die haalt zelf alle
 * concept-afleveringen uit de content_queue, rendert ze, uploadt de mp4 naar de
 * 'socials'-bucket en zet status → gerenderd + video_url.
 */
export async function triggerVideoRender(): Promise<Result> {
  await requireUser();
  const endpoint = process.env.VIDEO_RENDER_ENDPOINT;
  const secret = process.env.VIDEO_RENDER_SECRET;
  if (!endpoint || !secret) {
    return { ok: false, error: "VIDEO_RENDER_ENDPOINT/VIDEO_RENDER_SECRET niet gezet." };
  }
  try {
    const res = await fetch(`${endpoint.replace(/\/$/, "")}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-render-secret": secret },
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        error: `Renderserver ${res.status}: ${JSON.stringify(data).slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Renderserver onbereikbaar." };
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

/**
 * De video-opzet (props) aanpassen na AI-generatie. Valideert tegen het
 * template-contract (regelgevingSchema) en zet de status terug op 'concept',
 * omdat een eventueel gerenderde video na een wijziging verouderd is.
 */
export async function saveProps(id: string, props: unknown): Promise<Result> {
  const { supabase } = await requireUser();
  const parsed = regelgevingSchema.safeParse(props);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 300),
    };
  }
  const { error } = await supabase
    .from("content_queue")
    .update({ props: parsed.data, status: "concept" })
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
