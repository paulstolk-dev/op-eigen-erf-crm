"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireCrm() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  const { data: allowed } = await supabase.rpc("is_allowed_user");
  if (allowed !== true) throw new Error("Alleen CRM-beheerders.");
}

type Result = { ok: boolean; url?: string; error?: string };

/** Upload een uitgelichte afbeelding voor een artikel en zet artikelen.afbeelding_url. */
export async function uploadArtikelAfbeelding(formData: FormData): Promise<Result> {
  await requireCrm();
  const artikelId = String(formData.get("artikel_id") || "");
  const file = formData.get("file");
  if (!artikelId) return { ok: false, error: "Geen artikel." };
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Geen bestand gekozen." };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Bestand te groot (max 8 MB)." };

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${artikelId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("artikelen")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) return { ok: false, error: upErr.message };
  const { data: pub } = admin.storage.from("artikelen").getPublicUrl(path);

  const { error } = await admin
    .from("artikelen")
    .update({ afbeelding_url: pub.publicUrl })
    .eq("id", artikelId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/website");
  return { ok: true, url: pub.publicUrl };
}

/** Content-velden opslaan: verwerkstatus + YouTube/Instagram-uitwerkingen. */
export async function saveArtikelContent(
  artikelId: string,
  velden: {
    content_processed: boolean;
    ytvideo_url: string;
    instareel_url: string;
    instapost_tekst: string;
    yt_post_tekst: string;
  },
): Promise<Result> {
  await requireCrm();
  if (!artikelId) return { ok: false, error: "Geen artikel." };
  const trimOrNull = (s: string) => (s.trim() ? s.trim() : null);
  const admin = createAdminClient();
  const { error } = await admin
    .from("artikelen")
    .update({
      content_processed: velden.content_processed,
      ytvideo_url: trimOrNull(velden.ytvideo_url),
      instareel_url: trimOrNull(velden.instareel_url),
      instapost_tekst: trimOrNull(velden.instapost_tekst),
      yt_post_tekst: trimOrNull(velden.yt_post_tekst),
    })
    .eq("id", artikelId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/website");
  revalidatePath("/socials");
  return { ok: true };
}

/** Uitgelichte afbeelding losmaken (bestand blijft in de bucket). */
export async function clearArtikelAfbeelding(artikelId: string): Promise<Result> {
  await requireCrm();
  const admin = createAdminClient();
  const { error } = await admin
    .from("artikelen")
    .update({ afbeelding_url: null })
    .eq("id", artikelId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/website");
  return { ok: true };
}
