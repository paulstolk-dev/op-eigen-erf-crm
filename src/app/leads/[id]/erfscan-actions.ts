"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  return { supabase, user };
}

/** Tier-3 checklist (mens-in-de-lus) opslaan op de erfscan. */
export async function saveTier3(leadId: string, tier3: Json) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("erfscans")
    .update({ tier3 })
    .eq("lead_id", leadId);
  if (error) throw new Error(error.message);
  revalidatePath(`/leads/${leadId}`);
}

/** Het Groen/Oranje/Rood-eindoordeel handmatig (over)schrijven. */
export async function setConclusie(leadId: string, conclusie: string) {
  if (!["groen", "oranje", "rood"].includes(conclusie)) {
    throw new Error(`Ongeldige conclusie: ${conclusie}`);
  }
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("erfscans")
    .update({ conclusie })
    .eq("lead_id", leadId);
  if (error) throw new Error(error.message);
  revalidatePath(`/leads/${leadId}`);
}

type RerunResult = { ok: boolean; error?: string; conclusie?: string };

/**
 * Roept de Python erfscan-engine aan (api/erfscan.py). Optioneel met een
 * gecorrigeerd adres. Werkt zodra de app gedeployd is (of ERFSCAN_ENDPOINT
 * naar een draaiende functie wijst).
 */
export async function rerunErfscan(
  leadId: string,
  postcode?: string,
  huisnummer?: string,
): Promise<RerunResult> {
  await requireUser();

  const base =
    process.env.ERFSCAN_ENDPOINT ||
    (process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/api/erfscan`
      : null);
  if (!base) {
    return { ok: false, error: "ERFSCAN_ENDPOINT niet geconfigureerd." };
  }

  try {
    const res = await fetch(base, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.ERFSCAN_SECRET
          ? { "x-erfscan-secret": process.env.ERFSCAN_SECRET }
          : {}),
      },
      body: JSON.stringify({
        lead_id: leadId,
        ...(postcode ? { postcode } : {}),
        ...(huisnummer ? { huisnummer } : {}),
      }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as RerunResult;
    revalidatePath(`/leads/${leadId}`);
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data.error || `Engine gaf status ${res.status}` };
    }
    return { ok: true, conclusie: data.conclusie };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? `Engine niet bereikbaar: ${e.message}`
          : "Engine niet bereikbaar.",
    };
  }
}
