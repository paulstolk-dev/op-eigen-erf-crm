"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

type Result = { ok: boolean; error?: string };

// Haalt de deel-rij op als de lead met de HUIDIGE aanbieder is gedeeld (RLS-select:
// een aanbieder ziet alleen z'n eigen shares). Zo is dit de autorisatie-grens.
async function shareForLead(leadId: string): Promise<{ id: string; aanbieder_id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("lead_aanbieder")
    .select("id, aanbieder_id")
    .eq("lead_id", leadId)
    .maybeSingle();
  return data ?? null;
}

/** Eigen erf-intekening (GeoJSON) van de aanbieder opslaan op de deel-rij. */
export async function savePortalErfTekening(
  leadId: string,
  tekening: Json | null,
): Promise<Result> {
  const share = await shareForLead(leadId);
  if (!share) return { ok: false, error: "Geen toegang tot deze lead." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("lead_aanbieder")
    .update({ tekening })
    .eq("id", share.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/leads");
  return { ok: true };
}

/** Platte PNG van de eigen intekening opslaan (privé 'erfscans'-bucket, per aanbieder). */
export async function uploadPortalErfSnapshot(formData: FormData): Promise<Result> {
  const leadId = String(formData.get("lead_id") || "");
  const file = formData.get("file");
  const share = await shareForLead(leadId);
  if (!share) return { ok: false, error: "Geen toegang tot deze lead." };
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Geen afbeelding." };

  const admin = createAdminClient();
  const path = `${leadId}/partner-${share.aanbieder_id}.png`;
  const { error: upErr } = await admin.storage
    .from("erfscans")
    .upload(path, file, { contentType: "image/png", upsert: true, cacheControl: "0" });
  if (upErr) return { ok: false, error: upErr.message };
  const { error } = await admin
    .from("lead_aanbieder")
    .update({ tekening_path: path })
    .eq("id", share.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/leads");
  return { ok: true };
}
