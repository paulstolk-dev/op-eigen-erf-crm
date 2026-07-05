"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setSetting, SETTING_KEYS } from "@/lib/settings";

async function requireCrm() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  const { data: allowed } = await supabase.rpc("is_allowed_user");
  if (allowed !== true) throw new Error("Alleen CRM-beheerders.");
}

export async function saveEmailPrompt(
  value: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireCrm();
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: "De prompt mag niet leeg zijn." };
  try {
    await setSetting(SETTING_KEYS.reportEmailPrompt, trimmed);
    revalidatePath("/instellingen");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Opslaan mislukt." };
  }
}
