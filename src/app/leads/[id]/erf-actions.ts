"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
}

/** Ingetekende erf-vlakken (GeoJSON FeatureCollection) opslaan op de erfscan. */
export async function saveErfTekening(
  leadId: string,
  tekening: Json | null,
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  const admin = createAdminClient();
  const { error } = await admin
    .from("erfscans")
    .update({ tekening })
    .eq("lead_id", leadId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Platte PNG van de kaart-intekening opslaan in de privé 'erfscans'-bucket. */
export async function uploadErfSnapshot(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  const leadId = String(formData.get("lead_id") || "");
  const file = formData.get("file");
  if (!leadId) return { ok: false, error: "Geen lead." };
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Geen afbeelding." };

  const admin = createAdminClient();
  const path = `${leadId}/tekening.png`;
  const { error: upErr } = await admin.storage
    .from("erfscans")
    .upload(path, file, { contentType: "image/png", upsert: true, cacheControl: "0" });
  if (upErr) return { ok: false, error: upErr.message };

  const { error } = await admin
    .from("erfscans")
    .update({ tekening_path: path })
    .eq("lead_id", leadId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}
