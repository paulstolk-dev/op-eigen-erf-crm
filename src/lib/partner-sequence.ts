import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { getPitchStep, getPitchDelays, renderPitch, type Pitch } from "@/lib/partner-pitch";
import {
  getSetting,
  SETTING_KEYS,
  DEFAULT_NURTURE_FROM,
  DEFAULT_NURTURE_REPLY_TO,
  DEFAULT_NURTURE_BCC,
} from "@/lib/settings";
import { syncAanbiederToHubspot, logAanbiederEmail } from "@/lib/hubspot";

const DAY = 86_400_000;

type AanbiederRow = {
  id: string;
  naam: string;
  contact_naam: string | null;
  contact_email: string | null;
  partner_pitch_step: number | null;
  partner_pitch_last_at: string | null;
};

/**
 * Verstuurt de vervolgmails (2 en 3) van de aanbieder-wervingssequence.
 * Alleen aanbieders met status 'benaderd' schuiven op — zodra je iemand op
 * 'geinteresseerd', 'partner' of 'afgewezen' zet (= gereageerd) stopt de reeks.
 * Max. één stap per aanbieder per run. force=true negeert de wachttijd (test).
 */
export async function runPartnerSequence(opts?: {
  force?: boolean;
}): Promise<{ ok: boolean; verstuurd: number; error?: string }> {
  const admin = createAdminClient();

  const [step2, step3, delays, from, replyTo, bccRaw] = await Promise.all([
    getPitchStep(2),
    getPitchStep(3),
    getPitchDelays(),
    getSetting(SETTING_KEYS.nurtureFrom, DEFAULT_NURTURE_FROM),
    getSetting(SETTING_KEYS.nurtureReplyTo, DEFAULT_NURTURE_REPLY_TO),
    getSetting(SETTING_KEYS.nurtureBcc, DEFAULT_NURTURE_BCC),
  ]);
  const bcc = bccRaw.trim();

  // Aanbieders die nog in de reeks zitten: benaderd, stap 1 of 2, met e-mail.
  const { data } = await admin
    .from("aanbieders")
    .select("id,naam,contact_naam,contact_email,partner_pitch_step,partner_pitch_last_at")
    .eq("partner_status", "benaderd")
    .in("partner_pitch_step", [1, 2])
    .not("contact_email", "is", null);
  const rows = (data ?? []) as AanbiederRow[];
  if (rows.length === 0) return { ok: true, verstuurd: 0 };

  // Suppressie-lijst (bounces/klachten) — nooit meer mailen.
  const { data: supp } = await (admin as any).rpc("nurture_suppressed_emails");
  const suppressed = new Set(((supp ?? []) as string[]).map((e) => e.toLowerCase()));

  const now = Date.now();
  let verstuurd = 0;

  for (const a of rows) {
    if (!a.contact_email || !a.partner_pitch_last_at) continue;
    if (suppressed.has(a.contact_email.toLowerCase())) continue;
    const last = new Date(a.partner_pitch_last_at).getTime();

    let nextStep = 0;
    let pitch: Pitch | null = null;
    if (a.partner_pitch_step === 1 && (opts?.force || now >= last + delays.delay2 * DAY)) {
      nextStep = 2;
      pitch = step2;
    } else if (a.partner_pitch_step === 2 && (opts?.force || now >= last + delays.delay3 * DAY)) {
      nextStep = 3;
      pitch = step3;
    }
    if (!nextStep || !pitch) continue;
    if (!pitch.subject.trim() || !pitch.body.trim()) continue; // lege template = overslaan

    const { subject, html } = renderPitch(pitch, {
      naam: a.naam,
      contact_naam: a.contact_naam,
    });
    const sent = await sendEmail({
      to: a.contact_email,
      subject,
      html,
      from,
      replyTo,
      ...(bcc ? { bcc } : {}),
    });
    if (!sent.ok) continue; // RESEND-fout → volgende run opnieuw

    const sentAtIso = new Date().toISOString();
    await admin
      .from("aanbieders")
      .update({ partner_pitch_step: nextStep, partner_pitch_last_at: sentAtIso })
      .eq("id", a.id);
    // Meetlaag: log de verzonden vervolgmail + Resend-id.
    await (admin as any).rpc("nurture_log_partner_message", {
      p_aanbieder: a.id,
      p_stap: nextStep,
      p_to: a.contact_email,
      p_subject: subject,
      p_pmid: sent.id,
    });
    // Op de HubSpot-tijdlijn loggen (best-effort).
    await syncAanbiederToHubspot(a.id).catch(() => {});
    await logAanbiederEmail(a.id, {
      subject,
      html,
      from,
      to: a.contact_email,
      sentAtIso,
    }).catch(() => {});
    verstuurd++;
  }

  return { ok: true, verstuurd };
}
