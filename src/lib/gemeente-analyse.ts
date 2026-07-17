import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { chatModel } from "./ai-model";

// AI-analyse van een gemeentelijke omgevingsplan-wijziging. Claude leest de ÉCHTE
// artikeltekst (uit de STOP-XML) en vergelijkt met de standaard-bruidsschat, en
// levert gestructureerde feiten + verplichte citaten. De uitkomst is een CONCEPT:
// een mens keurt goed vóór het live gaat. Claude publiceert nooit zelf.

export const analyseSchema = z.object({
  omgevingsplan_status: z
    .enum(["ongewijzigd", "gewijzigd", "verplaatst", "onbekend"])
    .describe("ongewijzigd = standaard-bruidsschat; gewijzigd = inhoud aangepast; verplaatst = zelfde inhoud, ander artikel/hoofdstuk"),
  afwijking_richting: z
    .enum(["strenger", "soepeler", "gelijk", "onbekend"])
    .describe("t.o.v. de landelijke standaard-bruidsschat (art. 22.36) voor de burger"),
  afwijking_samenvatting: z
    .string()
    .describe("1-2 zinnen, feitelijk, wat er concreet anders is voor iemand die op eigen erf wil bouwen. Leeg als ongewijzigd."),
  kernparameters: z
    .array(z.object({ label: z.string(), waarde: z.string() }))
    .describe("concrete regels: max. oppervlak, achtererfgebied-eis, max. bouwhoogte, verblijfslaag, afstand tot openbaar gebied, mantelzorg-uitzondering. Alleen wat in de tekst staat."),
  citaten: z
    .array(z.string())
    .min(1)
    .describe("letterlijke citaten uit de aangeleverde tekst die de conclusie onderbouwen (tegen hallucinatie)."),
});
export type GemeenteAnalyse = z.infer<typeof analyseSchema>;

const SYSTEM = `Je bent jurist-analist voor Op Eigen Erf, een onafhankelijk adviesbureau voor
(mantelzorg)woningen en bijgebouwen op eigen erf. Je krijgt de LETTERLIJKE tekst van een
gemeentelijk omgevingsplan-artikel over VERGUNNINGVRIJE bijbehorende bouwwerken.

Referentiekader — de landelijke standaard-bruidsschat (art. 22.36): een bijbehorend bouwwerk
in het achtererfgebied is onder voorwaarden vergunningvrij (o.a. staffel voor oppervlak/hoogte,
afstand tot openbaar gebied, één verblijfslaag).

Taak: vergelijk de aangeleverde tekst met die standaard en lever GELDIGE JSON exact volgens het
schema. Regels:
- Baseer je UITSLUITEND op de aangeleverde tekst. Verzin niets; niet in de tekst = niet vermelden.
- 'citaten' zijn letterlijke fragmenten uit de tekst (verplicht, minstens 1).
- 'afwijking_richting': soepeler = ruimer bouwen mogelijk voor de burger; strenger = minder;
  gelijk = materieel gelijk aan de standaard. Bij twijfel: 'onbekend'.
- 'afwijking_samenvatting': feitelijk en kort; geen advies, geen superlatieven.
- Nederlands, neutraal.`;

/** Analyseert de artikeltekst en geeft gestructureerde concept-feiten terug. */
export async function analyseerArtikel(
  gemeente: string,
  artikel: string,
  tekst: string,
): Promise<GemeenteAnalyse> {
  const model = process.env.REPORT_MODEL || "anthropic/claude-haiku-4-5";
  const { object } = await generateObject({
    model: chatModel(model),
    schema: analyseSchema,
    system: SYSTEM,
    prompt:
      `Gemeente: ${gemeente}\nVindplaats (artikel): ${artikel}\n\n` +
      `--- LETTERLIJKE ARTIKELTEKST ---\n${tekst}\n--- EINDE TEKST ---`,
  });
  return object;
}
