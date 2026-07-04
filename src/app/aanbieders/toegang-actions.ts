"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/lib/database.types";

async function requireCrm() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  const { data: allowed } = await supabase.rpc("is_allowed_user");
  if (allowed !== true) throw new Error("Alleen CRM-beheerders.");
  return { user };
}

type Result = { ok: boolean; error?: string };

// Keur een aanbieder-account goed, wijs af, of zet terug op 'in behandeling'.
export async function setAanbiederUserStatus(
  userId: string,
  status: "approved" | "geweigerd" | "pending",
): Promise<Result> {
  const { user } = await requireCrm();
  const admin = createAdminClient();
  const patch: TablesUpdate<"aanbieder_users"> = { status };
  if (status === "approved") {
    patch.approved_at = new Date().toISOString();
    patch.approved_by = user.email ?? null;
  } else {
    patch.approved_at = null;
    patch.approved_by = null;
  }
  const { error } = await admin
    .from("aanbieder_users")
    .update(patch)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/aanbieders/aanvragen");
  return { ok: true };
}
