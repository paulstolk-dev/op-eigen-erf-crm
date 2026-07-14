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
  socialsArtikelPrompt: "socials_artikel_prompt",
  nurtureFrom: "nurture_from",
  nurtureReplyTo: "nurture_reply_to",
  nurtureBcc: "nurture_bcc",
  partnerPitchSubject: "partner_pitch_subject",
  partnerPitchBody: "partner_pitch_body",
  partnerPitchCtaLabel: "partner_pitch_cta_label",
  partnerPitchCtaUrl: "partner_pitch_cta_url",
  // Vervolgmails 2 en 3 van de wervingssequence + instelbare wachttijden (dagen).
  partnerPitch2Subject: "partner_pitch2_subject",
  partnerPitch2Body: "partner_pitch2_body",
  partnerPitch2CtaLabel: "partner_pitch2_cta_label",
  partnerPitch2CtaUrl: "partner_pitch2_cta_url",
  partnerPitch3Subject: "partner_pitch3_subject",
  partnerPitch3Body: "partner_pitch3_body",
  partnerPitch3CtaLabel: "partner_pitch3_cta_label",
  partnerPitch3CtaUrl: "partner_pitch3_cta_url",
  partnerPitchDelay2: "partner_pitch_delay2_dagen",
  partnerPitchDelay3: "partner_pitch_delay3_dagen",
} as const;

// Master-prompt voor de per-artikel social-video (tekstlaag + 3 Veo-beeldprompts +
// captions). Bewerkbaar via de UI op /socials; de generatie leest deze setting.
export const DEFAULT_SOCIALS_ARTIKEL_PROMPT = `Je genereert een korte social-video (~25 seconden, 9:16 verticaal) voor Op Eigen
Erf, een ONAFHANKELIJK adviesbureau voor een familie-/mantelzorgwoning op eigen
erf. Lever UITSLUITEND geldige JSON volgens het schema — geen uitleg.

Een video heeft twee lagen:
- TEKSTLAAG (Remotion): kicker, titel, 3 korte scenes, bron en CTA.
  ALLE feiten, cijfers en tekst horen in deze laag.
- BEELDLAAG (Veo): 3 sfeershots van elk 8s die samen (~24s) onder de tekst lopen.
  De beeldlaag bevat NOOIT tekst of feiten — puur sfeer.

REGELS TEKSTLAAG (defensible-claims-standaard):
- Max 3 scenes; elke tekst <= 16 woorden, feitelijk, geen jargon zonder uitleg.
- bron verplicht en concreet (Kadaster, DSO omgevingsplan, wettekst).
- nogNietDefinitief = true zodra het over de familiewoning of nog niet ingegane
  regels gaat.
- Geen superlatieven, geen "beste/goedkoopste", geen garanties/beloftes (ACM/AVG).
- Prijzen alleen als prijsband met prijspeil; bij twijfel weglaten.
- Nooit stellig een vergunningsuitkomst claimen - verwijs naar de gratis erfcheck.

REGELS BEELDLAAG (veo_prompt, per shot):
- Schrijf in het ENGELS, cinematisch, ~8 seconden, rustige documentaire-stijl.
- Vermeld GEEN beeldverhouding/aspect ratio in de prompt: dus NIET "9:16", "16:9",
  "vertical", "horizontal", "portrait" of "landscape". De verhouding wordt apart
  ingesteld; noem alleen het beeld en de sfeer.
- Kies het ONDERWERP en de SCÈNE van de 3 shots passend bij DIT specifieke artikel
  (het onderwerp staat onderaan). Nederlandse woonsetting, maar afgestemd op het type:
  * mantelzorg / ouder op eigen erf -> een oudere ouder en een volwassen kind samen,
    van veraf of van achteren, bij een klein bijgebouw of aanbouw;
  * familiewoning / woning voor je kind -> een ruimer groen perceel met een
    vrijstaande of dubbele woning, gezinssfeer;
  * tuinkantoor / klein bijgebouw -> een compact, modern tuinhuis in een verzorgde tuin;
  * vergunning / regels / algemeen -> een rustig, licht verhoogd overzicht van een
    achtererf met bestaande bebouwing en ruimte om te bouwen.
  Houd het herkenbaar Nederlands en inhoudelijk passend, maar verzin geen concrete claims.
- VERBODEN in beeld: leesbare tekst, borden, logo's, merknamen, adressen;
  herkenbare gezichten in close-up; en alles wat als claim/belofte kan lezen.
- STYLE-LOCK - neem deze tokens LETTERLIJK op in elk van de 3 shots, zodat de
  montage een geheel wordt:
  "soft overcast Dutch daylight, muted natural palette with earthy sage-green
   tones, calm slow camera drift, photoreal, no text, no signage, no logos".
- Shot 2 en 3 sluiten in locatie en licht aan op shot 1.
- Geen dialoog; alleen subtiel omgevingsgeluid of geen audio.

Vul in broll het pad in als "broll/{slug}-1.mp4", "-2.mp4", "-3.mp4" met dezelfde
slug als het "slug"-veld.`;

// Eerste versie van de preferred-partner-pitch (bewerkbaar via de UI).
export const DEFAULT_PARTNER_PITCH_SUBJECT =
  "Preferred partner worden bij opeigenerf.nl — gekwalificeerde leads";
export const DEFAULT_PARTNER_PITCH_BODY = `Beste {{contact_naam}},

Via opeigenerf.nl helpen we particulieren die op hun eigen erf willen (bij)bouwen — mantelzorg- en familiewoningen. Met onze gratis Erf Check en de betaalde Haalbaarheidsscan kwalificeren we hun plannen: perceel, regelgeving, budget en de route die past.

Daardoor hebben we een gestage stroom serieuze, voorgekwalificeerde aanvragen van mensen die concreet op zoek zijn naar een woning zoals {{aanbieder_naam}} die levert.

We bouwen een netwerk van preferred partners aan wie we deze leads doorzetten. Als preferred partner:
- ontvang je gekwalificeerde leads die passen bij jouw woningtype, budget en regio;
- krijg je voorrang en extra zichtbaarheid in onze catalogus op opeigenerf.nl;
- betaal je alleen voor leads — geen abonnement vooraf.

We werken onafhankelijk: we bouwen zelf niet en hebben geen belang bij wélke aanbieder de klant kiest. Juist dat maakt onze doorverwijzing geloofwaardig richting de consument.

Lijkt het je wat? Dan bel ik je graag kort om de leadprijzen en werkwijze toe te lichten. Reageer op deze mail of plan een kennismaking.

Met vriendelijke groet,
[Naam]
opeigenerf.nl`;
export const DEFAULT_PARTNER_PITCH_CTA_LABEL = "Plan een kennismaking";
export const DEFAULT_PARTNER_PITCH_CTA_URL = "https://opeigenerf.nl/kennismaking";

// Mail 2 — update + nogmaals verzoek om beeldmateriaal (standaard ~10 dagen na mail 1).
export const DEFAULT_PARTNER_PITCH2_SUBJECT =
  "Update Op Eigen Erf – eerste resultaten en uw vermelding";
export const DEFAULT_PARTNER_PITCH2_BODY = `Beste {{contact_naam}},

Onlangs stuurde ik u een bericht over uw vermelding op Op Eigen Erf. Inmiddels wilde ik u graag een korte update geven.

Het platform groeit sneller dan verwacht. De afgelopen periode hebben we inmiddels:
- ruim 4.500 bezoekers ontvangen;
- 120 aanvragen voor een erfcheck verwerkt;
- de eerste 2 klanten begeleid richting een aankooptraject.

Steeds meer bezoekers gebruiken de aanbiederspagina's om verschillende woningtypen en aanbieders met elkaar te vergelijken voordat zij contact opnemen.

Een aantal aanbieders heeft inmiddels de vermelding aangevuld met eigen beeldmateriaal, waardoor bezoekers een veel beter beeld krijgen van hun woningen. Enkele voorbeelden:
- https://opeigenerf.nl/aanbieders/compact-housing
- https://opeigenerf.nl/aanbieders/goudstaete
- https://opeigenerf.nl/aanbieders/opus-pod

Ik zou uw pagina graag dezelfde kwaliteit geven. Mocht u een logo en enkele foto's (liefst in hoge resolutie) kunnen toesturen, dan vervang ik de huidige tijdelijke afbeeldingen kosteloos. Uiteraard controleer ik meteen of prijzen, specificaties en modellen nog actueel zijn.

Alvast hartelijk dank. Ik hoor graag van u.

Met vriendelijke groet,
Paul Stolk
OpEigenErf.nl`;
export const DEFAULT_PARTNER_PITCH2_CTA_LABEL = "";
export const DEFAULT_PARTNER_PITCH2_CTA_URL = "";

// Mail 3 — kennismaking preferred partners (standaard ~14 dagen na mail 2).
export const DEFAULT_PARTNER_PITCH3_SUBJECT = "Samenwerking Op Eigen Erf";
export const DEFAULT_PARTNER_PITCH3_BODY = `Beste {{contact_naam}},

Ik wilde nog één keer contact opnemen omdat Op Eigen Erf zich momenteel in een interessante fase bevindt.

Steeds meer mensen oriënteren zich op een woning op eigen erf. Inmiddels begeleiden we bezoekers vanaf de eerste erfcheck tot – wanneer zij daar klaar voor zijn – richting passende aanbieders.

Om de kwaliteit voor bezoekers hoog te houden wil ik slechts met een beperkt aantal aanbieders intensiever samenwerken.

Daarbij denk ik niet aan een standaard advertentiemodel, maar aan een inhoudelijke samenwerking waarbij we:
- bezoekers objectief blijven informeren;
- alleen passende aanvragen doorverwijzen;
- uw modellen zo volledig en aantrekkelijk mogelijk presenteren;
- samen kijken hoe we de klantreis kunnen verbeteren.

Ik ben benieuwd hoe u tegen deze ontwikkeling aankijkt en of een vrijblijvende kennismaking interessant lijkt. Een korte online afspraak of kop koffie is wat mij betreft voldoende om te kijken of er een goede match is.

Ik hoor graag van u.

Met vriendelijke groet,
Paul Stolk
OpEigenErf.nl`;
export const DEFAULT_PARTNER_PITCH3_CTA_LABEL = "Plan een kennismaking";
export const DEFAULT_PARTNER_PITCH3_CTA_URL = "https://opeigenerf.nl/kennismaking";

// Instelbare wachttijden (dagen). Mail 2 na X dagen; mail 3 na Y dagen ná mail 2.
export const DEFAULT_PARTNER_PITCH_DELAY2 = "10";
export const DEFAULT_PARTNER_PITCH_DELAY3 = "14";

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
