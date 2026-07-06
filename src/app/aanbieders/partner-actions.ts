"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { getPitch, renderPitch } from "@/lib/partner-pitch";
import {
  getSetting,
  setSetting,
  SETTING_KEYS,
  DEFAULT_NURTURE_FROM,
  DEFAULT_NURTURE_REPLY_TO,
  DEFAULT_NURTURE_BCC,
} from "@/lib/settings";
import { PARTNER_STATUS } from "@/lib/aanbieders-constants";
import { syncAanbiederToHubspot, logAanbiederEmail } from "@/lib/hubspot";
import type { TablesUpdate } from "@/lib/database.types";

async function requireCrm() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  const { data: allowed } = await supabase.rpc("is_allowed_user");
  if (allowed !== true) throw new Error("Alleen CRM-beheerders.");
}

type Result = { ok: boolean; error?: string };

export async function setPartnerStatus(
  aanbiederId: string,
  status: string,
): Promise<Result> {
  await requireCrm();
  if (!(PARTNER_STATUS as readonly string[]).includes(status)) {
    return { ok: false, error: "Ongeldige status." };
  }
  const admin = createAdminClient();
  // Bij 'partner' meteen is_partner zetten (zichtbaar in de publieke catalogus).
  const patch: TablesUpdate<"aanbieders"> = { partner_status: status };
  if (status === "partner") patch.is_partner = true;
  const { error } = await admin.from("aanbieders").update(patch).eq("id", aanbiederId);
  if (error) return { ok: false, error: error.message };
  await syncAanbiederToHubspot(aanbiederId).catch(() => {});
  revalidatePath("/aanbieders/partners");
  return { ok: true };
}

export async function saveContact(
  aanbiederId: string,
  contactNaam: string,
  contactEmail: string,
): Promise<Result> {
  await requireCrm();
  const admin = createAdminClient();
  const { error } = await admin
    .from("aanbieders")
    .update({
      contact_naam: contactNaam.trim() || null,
      contact_email: contactEmail.trim() || null,
    })
    .eq("id", aanbiederId);
  if (error) return { ok: false, error: error.message };
  // Direct naar HubSpot pushen (naast de DB-trigger) voor snelle, betrouwbare sync.
  await syncAanbiederToHubspot(aanbiederId).catch(() => {});
  revalidatePath("/aanbieders/partners");
  return { ok: true };
}

export async function verstuurPitch(aanbiederId: string): Promise<Result> {
  await requireCrm();
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("aanbieders")
    .select("naam, contact_naam, contact_email")
    .eq("id", aanbiederId)
    .single();
  if (!a) return { ok: false, error: "Aanbieder niet gevonden." };
  if (!a.contact_email) return { ok: false, error: "Geen contact-e-mail ingevuld." };

  const pitch = await getPitch();
  const { subject, html } = renderPitch(pitch, {
    naam: a.naam,
    contact_naam: a.contact_naam,
  });

  const [from, replyTo, bcc] = await Promise.all([
    getSetting(SETTING_KEYS.nurtureFrom, DEFAULT_NURTURE_FROM),
    getSetting(SETTING_KEYS.nurtureReplyTo, DEFAULT_NURTURE_REPLY_TO),
    getSetting(SETTING_KEYS.nurtureBcc, DEFAULT_NURTURE_BCC),
  ]);

  const ok = await sendEmail({
    to: a.contact_email,
    subject,
    html,
    from,
    replyTo,
    ...(bcc.trim() ? { bcc: bcc.trim() } : {}),
  });
  if (!ok) return { ok: false, error: "Versturen mislukt (RESEND_API_KEY of adres?)." };

  const sentAtIso = new Date().toISOString();
  await admin
    .from("aanbieders")
    .update({ partner_status: "benaderd", partner_benaderd_at: sentAtIso })
    .eq("id", aanbiederId);
  // Eerst company/contact (her)syncen, dan de verstuurde mail op de HubSpot-
  // tijdlijn loggen. Beide best-effort: HubSpot-fouten blokkeren de verzending niet.
  await syncAanbiederToHubspot(aanbiederId).catch(() => {});
  await logAanbiederEmail(aanbiederId, {
    subject,
    html,
    from,
    to: a.contact_email,
    sentAtIso,
  }).catch(() => {});
  revalidatePath("/aanbieders/partners");
  return { ok: true };
}

export async function savePitch(
  subject: string,
  body: string,
  ctaLabel: string,
  ctaUrl: string,
): Promise<Result> {
  await requireCrm();
  if (!subject.trim() || !body.trim()) {
    return { ok: false, error: "Onderwerp en body zijn verplicht." };
  }
  try {
    await setSetting(SETTING_KEYS.partnerPitchSubject, subject.trim());
    await setSetting(SETTING_KEYS.partnerPitchBody, body.trim());
    await setSetting(SETTING_KEYS.partnerPitchCtaLabel, ctaLabel.trim());
    await setSetting(SETTING_KEYS.partnerPitchCtaUrl, ctaUrl.trim());
    revalidatePath("/aanbieders/partners");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Opslaan mislukt." };
  }
}
