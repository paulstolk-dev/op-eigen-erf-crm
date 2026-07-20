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

  // Nooit mailen naar een gesupprimeerd adres (bounce/klacht/afmelding).
  const { data: supp } = await (admin as any).rpc("nurture_suppressed_emails");
  if (((supp ?? []) as string[]).some((e) => e.toLowerCase() === a.contact_email!.toLowerCase())) {
    return { ok: false, error: "Dit adres staat op de suppressie-lijst (bounce/klacht/afmelding)." };
  }

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

  const sent = await sendEmail({
    to: a.contact_email,
    subject,
    html,
    from,
    replyTo,
    ...(bcc.trim() ? { bcc: bcc.trim() } : {}),
  });
  if (!sent.ok) return { ok: false, error: "Versturen mislukt (RESEND_API_KEY of adres?)." };

  const sentAtIso = new Date().toISOString();
  // Start (of herstart) de wervingssequence op stap 1; anker voor de vervolgmails.
  await admin
    .from("aanbieders")
    .update({
      partner_status: "benaderd",
      partner_benaderd_at: sentAtIso,
      partner_pitch_step: 1,
      partner_pitch_last_at: sentAtIso,
    })
    .eq("id", aanbiederId);
  // Meetlaag: log de verzonden pitch + Resend-id (koppelt de webhooks).
  await (admin as any).rpc("nurture_log_partner_message", {
    p_aanbieder: aanbiederId,
    p_stap: 1,
    p_to: a.contact_email,
    p_subject: subject,
    p_pmid: sent.id,
  });
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

type SequenceStep = { subject: string; body: string; ctaLabel: string; ctaUrl: string };

// Slaat de hele wervingssequence op: 3 mails + de twee wachttijden (dagen).
export async function savePartnerSequence(payload: {
  step1: SequenceStep;
  step2: SequenceStep;
  step3: SequenceStep;
  delay2: string;
  delay3: string;
}): Promise<Result> {
  await requireCrm();
  const { step1, step2, step3 } = payload;
  if (!step1.subject.trim() || !step1.body.trim()) {
    return { ok: false, error: "Mail 1 heeft een onderwerp en body nodig." };
  }
  const dagen = (s: string) => {
    const n = Math.round(Number(s));
    return Number.isFinite(n) && n >= 0 ? String(n) : "";
  };
  const d2 = dagen(payload.delay2);
  const d3 = dagen(payload.delay3);
  if (!d2 || !d3) return { ok: false, error: "Wachttijden moeten gehele dagen (≥ 0) zijn." };
  try {
    await Promise.all([
      setSetting(SETTING_KEYS.partnerPitchSubject, step1.subject.trim()),
      setSetting(SETTING_KEYS.partnerPitchBody, step1.body.trim()),
      setSetting(SETTING_KEYS.partnerPitchCtaLabel, step1.ctaLabel.trim()),
      setSetting(SETTING_KEYS.partnerPitchCtaUrl, step1.ctaUrl.trim()),
      setSetting(SETTING_KEYS.partnerPitch2Subject, step2.subject.trim()),
      setSetting(SETTING_KEYS.partnerPitch2Body, step2.body.trim()),
      setSetting(SETTING_KEYS.partnerPitch2CtaLabel, step2.ctaLabel.trim()),
      setSetting(SETTING_KEYS.partnerPitch2CtaUrl, step2.ctaUrl.trim()),
      setSetting(SETTING_KEYS.partnerPitch3Subject, step3.subject.trim()),
      setSetting(SETTING_KEYS.partnerPitch3Body, step3.body.trim()),
      setSetting(SETTING_KEYS.partnerPitch3CtaLabel, step3.ctaLabel.trim()),
      setSetting(SETTING_KEYS.partnerPitch3CtaUrl, step3.ctaUrl.trim()),
      setSetting(SETTING_KEYS.partnerPitchDelay2, d2),
      setSetting(SETTING_KEYS.partnerPitchDelay3, d3),
    ]);
    revalidatePath("/aanbieders/partners");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Opslaan mislukt." };
  }
}
