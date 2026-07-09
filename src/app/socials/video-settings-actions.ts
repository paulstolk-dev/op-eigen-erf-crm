"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSetting, setSetting } from "@/lib/settings";
import {
  VIDEO_SETTINGS_KEY,
  parseVideoSettings,
  type VideoSettings,
} from "@/lib/video-settings";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
}

type Result = { ok: boolean; error?: string };

/** Video-instellingen opslaan (één JSON in app_settings.video_settings). */
export async function saveVideoSettings(settings: VideoSettings): Promise<Result> {
  await requireUser();
  try {
    const current = parseVideoSettings(await getSetting(VIDEO_SETTINGS_KEY));
    await setSetting(VIDEO_SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
    revalidatePath("/socials");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Onbekende fout" };
  }
}

/** Logo uploaden naar de 'socials'-bucket (_assets/logo.<ext>) en in de settings zetten. */
export async function uploadVideoLogo(
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  await requireUser();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Geen bestand gekozen." };
  if (file.size > 3_000_000) return { ok: false, error: "Bestand te groot (max 3 MB)." };

  const type = file.type || "image/png";
  const ext = type.includes("svg")
    ? "svg"
    : type.includes("webp")
      ? "webp"
      : type.includes("jpeg") || type.includes("jpg")
        ? "jpg"
        : "png";
  const path = `_assets/logo.${ext}`;

  try {
    const admin = createAdminClient();
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage.from("socials").upload(path, bytes, {
      contentType: type,
      upsert: true,
      cacheControl: "0",
    });
    if (error) return { ok: false, error: error.message };

    const { data: pub } = admin.storage.from("socials").getPublicUrl(path);
    const url = `${pub.publicUrl}?v=${Date.now()}`;

    const current = parseVideoSettings(await getSetting(VIDEO_SETTINGS_KEY));
    await setSetting(
      VIDEO_SETTINGS_KEY,
      JSON.stringify({ ...current, logoPath: path, logoUrl: url }),
    );
    revalidatePath("/socials");
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload mislukt" };
  }
}

/** Logo verwijderen uit de settings (bestand blijft in de bucket, wordt genegeerd). */
export async function clearVideoLogo(): Promise<Result> {
  await requireUser();
  try {
    const current = parseVideoSettings(await getSetting(VIDEO_SETTINGS_KEY));
    await setSetting(
      VIDEO_SETTINGS_KEY,
      JSON.stringify({ ...current, logoPath: null, logoUrl: null }),
    );
    revalidatePath("/socials");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Onbekende fout" };
  }
}
