"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

const STATUSSEN = ["nieuw", "verwerkt", "afgewezen"] as const;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  return { supabase, user };
}

/** Review-status van een gesignaleerde wijziging zetten (nieuw → verwerkt/afgewezen). */
export async function setWijzigingStatus(id: string, status: string): Promise<Result> {
  const { supabase } = await requireUser();
  if (!(STATUSSEN as readonly string[]).includes(status)) {
    return { ok: false, error: "Onbekende status." };
  }
  const { error } = await (supabase as any)
    .from("gemeente_wijzigingen")
    .update({ review_status: status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/regelgeving");
  return { ok: true };
}
