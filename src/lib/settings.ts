import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Standaard-instructie voor de concept-mail. Bewerkbaar via /instellingen
// (opgeslagen in app_settings.report_email_prompt).
export const DEFAULT_EMAIL_PROMPT = `Schrijf de concept-mail aan de lead als een persoonlijke e-mail:
- Begin met een nette aanhef (gebruik de voornaam als die bekend is).
- Vat in 2-3 korte alinea's de kern van de erfcheck samen in gewone taal:
  of er ruimte lijkt op het achtererf, of er mogelijk vergunningvrij gebouwd of
  geplaatst kan worden, en het belangrijkste aandachtspunt of risico.
- Wees eerlijk over onzekerheden ("op basis van de eerste check lijkt...").
- Nodig uit voor het gratis adviesgesprek (https://opeigenerf.nl/kennismaking) en
  noem de Haalbaarheidsscan à €495 (https://opeigenerf.nl/haalbaarheidsscan),
  verrekenbaar bij begeleiding.
- Sluit vriendelijk af, ondertekend met "Team opeigenerf".
- Vlot, persoonlijk Nederlands. Geen markdown, geen kleurcodes, geen kapitalen-koppen.`;

export const SETTING_KEYS = {
  reportEmailPrompt: "report_email_prompt",
} as const;

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
