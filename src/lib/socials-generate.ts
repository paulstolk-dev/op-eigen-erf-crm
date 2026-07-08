import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import {
  regelgevingSchema,
  captionSchema,
  type RegelgevingProps,
  type Caption,
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
    model,
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
