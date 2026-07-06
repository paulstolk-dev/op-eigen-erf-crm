import "server-only";

import {
  getSetting,
  SETTING_KEYS,
  DEFAULT_PARTNER_PITCH_SUBJECT,
  DEFAULT_PARTNER_PITCH_BODY,
  DEFAULT_PARTNER_PITCH_CTA_LABEL,
  DEFAULT_PARTNER_PITCH_CTA_URL,
} from "@/lib/settings";

export type Pitch = {
  subject: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
};

export async function getPitch(): Promise<Pitch> {
  const [subject, body, ctaLabel, ctaUrl] = await Promise.all([
    getSetting(SETTING_KEYS.partnerPitchSubject, DEFAULT_PARTNER_PITCH_SUBJECT),
    getSetting(SETTING_KEYS.partnerPitchBody, DEFAULT_PARTNER_PITCH_BODY),
    getSetting(SETTING_KEYS.partnerPitchCtaLabel, DEFAULT_PARTNER_PITCH_CTA_LABEL),
    getSetting(SETTING_KEYS.partnerPitchCtaUrl, DEFAULT_PARTNER_PITCH_CTA_URL),
  ]);
  return { subject, body, ctaLabel, ctaUrl };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderPitch(
  pitch: Pitch,
  aanbieder: { naam: string; contact_naam: string | null },
): { subject: string; html: string } {
  const merge = (t: string) =>
    t
      .replace(/\{\{\s*aanbieder_naam\s*\}\}/g, aanbieder.naam)
      .replace(/\{\{\s*contact_naam\s*\}\}/g, aanbieder.contact_naam || "")
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
