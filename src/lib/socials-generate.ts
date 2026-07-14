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
import { getSetting, SETTING_KEYS, DEFAULT_SOCIALS_ARTIKEL_PROMPT } from "./settings";

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

  const system = await getSetting(
    SETTING_KEYS.socialsArtikelPrompt,
    DEFAULT_SOCIALS_ARTIKEL_PROMPT,
  );
  const { object } = await generateObject({
    model: chatModel(model),
    schema: afleveringGenSchema,
    system,
    prompt: `ONDERWERP VAN DEZE AFLEVERING:\n${onderwerp}`,
  });
  return object;
}
