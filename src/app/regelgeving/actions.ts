"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchArtikelTekst } from "@/lib/omgevingsplan-fetch";
import { analyseerArtikel, type GemeenteAnalyse } from "@/lib/gemeente-analyse";
import { revalidatePublicSite } from "@/lib/revalidate-public";

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

type AnalyseResult = { ok: boolean; error?: string; analyse?: GemeenteAnalyse; bronUrl?: string };

/**
 * AI-analyse van een gesignaleerde wijziging: haalt de échte artikeltekst uit de
 * publicatie, laat Claude die vergelijken met de standaard-bruidsschat en geeft
 * gestructureerde CONCEPT-feiten terug (+ opgeslagen in delta.analyse). Schrijft
 * NIETS naar de redactionele gemeente-velden — dat doet de mens via saveGemeenteVelden.
 */
export async function analyseerWijziging(id: string): Promise<AnalyseResult> {
  const { supabase } = await requireUser();
  const { data: w } = await (supabase as any)
    .from("gemeente_wijzigingen")
    .select("id, gemeente_slug, artikel, nieuwe_hash, delta")
    .eq("id", id)
    .maybeSingle();
  if (!w) return { ok: false, error: "Wijziging niet gevonden." };

  const { data: g } = await (supabase as any)
    .from("gemeenten")
    .select("naam")
    .eq("slug", w.gemeente_slug)
    .maybeSingle();
  const naam = g?.naam ?? w.gemeente_slug;

  const bron = await fetchArtikelTekst(w.nieuwe_hash);
  if ("error" in bron) return { ok: false, error: bron.error };

  try {
    const analyse = await analyseerArtikel(naam, w.artikel, bron.tekst);
    // Concept opslaan in delta zodat het een herlaad overleeft.
    const delta = { ...(w.delta ?? {}), analyse };
    await (supabase as any).from("gemeente_wijzigingen").update({ delta }).eq("id", id);
    revalidatePath("/regelgeving");
    return { ok: true, analyse, bronUrl: bron.bronUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI-analyse mislukt." };
  }
}

/** Redactionele gemeente-velden opslaan (mens keurt goed) → revalideert de publieke site. */
export async function saveGemeenteVelden(
  slug: string,
  velden: {
    omgevingsplan_status?: string;
    afwijking_richting?: string;
    afwijking_samenvatting?: string;
    omgevingsplan_wijziging_datum?: string;
    vergunningvrij_parameters?: { label: string; waarde: string }[];
    vergunningvrij_citaten?: string[];
    vergunningvrij_bron_url?: string;
  },
): Promise<Result> {
  const { supabase } = await requireUser();
  const patch: Record<string, unknown> = {
    omgevingsplan_status: velden.omgevingsplan_status || null,
    afwijking_richting: velden.afwijking_richting || null,
    afwijking_samenvatting: velden.afwijking_samenvatting || null,
    omgevingsplan_wijziging_datum: velden.omgevingsplan_wijziging_datum || null,
    gecontroleerd_op: new Date().toISOString().slice(0, 10),
    // Opslaan = de mens heeft beoordeeld → publiceren (poller-status 'monitoren'
    // wordt 'onderzocht', waardoor de publieke site de gemeente toont).
    research_status: "onderzocht",
  };
  // Rijke regelset alleen overschrijven als 'ie meegestuurd wordt (leeg = ongemoeid laten).
  if (velden.vergunningvrij_parameters !== undefined)
    patch.vergunningvrij_parameters = velden.vergunningvrij_parameters;
  if (velden.vergunningvrij_citaten !== undefined)
    patch.vergunningvrij_citaten = velden.vergunningvrij_citaten;
  if (velden.vergunningvrij_bron_url !== undefined)
    patch.vergunningvrij_bron_url = velden.vergunningvrij_bron_url || null;
  const { error } = await (supabase as any).from("gemeenten").update(patch).eq("slug", slug);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/regelgeving");
  await revalidatePublicSite(["/gemeenten", `/gemeenten/${slug}`]);
  return { ok: true };
}
