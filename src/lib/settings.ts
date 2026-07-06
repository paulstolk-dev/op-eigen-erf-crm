import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Standaard-instructie voor de concept-mail. Bewerkbaar via /instellingen
// (opgeslagen in app_settings.report_email_prompt).
export const DEFAULT_EMAIL_PROMPT = `Schrijf de concept-mail aan de lead als een persoonlijke e-mail. Dit is de
GRATIS Erf Check: een eerste indicatie, geen volledig onderzoek — laat het voelen
als "eerste richting", niet als "volledig onderzocht".
- Begin met een nette aanhef (gebruik de voornaam als die bekend is).
- Vat in 2-3 korte alinea's de kern van de erfcheck samen in gewone taal:
  of er ruimte lijkt op het achtererf, of er mogelijk vergunningvrij gebouwd of
  geplaatst kan worden, en het belangrijkste aandachtspunt of risico.
- Wees eerlijk over onzekerheden ("op basis van de eerste check lijkt...").
- Beloof niets dat bij de betaalde stappen hoort: geen kostenindicatie, geen
  specifieke aanbieders, geen volledige regelgevingstoets.
- Geef een eerlijk advies over de logische vervolgstap en of de Haalbaarheidsscan
  (€99) zinvol is: bij kansrijk/twijfelachtig → de scan voor zekerheid over regels,
  risico's en budget; bij complex → eerst het gratis adviesgesprek.
- Noem het gratis adviesgesprek (https://opeigenerf.nl/kennismaking) en de
  Haalbaarheidsscan (https://opeigenerf.nl/haalbaarheidsscan, €99).
- Sluit vriendelijk af, ondertekend met "Team opeigenerf".
- Vlot, persoonlijk Nederlands. Geen markdown, geen kleurcodes, geen kapitalen-koppen.`;

export const SETTING_KEYS = {
  reportEmailPrompt: "report_email_prompt",
  nurtureFrom: "nurture_from",
  nurtureReplyTo: "nurture_reply_to",
  nurtureBcc: "nurture_bcc",
} as const;

// Fallbacks (UI-instelling wint, dan env, dan deze default).
export const DEFAULT_NURTURE_FROM =
  process.env.NURTURE_FROM_EMAIL ||
  process.env.REPORT_FROM_EMAIL ||
  "opeigenerf <noreply@opeigenerf.nl>";
export const DEFAULT_NURTURE_REPLY_TO =
  process.env.NURTURE_REPLY_TO || "info@opeigenerf.nl";
export const DEFAULT_NURTURE_BCC =
  process.env.NURTURE_BCC || "info@opeigenerf.nl";

export async function getSetting(
  key: string,
  fallback = "",
): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    return data?.value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
