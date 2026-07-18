import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { chatModel } from "./ai-model";

// AI-analyse van een volkshuisvestingsprogramma (VHP). Claude leest de ÉCHTE
// publicatietekst en beantwoordt de twee vragen die er voor Op Eigen Erf toe doen:
// (1) is het VHP vastgesteld (en wanneer), en (2) staan er bijzondere/afwijkende
// zaken in die relevant zijn voor mantelzorg-/familiewoningen op eigen erf?
// De uitkomst is een CONCEPT: een mens beoordeelt het. Claude publiceert nooit zelf.

export const vhpAnalyseSchema = z.object({
  vastgesteld: z
    .enum(["ja", "nee", "onduidelijk"])
    .describe("Is dit het door de raad VASTGESTELDE VHP (ja), een ontwerp/concept/inspraak (nee), of niet op te maken (onduidelijk)?"),
  vaststelling_datum: z
    .string()
    .describe("Datum van vaststelling als die letterlijk in de tekst staat (YYYY-MM-DD of zoals vermeld); anders leeg."),
  noemt_mantelzorg_familie: z
    .boolean()
    .describe("Noemt het VHP mantelzorgwoningen en/of familie-/tweede woningen op eigen erf?"),
  mantelzorg_familie_samenvatting: z
    .string()
    .describe("1-3 zinnen: wat zegt het VHP concreet over mantelzorg-/familiewoningen op eigen erf? 'Niet genoemd' als het ontbreekt."),
  lokale_bijzonderheden: z
    .string()
    .describe("Staan er LOKALE voorwaarden/afwijkingen in die de landelijke vergunningvrije regeling (Bbl 2.30b) raken of proberen te beperken? Zo niet: 'Geen afwijking t.o.v. de landelijke regels gevonden.'"),
  welstand_beschermd: z
    .string()
    .describe("Signalen over welstand, beschermd stads-/dorpsgezicht, monumenten of erfgoed die alsnog een vergunning kunnen triggeren. 'Niet genoemd' als het ontbreekt."),
  citaten: z
    .array(z.string())
    .min(1)
    .describe("Letterlijke citaten uit de aangeleverde tekst die de conclusies onderbouwen (tegen hallucinatie)."),
});
export type VhpAnalyse = z.infer<typeof vhpAnalyseSchema>;

const SYSTEM = `Je bent jurist-analist voor Op Eigen Erf, een onafhankelijk adviesbureau voor
(mantelzorg)woningen en bijgebouwen op eigen erf. Je krijgt (een gefocust fragment van) de
LETTERLIJKE tekst van een gemeentelijk VOLKSHUISVESTINGSPROGRAMMA (VHP).

Context — de juridische stand van zaken:
- De vergunningvrije mantelzorg-/familiewoning-regeling is LANDELIJK (Besluit bouwwerken
  leefomgeving, art. 2.30b). De instructieregels zijn DWINGEND: een gemeente mag dit type
  bijbehorende bouwwerken als woning niet verbieden.
- Per gemeente verschilt vooral het MOMENT waarop het geldt; de vaststelling van het VHP is
  daarvoor het waarneembare signaal.

Taak: lees de tekst en lever GELDIGE JSON exact volgens het schema. Regels:
- Baseer je UITSLUITEND op de aangeleverde tekst. Verzin niets; niet in de tekst = 'niet genoemd'
  of 'onduidelijk'.
- 'citaten' zijn letterlijke fragmenten uit de tekst (verplicht, minstens 1).
- Let bij 'lokale_bijzonderheden' specifiek op pogingen om mantelzorg/familiewoningen te
  beperken of extra voorwaarden te stellen — dat zou juridisch opvallend zijn (dwingende regel).
- Nederlands, feitelijk, neutraal; geen advies, geen superlatieven.`;

/** Analyseert de VHP-tekst en geeft gestructureerde concept-feiten terug. */
export async function analyseerVhp(gemeente: string, tekst: string): Promise<VhpAnalyse> {
  const model = process.env.REPORT_MODEL || "anthropic/claude-haiku-4-5";
  const { object } = await generateObject({
    model: chatModel(model),
    schema: vhpAnalyseSchema,
    system: SYSTEM,
    prompt:
      `Gemeente: ${gemeente}\n\n` +
      `--- LETTERLIJKE VHP-TEKST (gefocust fragment) ---\n${tekst}\n--- EINDE TEKST ---`,
  });
  return object;
}
