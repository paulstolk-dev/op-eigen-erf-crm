"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Aanbieder reageert op een gedeelde lead. De RPC dwingt af dat je alleen je
// eigen toegewezen leads kunt raken en alleen de status wijzigt (geen PII).
export async function reageerOpLead(
  leadId: string,
  status: "geinteresseerd" | "afgewezen" | "gedeeld",
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("portal_lead_reageer", {
    p_lead_id: leadId,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/leads");
  revalidatePath("/portal");
  return { ok: true };
}
