import "server-only";

import { generateObject } from "ai";
import { reportSchema, type ReportContent } from "./report-schema";
import type { Lead, Erfscan } from "./database.types";

const SYSTEM = `Je bent de erfcheck-analist van opeigenerf.nl. Je schrijft een helder,
nuchter en correct Erf Check-rapport voor een particuliere lead die op eigen erf
wil (bij)bouwen (mantelzorg-/familiewoning).

REGELS (cruciaal):
- Gebruik UITSLUITEND de aangeleverde feiten. Verzin niets; noem geen m², jaartal
  of regel die niet in de data staat.
- Data is verdeeld in zekerheidsniveaus. Markeer alles wat 'indicatie' of
  'handmatig' is expliciet als nog te verifiëren. Doe nooit alsof een indicatie
  een juridisch oordeel is (ACM-risico).
- Het Groen/Oranje/Rood-eindoordeel is door de mens bepaald — neem dat oordeel
  over en onderbouw het; verander de kleur niet.
- De vergunningvrije familiewoning (zonder zorgvraag) hangt op het Besluit
  versterking regie volkshuisvesting (nog niet in werking); de mantelzorgroute is
  er nu al mits er een zorgrelatie is. Weeg timing mee als de startwens kort is.
- Schrijf in het Nederlands, vriendelijk maar zakelijk. Geen markdown-opmaak in
  de tekstvelden.`;

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
  const { object } = await generateObject({
    model,
    schema: reportSchema,
    system: SYSTEM,
    prompt:
      `Stel het Erf Check-rapport en een concept-mail op voor deze lead.\n\n` +
      `FEITEN (alleen deze gebruiken):\n${feiten(lead, erfscan)}`,
  });
  return object;
}
