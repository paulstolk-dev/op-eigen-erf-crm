import "server-only";

import { reportBaseUrl } from "@/lib/erfcheck-report";
import { portalBaseUrl } from "@/lib/portaal-magic-link";

// Gebrande, duurzame erfcheck-link voor de klant: opeigenerf.nl/mijn/erf?erf=<token>
// (geen login, report_token is niet-eenmalig), verpakt in de /l/<token>-klik-redirect
// zodat elke klik in de meetlaag telt. Zelfde vorm als de knop in sendReport.
function persoonlijkeErfcheckLink(token: string | null): string {
  if (!token) return "";
  const erfUrl = `${portalBaseUrl()}/mijn/erf?erf=${token}`;
  const q = new URLSearchParams({
    u: Buffer.from(erfUrl, "utf8").toString("base64url"),
    l: "erfcheck-mijn-erf",
  });
  return `${reportBaseUrl()}/l/${token}?${q.toString()}`;
}

// Gedeelde bron voor de EERSTE erfcheck-mail (de erfcheck-levering). Wordt op twee
// plekken gebruikt:
//   * de rapport-concept-mail op de leaddetail (runReportGeneration → draft_email_*)
//   * de eerste stap (e0) van de nurture-flow
// Beide vullen dezelfde tokens met de leadgegevens.

// Intern verdict (groen/oranje/rood) → begrijpelijk woord voor in de mail.
export const VERDICT_WOORD: Record<string, string> = {
  groen: "kansrijk",
  oranje: "twijfelachtig",
  rood: "complex",
};

export type ErfcheckMerge = {
  voornaam: string;
  adres: string; // straat + huisnummer (bijv. "Stuwdijk 1")
  postcode_plaats: string; // postcode + plaats (bijv. "7251KL Vorden")
  verdict: string; // kansrijk / twijfelachtig / complex (= erfcheck_status)
  perceel_m2: string;
  erfcheck_url: string; // CRM /r/<token>-pagina (interne/fallback-view)
  persoonlijke_erfcheck_link: string; // gebrande /mijn/erf-link via /l/-tracker
  token: string;
};

type MergeInput = {
  voornaam: string | null;
  naam: string | null;
  postcode: string | null;
  huisnummer: string | null;
  report_token: string | null;
  conclusie: string | null;
  weergavenaam?: string | null;
  oppervlakte_m2?: number | null;
};

// Bouwt de merge-waarden uit lead + erfscan. Splitst de weergavenaam
// ("Straat nr, postcodePlaats") op de eerste komma in adres + postcode_plaats.
export function buildErfcheckMerge(i: MergeInput): ErfcheckMerge {
  const weergavenaam = (i.weergavenaam ?? "").trim();
  const komma = weergavenaam.indexOf(",");
  const adres =
    komma > 0
      ? weergavenaam.slice(0, komma).trim()
      : [i.postcode, i.huisnummer].filter(Boolean).join(" ") || "uw erf";
  const postcode_plaats =
    komma > 0 ? weergavenaam.slice(komma + 1).trim() : (i.postcode ?? "");
  return {
    voornaam: i.voornaam || i.naam?.split(" ")[0] || "",
    adres,
    postcode_plaats,
    verdict: i.conclusie ? (VERDICT_WOORD[i.conclusie] ?? i.conclusie) : "nog te bepalen",
    perceel_m2: i.oppervlakte_m2 != null ? `± ${i.oppervlakte_m2} m²` : "n.b.",
    erfcheck_url: i.report_token ? `${reportBaseUrl()}/r/${i.report_token}` : "",
    persoonlijke_erfcheck_link: persoonlijkeErfcheckLink(i.report_token),
    token: i.report_token ?? "",
  };
}

// Vervangt alle ondersteunde {{tokens}} (incl. de alias-namen erfcheck_status en
// persoonlijke_erfcheck_link) door hun waarden. Ruimt ook een lege aanhef op.
export function fillErfcheckTemplate(text: string, m: ErfcheckMerge): string {
  return text
    .replace(/\{\{\s*voornaam\s*\}\}/g, m.voornaam)
    .replace(/\{\{\s*adres\s*\}\}/g, m.adres)
    .replace(/\{\{\s*postcode_plaats\s*\}\}/g, m.postcode_plaats)
    .replace(/\{\{\s*verdict\s*\}\}/g, m.verdict)
    .replace(/\{\{\s*erfcheck_status\s*\}\}/g, m.verdict)
    .replace(/\{\{\s*perceel_m2\s*\}\}/g, m.perceel_m2)
    .replace(/\{\{\s*erfcheck_url\s*\}\}/g, m.erfcheck_url)
    .replace(/\{\{\s*persoonlijke_erfcheck_link\s*\}\}/g, m.persoonlijke_erfcheck_link)
    .replace(/Beste\s+,/g, "Beste,")
    .replace(/Hoi\s+,/g, "Hoi,");
}

// De standaard eerste-mail (onderwerp + body). Zelfde tekst als de e0-stap in de
// nurture-flow; de leaddetail-rapportmail vult deze template ook.
export const ERFCHECK_FIRST_SUBJECT =
  "Uw Gratis Erfcheck voor {{adres}} staat klaar";

export const ERFCHECK_FIRST_BODY = `Beste {{voornaam}},

Bedankt voor uw aanvraag van de Gratis Erfcheck.

Ik heb een eerste beoordeling gemaakt op basis van de gegevens die u heeft ingevuld en de openbare informatie die beschikbaar is voor: {{adres}}, {{postcode_plaats}}

Uw resultaat staat klaar.
Op basis van de eerste check lijkt uw erf {{erfcheck_status}}, maar er zijn nog een paar punten die belangrijk zijn om goed te beoordelen voordat u aanbieders benadert of kosten gaat maken.

De belangrijkste aandachtspunten zijn:

• of de gewenste plek op het erf geschikt is;
• welke route het meest logisch is: mantelzorgwoning, familiewoning of een andere woonoplossing;
• welke grootte realistisch is op uw erf;
• welk budget past bij uw wensen;
• of de financiering of beschikbare middelen al voldoende duidelijk zijn;
• welke regels of gemeentelijke voorwaarden nog gecontroleerd moeten worden.

U kunt uw resultaat hier bekijken en direct aanvullen:
{{persoonlijke_erfcheck_link}}

Als u daar uw gewenste grootte, budget, toepassing en financieringssituatie invult, kunnen wij veel gerichter aangeven welke vervolgstap logisch is. Daarmee voorkomt u dat u te vroeg offertes aanvraagt op basis van onduidelijke uitgangspunten.

Wilt u meer zekerheid over regelgeving, risico's en kosten? Dan is de Haalbaarheidsscan de logische volgende stap. Daarin werken we de eerste indicatie verder uit en krijgt u een duidelijker beeld van wat waarschijnlijk kan, waar de risico's zitten en welke route verstandig is.

U kunt de Haalbaarheidsscan hier aanvragen:
https://opeigenerf.nl/haalbaarheidsscan

Wilt u liever eerst kort overleggen? Dan kunt u ook een gratis kennismakingsgesprek plannen:
https://opeigenerf.nl/kennismaking

Met vriendelijke groet,
Paul Stolk
OpEigenErf.nl
Onafhankelijk advies voor wonen op eigen erf`;
