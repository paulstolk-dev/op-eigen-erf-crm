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
