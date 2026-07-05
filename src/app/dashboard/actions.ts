"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAdsSync, type AdsSyncResult } from "@/lib/ads-sync";

// Handmatig de Google Ads-kosten ophalen vanuit het dashboard (CRM-only).
export async function syncAdsNow(): Promise<AdsSyncResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };
  const { data: allowed } = await supabase.rpc("is_allowed_user");
  if (allowed !== true) return { ok: false, error: "Alleen CRM-beheerders." };

  const res = await runAdsSync();
  if (res.ok) revalidatePath("/dashboard");
  return res;
}
