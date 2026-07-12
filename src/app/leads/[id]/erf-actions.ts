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

// Vergunningvrij-staffel (Bbl), identiek aan de Python-engine: cap 100 m².
function staffelMaxVergunningvrij(bebouwingsgebied: number, cap = 100): number {
  const b = bebouwingsgebied;
  const opp = b <= 100 ? 0.5 * b : b <= 300 ? 50 + 0.2 * (b - 100) : 90 + 0.1 * (b - 300);
  return Math.round(Math.min(opp, cap));
}

// Totale m² van de ingetekende 'erf/achtererf'-vlakken uit de FeatureCollection.
function erfAreaUitTekening(tekening: Json | null): number {
  const fc = tekening as { features?: { properties?: { type?: string; m2?: number } }[] } | null;
  if (!fc?.features?.length) return 0;
  return fc.features
    .filter((f) => (f?.properties?.type ?? "erf") === "erf")
    .reduce((s, f) => s + (Number(f?.properties?.m2) || 0), 0);
}

/** Ingetekende erf-vlakken opslaan + achtererf/max-bebouwing herrekenen op basis
 *  van de ingetekende achtererf-oppervlakte. */
export async function saveErfTekening(
  leadId: string,
  tekening: Json | null,
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  const admin = createAdminClient();

  const patch: { tekening: Json | null; dossier?: Json } = { tekening };

  // Achtererf ingetekend → achtererf_proxy_m2, bebouwingsgebied_m2 en
  // max_vergunningvrij_m2 in het dossier herrekenen (footprint blijft).
  const erfArea = Math.round(erfAreaUitTekening(tekening));
  if (erfArea > 0) {
    const { data: erf } = await admin
      .from("erfscans")
      .select("dossier")
      .eq("lead_id", leadId)
      .maybeSingle();
    const dossier = (erf?.dossier ?? {}) as Record<string, unknown>;
    const ruimtelijk = { ...((dossier.ruimtelijk ?? {}) as Record<string, unknown>) };
    const footprint = Number(ruimtelijk.footprint_hoofdgebouw_m2) || 0;
    const bebouwingsgebied = erfArea + footprint;
    ruimtelijk.achtererf_proxy_m2 = erfArea;
    ruimtelijk.bebouwingsgebied_m2 = bebouwingsgebied;
    ruimtelijk.max_vergunningvrij_m2 = staffelMaxVergunningvrij(bebouwingsgebied);
    ruimtelijk.achtererf_bron = "handmatig ingetekend";
    patch.dossier = { ...dossier, ruimtelijk } as Json;
  }

  const { error } = await admin.from("erfscans").update(patch).eq("lead_id", leadId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Platte PNG van de kaart-intekening opslaan in de privé 'erfscans'-bucket. */
export async function uploadErfSnapshot(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  const leadId = String(formData.get("lead_id") || "");
  const file = formData.get("file");
  if (!leadId) return { ok: false, error: "Geen lead." };
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Geen afbeelding." };

  const admin = createAdminClient();
  const path = `${leadId}/tekening.png`;
  const { error: upErr } = await admin.storage
    .from("erfscans")
    .upload(path, file, { contentType: "image/png", upsert: true, cacheControl: "0" });
  if (upErr) return { ok: false, error: upErr.message };

  const { error } = await admin
    .from("erfscans")
    .update({ tekening_path: path })
    .eq("lead_id", leadId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}
