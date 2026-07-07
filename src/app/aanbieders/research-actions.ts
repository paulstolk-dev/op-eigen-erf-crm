"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { SCRAPE_REVIEW_STATUS } from "@/lib/aanbieders-constants";
import type { TablesUpdate } from "@/lib/database.types";

type Result = { ok: boolean; error?: string; started?: boolean; aantal?: number };

async function requireCrm() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  const { data: allowed } = await supabase.rpc("is_allowed_user");
  if (allowed !== true) throw new Error("Alleen CRM-beheerders.");
}

// Roept de research-crawler (Railway) aan. Body bepaalt de modus.
async function triggerCrawler(body: Record<string, unknown>): Promise<Result> {
  const endpoint = process.env.RESEARCH_ENDPOINT;
  const secret = process.env.RESEARCH_TRIGGER_SECRET;
  if (!endpoint || !secret) {
    return { ok: false, error: "RESEARCH_ENDPOINT/RESEARCH_TRIGGER_SECRET niet gezet." };
  }
  try {
    const res = await fetch(`${endpoint.replace(/\/$/, "")}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-research-secret": secret },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: `Crawler ${res.status}: ${JSON.stringify(data).slice(0, 200)}` };
    }
    return { ok: true, started: Boolean(data.started), aantal: Number(data.aantal ?? 0) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Crawler onbereikbaar." };
  }
}

// Zoek nieuwe aanbieders (discovery).
export async function startResearch(limit: number): Promise<Result> {
  await requireCrm();
  const res = await triggerCrawler({ mode: "discover", limit: Math.max(1, Math.min(20, limit || 5)) });
  revalidatePath("/aanbieders/research");
  return res;
}

// Her-scrape een bestaande aanbieder om ontbrekende modellen/foto's aan te vullen.
export async function refreshAanbieder(aanbiederId: string): Promise<Result> {
  await requireCrm();
  const res = await triggerCrawler({ mode: "refresh", aanbieder_id: aanbiederId });
  revalidatePath("/aanbieders/research");
  revalidatePath(`/aanbieders/${aanbiederId}`);
  return res;
}

// Reviewstatus van een gescrapete aanbieder zetten (bijv. 'afgewezen').
export async function setScrapeReviewStatus(
  aanbiederId: string,
  status: string,
): Promise<Result> {
  await requireCrm();
  if (!(SCRAPE_REVIEW_STATUS as readonly string[]).includes(status)) {
    return { ok: false, error: "Ongeldige status." };
  }
  const admin = createAdminClient();
  const patch: TablesUpdate<"aanbieders"> = { review_status: status };
  // Afgewezen/nieuw = niet publiek; alleen 'ok' (via publiceren) zet actief=true.
  if (status !== "ok") patch.actief = false;
  const { error } = await admin.from("aanbieders").update(patch).eq("id", aanbiederId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/aanbieders/research");
  revalidatePath(`/aanbieders/research/${aanbiederId}`);
  return { ok: true };
}

// Kandidaatfoto selecteren/deselecteren.
export async function toggleFoto(fotoId: string, gekozen: boolean): Promise<Result> {
  await requireCrm();
  const admin = createAdminClient();
  const { error } = await admin
    .from("scrape_afbeeldingen")
    .update({ gekozen })
    .eq("id", fotoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Publiceer een gescrapete aanbieder: kopieer gekozen foto's privé→publiek, vul
// woningen.afbeeldingen, en zet aanbieder + modellen op actief/ok.
export async function publishScrapedAanbieder(aanbiederId: string): Promise<Result> {
  await requireCrm();
  const admin = createAdminClient();

  const { data: woningen } = await admin
    .from("woningen")
    .select("id, slug, afbeeldingen")
    .eq("aanbieder_id", aanbiederId);

  try {
    for (const w of woningen ?? []) {
      const { data: fotos } = await admin
        .from("scrape_afbeeldingen")
        .select("id, storage_path")
        .eq("woning_id", w.id)
        .eq("gekozen", true);

      const urls: string[] = [...(w.afbeeldingen ?? [])];
      for (const f of fotos ?? []) {
        if (!f.storage_path) continue;
        // Download uit privé-bucket → upload naar publieke bucket 'aanbieders'.
        const { data: blob, error: dlErr } = await admin.storage
          .from("aanbieder-scrape")
          .download(f.storage_path);
        if (dlErr || !blob) continue;
        const ext = (f.storage_path.split(".").pop() || "jpg").toLowerCase();
        const dest = `woningen/${aanbiederId}/${crypto.randomUUID()}.${ext}`;
        const buf = Buffer.from(await blob.arrayBuffer());
        const { error: upErr } = await admin.storage
          .from("aanbieders")
          .upload(dest, buf, { contentType: blob.type || undefined, upsert: false });
        if (upErr) continue;
        const { data: pub } = admin.storage.from("aanbieders").getPublicUrl(dest);
        urls.push(pub.publicUrl);
        await admin
          .from("scrape_afbeeldingen")
          .update({ review_status: "goedgekeurd" })
          .eq("id", f.id);
      }

      await admin
        .from("woningen")
        .update({ afbeeldingen: urls, actief: true, review_status: "ok" })
        .eq("id", w.id);
    }

    await admin
      .from("aanbieders")
      .update({ actief: true, review_status: "ok" })
      .eq("id", aanbiederId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Publiceren mislukt." };
  }

  revalidatePath("/aanbieders/research");
  revalidatePath(`/aanbieders/research/${aanbiederId}`);
  revalidatePath("/aanbieders");
  await revalidatePublicSite(["/aanbieders"]);
  return { ok: true };
}
