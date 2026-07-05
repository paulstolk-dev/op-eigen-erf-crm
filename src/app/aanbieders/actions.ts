"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import {
  VERGUNNINGSBEGELEIDING,
  PRIJSKLASSE,
  AFWERKINGSNIVEAUS,
  AANBOD_TYPE,
  BTW_BASIS,
  slugify,
} from "@/lib/aanbieders-constants";

// Bepaalt of de aanroeper een CRM-medewerker is (allowlist) of een aanbieder
// (goedgekeurd portal-account). Aanbieders mogen ALLEEN hun eigen data raken;
// dat wordt hier server-side afgedwongen, ongeacht wat de client stuurt.
async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  const [{ data: crm }, { data: aid }] = await Promise.all([
    supabase.rpc("is_allowed_user"),
    supabase.rpc("current_aanbieder_id"),
  ]);
  const isCrm = crm === true;
  const aanbiederId = (aid as string | null) ?? null;
  if (!isCrm && !aanbiederId) throw new Error("Geen toegang.");
  return { supabase, user, isCrm, aanbiederId };
}

type Result = { ok: boolean; error?: string; id?: string };

// Leeg → null; trim strings.
const nul = (v: unknown) => {
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return v ?? null;
};
const posIntNull = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 0), "Moet een positief geheel getal zijn");

// ---------------------------------------------------------------- aanbieders
const aanbiederSchema = z.object({
  naam: z.string().trim().min(1, "Naam is verplicht"),
  slug: z.string().trim().optional().transform((v) => nul(v) as string | null),
  website_url: z.string().trim().optional().transform((v) => nul(v) as string | null),
  logo_url: z.string().trim().optional().transform((v) => nul(v) as string | null),
  beschrijving: z.string().optional().transform((v) => nul(v) as string | null),
  vestigingsplaats: z.string().optional().transform((v) => nul(v) as string | null),
  servicegebied: z.string().optional().transform((v) => nul(v) as string | null),
  bouwmethode: z.string().optional().transform((v) => nul(v) as string | null),
  levertijd_indicatie: z.string().optional().transform((v) => nul(v) as string | null),
  vergunningsbegeleiding: z.enum(VERGUNNINGSBEGELEIDING).default("niet_vermeld"),
  koop: z.boolean().default(true),
  huur: z.boolean().default(false),
  tweedehands: z.boolean().default(false),
  prijsklasse: z
    .union([z.enum(PRIJSKLASSE), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  vanaf_prijs_incl_btw: posIntNull,
  prijs_per_m2_indicatie: posIntNull,
  afwerkingsniveaus: z.array(z.enum(AFWERKINGSNIVEAUS)).optional().default([]),
  in_vanaf_prijs: z.string().optional().transform((v) => nul(v) as string | null),
  prijspeil: z.string().optional().transform((v) => nul(v) as string | null),
  bron_url: z.string().optional().transform((v) => nul(v) as string | null),
  laatst_gecontroleerd: z.string().optional().transform((v) => nul(v) as string | null),
  is_partner: z.boolean().default(false),
  actief: z.boolean().default(true),
  sortering: z.coerce.number().int().default(0),
});

export type AanbiederInput = z.input<typeof aanbiederSchema>;

async function afterMutation(id?: string): Promise<Result> {
  revalidatePath("/aanbieders");
  if (id) revalidatePath(`/aanbieders/${id}`);
  await revalidatePublicSite(["/aanbieders"]);
  return { ok: true, id };
}

export async function saveAanbieder(input: AanbiederInput, id?: string): Promise<Result> {
  const { isCrm, aanbiederId } = await getAuthContext();
  const parsed = aanbiederSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const data = parsed.data;

  // Aanbieders mogen ALLEEN hun eigen profiel bewerken, geen nieuwe aanmaken,
  // en niet de beheer-velden (actief/partner/sortering/slug) wijzigen.
  if (!isCrm) {
    if (!id || id !== aanbiederId) {
      return { ok: false, error: "Je kunt alleen je eigen profiel bewerken." };
    }
    const {
      slug: _slug,
      is_partner: _p,
      actief: _a,
      sortering: _s,
      ...profiel
    } = data;
    void _slug;
    void _p;
    void _a;
    void _s;
    const admin = createAdminClient();
    const { error } = await admin.from("aanbieders").update(profiel).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/portal/profiel");
    await revalidatePublicSite(["/aanbieders"]);
    return { ok: true, id };
  }

  const row = {
    ...data,
    slug: data.slug || slugify(data.naam),
  };

  const admin = createAdminClient();
  if (id) {
    const { error } = await admin.from("aanbieders").update(row).eq("id", id);
    if (error) return { ok: false, error: error.message };
    return afterMutation(id);
  }
  const { data: created, error } = await admin
    .from("aanbieders")
    .insert(row)
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return afterMutation(created.id);
}

export async function setAanbiederActief(id: string, actief: boolean): Promise<Result> {
  const { isCrm } = await getAuthContext();
  if (!isCrm) return { ok: false, error: "Alleen CRM-beheerders." };
  const admin = createAdminClient();
  const { error } = await admin.from("aanbieders").update({ actief }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return afterMutation(id);
}

// Hard verwijderen mag alleen als er geen woningen aan hangen (anders: soft delete).
export async function deleteAanbieder(id: string): Promise<Result> {
  const { isCrm } = await getAuthContext();
  if (!isCrm) return { ok: false, error: "Alleen CRM-beheerders." };
  const admin = createAdminClient();
  const { count } = await admin
    .from("woningen")
    .select("id", { count: "exact", head: true })
    .eq("aanbieder_id", id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Kan niet verwijderen: er hangen ${count} woningen aan. Zet op inactief of verwijder eerst de woningen.`,
    };
  }
  const { error } = await admin.from("aanbieders").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/aanbieders");
  await revalidatePublicSite(["/aanbieders"]);
  return { ok: true };
}

// ---------------------------------------------------------------- woningen
const woningSchema = z.object({
  aanbieder_id: z.string().uuid(),
  naam: z.string().trim().min(1, "Naam is verplicht"),
  slug: z.string().optional().transform((v) => nul(v) as string | null),
  oppervlakte_m2: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Oppervlakte moet > 0 zijn"),
  oppervlakte_max_m2: posIntNull,
  slaapkamers: posIntNull,
  prijs_incl_btw: posIntNull,
  btw_basis_bron: z.enum(BTW_BASIS).default("incl"),
  is_vanaf_prijs: z.boolean().default(true),
  afwerkingsniveau: z
    .union([z.enum(AFWERKINGSNIVEAUS), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  aanbod_type: z.enum(AANBOD_TYPE).default("koop"),
  in_prijs_inbegrepen: z.string().optional().transform((v) => nul(v) as string | null),
  beschrijving: z.string().optional().transform((v) => nul(v) as string | null),
  gelijkvloers: z.boolean().nullable().optional().default(null),
  energieneutraal_beng: z.boolean().nullable().optional().default(null),
  afbeeldingen: z.array(z.string()).optional().default([]),
  bron_url: z.string().optional().transform((v) => nul(v) as string | null),
  prijspeil: z.string().optional().transform((v) => nul(v) as string | null),
  laatst_gecontroleerd: z.string().optional().transform((v) => nul(v) as string | null),
  actief: z.boolean().default(true),
  uitgelicht: z.boolean().default(false),
  sortering: z.coerce.number().int().default(0),
});

export type WoningInput = z.input<typeof woningSchema>;

export async function saveWoning(input: WoningInput, id?: string): Promise<Result> {
  const { isCrm, aanbiederId } = await getAuthContext();
  const parsed = woningSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const data = parsed.data;
  const admin = createAdminClient();

  // Aanbieder mag alleen in de EIGEN aanbieder_id werken, en bij bewerken
  // alleen een woning die al van hem is.
  if (!isCrm) {
    data.aanbieder_id = aanbiederId!;
    if (id) {
      const { data: bestaand } = await admin
        .from("woningen")
        .select("aanbieder_id")
        .eq("id", id)
        .maybeSingle();
      if (!bestaand || bestaand.aanbieder_id !== aanbiederId) {
        return { ok: false, error: "Geen toegang tot deze woning." };
      }
    }
  }

  const row = {
    ...data,
    slug: data.slug || slugify(data.naam),
  };
  let woningId = id;
  if (id) {
    const { error } = await admin.from("woningen").update(row).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: created, error } = await admin
      .from("woningen")
      .insert(row)
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    woningId = created.id;
  }
  revalidatePath(`/aanbieders/${data.aanbieder_id}`);
  revalidatePath("/portal/woningen");
  await revalidatePublicSite(["/aanbieders"]);
  return { ok: true, id: woningId };
}

export async function deleteWoning(id: string, aanbiederId: string): Promise<Result> {
  const { isCrm, aanbiederId: eigenId } = await getAuthContext();
  const admin = createAdminClient();
  if (!isCrm) {
    const { data: bestaand } = await admin
      .from("woningen")
      .select("aanbieder_id")
      .eq("id", id)
      .maybeSingle();
    if (!bestaand || bestaand.aanbieder_id !== eigenId) {
      return { ok: false, error: "Geen toegang tot deze woning." };
    }
  }
  const { error } = await admin.from("woningen").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/aanbieders/${aanbiederId}`);
  revalidatePath("/portal/woningen");
  await revalidatePublicSite(["/aanbieders"]);
  return { ok: true };
}

// Snel een woning op actief/inactief zetten (zonder het hele formulier).
export async function setWoningActief(
  id: string,
  actief: boolean,
  aanbiederId: string,
): Promise<Result> {
  const { isCrm, aanbiederId: eigenId } = await getAuthContext();
  const admin = createAdminClient();
  if (!isCrm) {
    const { data: bestaand } = await admin
      .from("woningen")
      .select("aanbieder_id")
      .eq("id", id)
      .maybeSingle();
    if (!bestaand || bestaand.aanbieder_id !== eigenId) {
      return { ok: false, error: "Geen toegang tot deze woning." };
    }
  }
  const { error } = await admin.from("woningen").update({ actief }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/aanbieders/${aanbiederId}`);
  revalidatePath("/portal/woningen");
  await revalidatePublicSite(["/aanbieders"]);
  return { ok: true };
}

// ---------------------------------------------------------------- uploads
// Upload naar de publieke bucket 'aanbieders'; geeft de public URL terug.
export async function uploadAanbiedersFile(
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { isCrm, aanbiederId } = await getAuthContext();
  const file = formData.get("file");
  let prefix = (formData.get("prefix") as string) || "misc";
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Geen bestand ontvangen." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Bestand te groot (max 8 MB)." };
  }
  // Aanbieders schrijven verplicht in hun eigen map (matcht de storage-RLS).
  if (!isCrm) {
    const soort = prefix.startsWith("logo") ? "logos" : "woningen";
    prefix = `${soort}/${aanbiederId}`;
  }
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${prefix.replace(/[^a-zA-Z0-9/_-]/g, "")}/${crypto.randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("aanbieders")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) return { ok: false, error: error.message };
  const { data } = admin.storage.from("aanbieders").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
