import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { chatModel } from "./ai-model";
import {
  regelgevingSchema,
  captionSchema,
  brollSchema,
  type RegelgevingProps,
  type Caption,
  type Broll,
} from "./socials";

// Server-only: de AI-generatie van social-scripts. Gescheiden van socials.ts zodat
// client-componenten de status-constanten/schemas kunnen importeren zonder de
// 'ai'-import (server-only) mee te trekken.

const batchSchema = z.object({
  afleveringen: z
    .array(
      z.object({
        slug: z
          .string()
          .describe("korte kebab-case slug, bijv. 'mantelzorgwoning-2026-regels'"),
        props: regelgevingSchema,
        caption: captionSchema,
      }),
    )
    .min(1)
    .max(5),
});

// Defensible-claims-systeemprompt (uit de runbook §4). Onafhankelijkheid +
// verplichte bron + "nog niet definitief" + geen ACM-gevoelige claims.
const SOCIAL_SYSTEM = `Je schrijft korte social-scripts voor Op Eigen Erf, een ONAFHANKELIJK
adviesbureau voor een familie-/mantelzorgwoning op eigen erf. Lever geldige JSON die exact
het gevraagde schema volgt: per aflevering een kebab-case slug, de video-props en een
caption-object (instagram + youtube_title).

Regels:
- Max 3-4 scenes; elke scene-tekst ≤ 18 woorden, feitelijk, geen jargon zonder uitleg.
- 'bron' is VERPLICHT en concreet (bijv. Kadaster, DSO omgevingsplan, wettekst).
- Zet 'nogNietDefinitief' op TRUE zodra iets over de familiewoning of nog niet ingegane
  regels gaat (bijv. Wet versterking regie volkshuisvesting, per 1-7-2026).
- GEEN superlatieven, geen "beste/goedkoopste", geen garanties of beloftes (ACM/AVG).
- Prijzen alleen als prijsband mét prijspeil; bij twijfel weglaten.
- Bij onzekerheid: neutraal formuleren en naar de gratis erfcheck verwijzen — nooit
  stellig een vergunningsuitkomst claimen.
- Nederlands, vlot en correct. De IG-caption mag emoji + hashtags bevatten en een
  disclaimerregel als iets nog niet definitief is; de youtube_title eindigt op #Shorts.
- Varieer de onderwerpen (achtererf/ruimte, vergunningvrij, mantelzorg vs familiewoning,
  timing van de wet, veelgemaakte fouten) zodat de afleveringen niet op elkaar lijken.`;

export type GeneratedItem = {
  slug: string;
  props: RegelgevingProps;
  caption: Caption;
};

// Genereert `aantal` afleveringen (concept). `thema` stuurt optioneel het onderwerp.
export async function generateSocialContent(
  aantal: number,
  thema?: string,
): Promise<GeneratedItem[]> {
  const n = Math.max(1, Math.min(5, Math.round(aantal || 1)));
  const model = process.env.SOCIAL_MODEL || process.env.REPORT_MODEL || "anthropic/claude-haiku-4-5";
  const { object } = await generateObject({
    model: chatModel(model),
    schema: batchSchema,
    system: SOCIAL_SYSTEM,
    prompt:
      `Genereer ${n} afleveringen (regelgeving-shorts) voor Op Eigen Erf.` +
      (thema?.trim()
        ? `\n\nThema/onderwerp voor deze batch: ${thema.trim()}`
        : `\n\nKies zelf ${n} uiteenlopende, actuele onderwerpen rond (bij)bouwen op eigen erf.`),
  });
  return object.afleveringen;
}

// ---------------------------------------------------------------------------
// Per-artikel video-aflevering: tekstlaag (Remotion) + beeldlaag (3 Veo-prompts)
// + captions, in één keer. Master-prompt met defensible-claims + privacy/merk.
// ---------------------------------------------------------------------------
const ARTIKEL_SYSTEM = `Je genereert een korte social-video (~25 seconden, 9:16 verticaal) voor Op Eigen
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
- Schrijf in het ENGELS, cinematisch, 9:16, 8 seconden, rustige documentaire-stijl.
- Onderwerp: Nederlandse woonsetting passend bij bouwen op eigen erf - ruime
  achtertuin, klein bijgebouw/tuinhuis, vrijstaande woning, groen erf, of een licht
  verhoogd overzicht van een perceel. Optioneel een oudere ouder + volwassen kind,
  van veraf of van achteren.
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

export type GeneratedAflevering = {
  slug: string;
  props: RegelgevingProps;
  broll: Broll;
  caption: Caption;
};

const afleveringGenSchema = z.object({
  slug: z.string(),
  props: regelgevingSchema,
  broll: brollSchema,
  caption: captionSchema,
});

// Genereert één volledige aflevering op basis van een artikel-onderwerp/samenvatting.
export async function generateArtikelSocial(artikel: {
  titel: string;
  samenvatting?: string | null;
  beschrijving?: string | null;
  categorie?: string | null;
}): Promise<GeneratedAflevering> {
  const model = process.env.SOCIAL_MODEL || process.env.REPORT_MODEL || "anthropic/claude-haiku-4-5";
  const onderwerp = [
    `Titel: ${artikel.titel}`,
    artikel.categorie ? `Categorie: ${artikel.categorie}` : "",
    artikel.samenvatting ? `Samenvatting: ${artikel.samenvatting}` : "",
    !artikel.samenvatting && artikel.beschrijving ? `Beschrijving: ${artikel.beschrijving}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { object } = await generateObject({
    model: chatModel(model),
    schema: afleveringGenSchema,
    system: ARTIKEL_SYSTEM,
    prompt: `ONDERWERP VAN DEZE AFLEVERING:\n${onderwerp}`,
  });
  return object;
}
