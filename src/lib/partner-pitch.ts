import "server-only";

import {
  getSetting,
  SETTING_KEYS,
  DEFAULT_PARTNER_PITCH_SUBJECT,
  DEFAULT_PARTNER_PITCH_BODY,
  DEFAULT_PARTNER_PITCH_CTA_LABEL,
  DEFAULT_PARTNER_PITCH_CTA_URL,
  DEFAULT_PARTNER_PITCH2_SUBJECT,
  DEFAULT_PARTNER_PITCH2_BODY,
  DEFAULT_PARTNER_PITCH2_CTA_LABEL,
  DEFAULT_PARTNER_PITCH2_CTA_URL,
  DEFAULT_PARTNER_PITCH3_SUBJECT,
  DEFAULT_PARTNER_PITCH3_BODY,
  DEFAULT_PARTNER_PITCH3_CTA_LABEL,
  DEFAULT_PARTNER_PITCH3_CTA_URL,
  DEFAULT_PARTNER_PITCH_DELAY2,
  DEFAULT_PARTNER_PITCH_DELAY3,
} from "@/lib/settings";

export type Pitch = {
  subject: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
};

// Per-stap settingsleutels + defaults (1 = eerste pitch, 2/3 = vervolgmails).
const STEP_KEYS = {
  1: {
    subject: SETTING_KEYS.partnerPitchSubject,
    body: SETTING_KEYS.partnerPitchBody,
    ctaLabel: SETTING_KEYS.partnerPitchCtaLabel,
    ctaUrl: SETTING_KEYS.partnerPitchCtaUrl,
    def: {
      subject: DEFAULT_PARTNER_PITCH_SUBJECT,
      body: DEFAULT_PARTNER_PITCH_BODY,
      ctaLabel: DEFAULT_PARTNER_PITCH_CTA_LABEL,
      ctaUrl: DEFAULT_PARTNER_PITCH_CTA_URL,
    },
  },
  2: {
    subject: SETTING_KEYS.partnerPitch2Subject,
    body: SETTING_KEYS.partnerPitch2Body,
    ctaLabel: SETTING_KEYS.partnerPitch2CtaLabel,
    ctaUrl: SETTING_KEYS.partnerPitch2CtaUrl,
    def: {
      subject: DEFAULT_PARTNER_PITCH2_SUBJECT,
      body: DEFAULT_PARTNER_PITCH2_BODY,
      ctaLabel: DEFAULT_PARTNER_PITCH2_CTA_LABEL,
      ctaUrl: DEFAULT_PARTNER_PITCH2_CTA_URL,
    },
  },
  3: {
    subject: SETTING_KEYS.partnerPitch3Subject,
    body: SETTING_KEYS.partnerPitch3Body,
    ctaLabel: SETTING_KEYS.partnerPitch3CtaLabel,
    ctaUrl: SETTING_KEYS.partnerPitch3CtaUrl,
    def: {
      subject: DEFAULT_PARTNER_PITCH3_SUBJECT,
      body: DEFAULT_PARTNER_PITCH3_BODY,
      ctaLabel: DEFAULT_PARTNER_PITCH3_CTA_LABEL,
      ctaUrl: DEFAULT_PARTNER_PITCH3_CTA_URL,
    },
  },
} as const;

export type PitchStep = 1 | 2 | 3;

export async function getPitchStep(step: PitchStep): Promise<Pitch> {
  const k = STEP_KEYS[step];
  const [subject, body, ctaLabel, ctaUrl] = await Promise.all([
    getSetting(k.subject, k.def.subject),
    getSetting(k.body, k.def.body),
    getSetting(k.ctaLabel, k.def.ctaLabel),
    getSetting(k.ctaUrl, k.def.ctaUrl),
  ]);
  return { subject, body, ctaLabel, ctaUrl };
}

// Eerste pitch (stap 1) — behouden voor bestaande aanroepers.
export async function getPitch(): Promise<Pitch> {
  return getPitchStep(1);
}

// Wachttijden (dagen): mail 2 X dagen na mail 1; mail 3 Y dagen na mail 2.
export async function getPitchDelays(): Promise<{ delay2: number; delay3: number }> {
  const [d2, d3] = await Promise.all([
    getSetting(SETTING_KEYS.partnerPitchDelay2, DEFAULT_PARTNER_PITCH_DELAY2),
    getSetting(SETTING_KEYS.partnerPitchDelay3, DEFAULT_PARTNER_PITCH_DELAY3),
  ]);
  const clamp = (s: string, fb: number) => {
    const n = Math.round(Number(s));
    return Number.isFinite(n) && n >= 0 ? n : fb;
  };
  return { delay2: clamp(d2, 10), delay3: clamp(d3, 14) };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderPitch(
  pitch: Pitch,
  aanbieder: { naam: string; contact_naam: string | null },
): { subject: string; html: string } {
  // Contactpersoon is optioneel: zonder naam vallen we terug op "team van <aanbieder>"
  // zodat de aanhef netjes blijft ("Beste team van Firma X," i.p.v. "Beste,").
  const contactNaam = aanbieder.contact_naam?.trim()
    ? aanbieder.contact_naam.trim()
    : `team van ${aanbieder.naam}`;
  const merge = (t: string) =>
    t
      .replace(/\{\{\s*aanbieder_naam\s*\}\}/g, aanbieder.naam)
      .replace(/\{\{\s*contact_naam\s*\}\}/g, contactNaam)
      .replace(/Beste\s+,/g, "Beste,");

  const subject = merge(pitch.subject);
  const bodyHtml = esc(merge(pitch.body))
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0a1b2b">$1</a>')
    .split("\n")
    .map((l) => l || "&nbsp;")
    .join("<br>");

  const button =
    pitch.ctaLabel && pitch.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="border-radius:8px;background:#0a1b2b">
          <a href="${pitch.ctaUrl}" style="display:inline-block;padding:12px 22px;color:#fff;font-weight:600;font-size:15px;text-decoration:none;border-radius:8px">${esc(pitch.ctaLabel)}</a>
        </td></tr></table>`
      : "";

  const html = `<div style="font-family:system-ui,-apple-system,Arial,sans-serif;color:#1f2937;font-size:15px;line-height:1.55;max-width:600px">
  <div>${bodyHtml}</div>
  ${button}
</div>`;

  return { subject, html };
}
