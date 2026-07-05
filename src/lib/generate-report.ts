import "server-only";

import { generateObject } from "ai";
import { reportSchema, type ReportContent } from "./report-schema";
import { getSetting, DEFAULT_EMAIL_PROMPT, SETTING_KEYS } from "./settings";
import type { Lead, Erfscan } from "./database.types";

const SYSTEM = `Je bent de erfcheck-analist van opeigenerf.nl. Je schrijft een gratis Erf Check
voor een particuliere lead die op eigen erf wil (bij)bouwen (mantelzorg-/familiewoning).

DOEL van de erfcheck — geef concreet antwoord op 5 vragen:
1. Ligt er voldoende ruimte op het achtererf?
2. Kan er mogelijk vergunningvrij gebouwd of geplaatst worden?
3. Gaat het om mantelzorg, familiewoning, pré-mantelzorg of reguliere bewoning?
4. Welke regels of risico's kunnen het plan blokkeren?
5. Wat is de logische vervolgstap?

TOON: concreet en praktisch, NIET te juridisch. Denk: "wat lijkt hier mogelijk,
waar zitten de risico's, wat is de beste vervolgstap?" Scanbaar, in gewone taal.

REGELS (cruciaal):
- Gebruik UITSLUITEND de aangeleverde feiten. Verzin niets; noem geen m², jaartal
  of regel die niet in de data staat.
- Data heeft zekerheidsniveaus. Markeer alles wat 'indicatie' of 'handmatig' is als
  nog te verifiëren. Geef GEEN definitief juridisch oordeel (ACM-risico); geef een
  sterke eerste richting ("op basis van de eerste check lijkt er ruimte", "de
  grootste onzekerheid zit in...", "de volgende logische stap is...").
- Het Groen/Oranje/Rood-eindoordeel is door de mens bepaald — neem dat over en
  onderbouw het; verander de kleur niet.
- Route: mantelzorg is nu al vergunningvrij mits er een zorgrelatie is (na afloop
  mantelzorg vervalt het zelfstandig woongebruik). De vergunningvrije FAMILIEwoning
  (eerstegraads familie, zonder zorgvraag) valt onder de Wet versterking regie
  volkshuisvesting die per 1 juli 2026 in werking treedt; voorwaarden o.a.:
  achtererf, bijbehorend bouwwerk bij een woning, max. oppervlakte afhankelijk van
  het bebouwingsgebied, max. bouwhoogte 5 m (schuin dak boven 3 m). Formuleer als
  "op basis van de landelijke regeling lijkt dit mogelijk, mits voldaan wordt aan de
  voorwaarden en lokale beperkingen." Weeg timing mee bij een korte startwens.
- Sluit de concept-mail af met beide links: het gratis adviesgesprek
  (https://opeigenerf.nl/kennismaking) en de Haalbaarheidsscan à €495
  (https://opeigenerf.nl/haalbaarheidsscan), verrekenbaar bij begeleiding.
- De concept-mail leest als een normale, persoonlijke e-mail: nette aanhef,
  lopende alinea's, vriendelijke afsluiting. GEEN kleurcodering-legenda
  (zoals "GROEN = ..."), GEEN 'eindscore'-regel, GEEN kapitalen-koppen. Vermijd
  anglicismen en kromme zinnen; correct, vlot Nederlands.
- Schrijf in het Nederlands, vriendelijk maar zakelijk. Geen markdown-opmaak.`;

function feiten(lead: Lead, erfscan: Erfscan): string {
  const d = (erfscan.dossier ?? {}) as Record<string, unknown>;
  const t3 = (erfscan.tier3 ?? {}) as Record<string, unknown>;
  const sug = (d.tier3_suggesties ?? {}) as Record<string, { zekerheid?: string }>;

  // Combineer mens-bevestigde Tier-3 met de zekerheid van de bron.
  const tier3Lines = Object.entries(t3).map(([k, v]) => {
    const zek = sug[k]?.zekerheid ?? "handmatig";
    return `  - ${k}: ${v} (zekerheid: ${zek})`;
  });

  return JSON.stringify(
    {
      lead: {
        naam: lead.naam,
        doelgroep: lead.audience,
        startdatum: lead.startdatum,
        budget: lead.budget,
        type: lead.type,
      },
      bevestigd_eindoordeel: erfscan.conclusie,
      locatie: d.locatie,
      perceel: d.perceel,
      bag: d.bag,
      ruimtelijk: d.ruimtelijk,
      kansen: d.kansen,
      aandachtspunten: d.flags,
      tier3_bevestigd: tier3Lines,
    },
    null,
    2,
  );
}

export async function generateReportContent(
  lead: Lead,
  erfscan: Erfscan,
): Promise<ReportContent> {
  const model = process.env.REPORT_MODEL || "anthropic/claude-haiku-4-5";
  // Bewerkbare concept-mail-instructie uit de instellingen.
  const emailPrompt = await getSetting(
    SETTING_KEYS.reportEmailPrompt,
    DEFAULT_EMAIL_PROMPT,
  );
  const { object } = await generateObject({
    model,
    schema: reportSchema,
    system: SYSTEM,
    prompt:
      `Stel het Erf Check-rapport en een concept-mail op voor deze lead.\n\n` +
      `FEITEN (alleen deze gebruiken):\n${feiten(lead, erfscan)}\n\n` +
      `INSTRUCTIES VOOR DE CONCEPT-MAIL (concept_mail):\n${emailPrompt}`,
  });
  return object;
}
