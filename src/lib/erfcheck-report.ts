import type { Lead } from "@/lib/database.types";

// Gedeelde Erf Check-rapportconstants + helpers, gebruikt door zowel de PDF
// (report-pdf.tsx) als de publieke webpagina (/r/[token]).

export const BRAND = "#0a1b2b"; // navy
export const ERF = "#718d69"; // groen
export const SCAN_URL = "https://opeigenerf.nl/haalbaarheidsscan";
export const KENNISMAKING_URL = "https://opeigenerf.nl/kennismaking";

// Scan-link met de leadgegevens vooringevuld (?email=&postcode=&huisnummer=…).
export function buildScanUrl(lead: Lead): string {
  const p = new URLSearchParams();
  if (lead.email) p.set("email", lead.email);
  if (lead.postcode) p.set("postcode", lead.postcode);
  if (lead.huisnummer) p.set("huisnummer", lead.huisnummer);
  if (lead.toevoeging) p.set("toevoeging", lead.toevoeging);
  const qs = p.toString();
  return qs ? `${SCAN_URL}?${qs}` : SCAN_URL;
}

// Uitslag (intern groen/oranje/rood) → begrijpelijk woord + kleur + toelichting.
export const CONCLUSIE: Record<
  string,
  { woord: string; kleur: string; uitleg: string }
> = {
  groen: {
    woord: "Kansrijk",
    kleur: "#16a34a",
    uitleg:
      "Geautomatiseerde indicatie op basis van je perceelgrootte. Dit is nog geen bouwoordeel — de exacte ruimte in je achtererf volgt in de uitgebreide scan.",
  },
  oranje: {
    woord: "Twijfelachtig",
    kleur: "#d97706",
    uitleg:
      "Er zijn aandachtspunten die eerst uitgezocht moeten worden. De uitgebreide scan geeft zekerheid over de regels, ruimte en risico's.",
  },
  rood: {
    woord: "Complex",
    kleur: "#dc2626",
    uitleg:
      "Er spelen beperkingen die je plan kunnen blokkeren. Een gratis adviesgesprek of de uitgebreide scan brengt de risico's scherp in beeld.",
  },
};

export const SCAN_PUNTEN = [
  "luchtfoto met de bestaande bebouwing ingemeten",
  "exacte berekening van de ruimte in jóuw achtererf",
  "kostenindicatie in prijsbanden",
  "advies over passende woningtypes",
  "de route die bij jouw situatie past",
  "een concreet stappenplan",
];
