"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isLeadStatus } from "@/lib/constants";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  return { supabase, user };
}

export async function updateLeadStatus(leadId: string, status: string) {
  if (!isLeadStatus(status)) throw new Error(`Ongeldige status: ${status}`);
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", leadId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath(`/leads/${leadId}`);
}

export async function addNote(leadId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("lead_notes").insert({
    lead_id: leadId,
    body: trimmed,
    author_email: user.email ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/leads/${leadId}`);
}

export async function deleteNote(noteId: string, leadId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("lead_notes").delete().eq("id", noteId);
  if (error) throw new Error(error.message);
  revalidatePath(`/leads/${leadId}`);
}

export async function deleteLead(leadId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
