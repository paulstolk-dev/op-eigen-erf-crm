"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isLeadStatus } from "@/lib/constants";
import { syncLeadToHubspot } from "@/lib/hubspot";
import { runNurture } from "@/lib/nurture";

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
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function updateLeadNaam(
  leadId: string,
  voornaam: string,
  achternaam: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireUser();
  const vn = voornaam.trim() || null;
  const an = achternaam.trim() || null;
  const { error } = await supabase
    .from("leads")
    .update({ voornaam: vn, achternaam: an })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };
  // Naam ook naar HubSpot (firstname/lastname) doorzetten; best-effort.
  await syncLeadToHubspot(leadId).catch(() => {});
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
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

// Een (test-)lead uit- of insluiten in de dashboard-telling. De lead blijft
// gewoon in de leadslijst en de nurture-flow staan; alleen de statistieken
// negeren 'm.
export async function setLeadExcluded(
  leadId: string,
  excluded: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await (supabase as any)
    .from("leads")
    .update({ excluded_from_stats: excluded })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function deleteLead(leadId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/leads");
}

// --- Lead delen met aanbieders (RLS: 'crm all shares' vereist is_allowed_user) ---

export async function shareLeadMetAanbieder(leadId: string, aanbiederId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("lead_aanbieder").insert({
    lead_id: leadId,
    aanbieder_id: aanbiederId,
    gedeeld_by: user.email ?? null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Al gedeeld met deze aanbieder." };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function setContactVrijgave(
  shareId: string,
  leadId: string,
  vrij: boolean,
) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("lead_aanbieder")
    .update({
      contact_vrijgegeven: vrij,
      vrijgegeven_at: vrij ? new Date().toISOString() : null,
    })
    .eq("id", shareId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function removeShare(shareId: string, leadId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("lead_aanbieder").delete().eq("id", shareId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

// Handmatig de eerstvolgende opvolgmail naar één lead sturen.
// force = negeer de wachttijd. Retourneert of er iets verstuurd is.
export async function verstuurNurtureVoorLead(leadId: string, force: boolean) {
  const { supabase } = await requireUser();
  const { data: allowed } = await supabase.rpc("is_allowed_user");
  if (allowed !== true) return { ok: false, verstuurd: 0, error: "Alleen CRM-beheerders." };
  const res = await runNurture({ force, leadId });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return res;
}

// Handmatig een lead naar HubSpot syncen (naast de automatische trigger).
export async function syncLeadHubspotNow(leadId: string) {
  await requireUser();
  const res = await syncLeadToHubspot(leadId);
  revalidatePath(`/leads/${leadId}`);
  return res;
}

// Backfill: alle bestaande leads (opnieuw) naar HubSpot syncen, zodat ook de
// aanvullende contact-properties (huisnummer, bronpagina, gewenste grootte,
// budget, type doelgroep) gevuld worden. Nieuwe leads gaan automatisch via de
// leads_hubspot_sync-trigger. Idempotent: opnieuw klikken kan altijd.
export async function syncAllLeadsToHubspot(): Promise<{
  ok: boolean;
  synced: number;
  failed: number;
  skipped: number;
  total: number;
}> {
  const { supabase } = await requireUser();
  const { data: allowed } = await supabase.rpc("is_allowed_user");
  const leeg = { ok: false, synced: 0, failed: 0, skipped: 0, total: 0 };
  if (allowed !== true) return leeg;

  const { data } = await supabase
    .from("leads")
    .select("id")
    .order("created_at", { ascending: true });
  const ids = (data ?? []).map((r) => r.id as string);

  let synced = 0;
  let failed = 0;
  let skipped = 0;
  for (const id of ids) {
    const res = await syncLeadToHubspot(id).catch(() => ({ ok: false as const }));
    if ("skipped" in res && res.skipped) skipped++;
    else if (res.ok) synced++;
    else failed++;
  }

  revalidatePath("/leads");
  return { ok: failed === 0, synced, failed, skipped, total: ids.length };
}
