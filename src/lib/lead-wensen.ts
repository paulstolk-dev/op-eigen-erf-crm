// Leesbare labels + vaste volgorde voor de wensen die de lead in het
// erfcheck-formulier opgeeft: gewenste grootte en budget.
//
// Beide velden kennen naast een concrete keuze de waarde 'unsure' ("weet ik nog
// niet"). Dat is een bewust antwoord, geen leeg veld — we tellen het apart, zodat
// 'ingevuld' niet te rooskleurig wordt.

export const ONBEKEND = "Weet ik nog niet";
export const NIET_INGEVULD = "Niet ingevuld";

const GROOTTE_LABELS: Record<string, string> = {
  "40": "40 m²",
  "60": "60 m²",
  "80": "80 m²",
  "100": "100 m²",
};

const BUDGET_LABELS: Record<string, string> = {
  lt_50000: "< € 50.000",
  "50000_100000": "€ 50.000 – 100.000",
  "100000_150000": "€ 100.000 – 150.000",
  "150000_200000": "€ 150.000 – 200.000",
  "200000_250000": "€ 200.000 – 250.000",
  "250000_plus": "€ 250.000+",
};

// Vaste volgorde: oplopend op maat/bedrag, met de twee 'geen antwoord'-categorieën
// onderaan. Zo lees je de verdeling als een schaal i.p.v. een toplijst.
const GROOTTE_VOLGORDE = ["40", "60", "80", "100"];
const BUDGET_VOLGORDE = [
  "lt_50000",
  "50000_100000",
  "100000_150000",
  "150000_200000",
  "200000_250000",
  "250000_plus",
];

export type Verdeling = { label: string; aantal: number };

function tel(
  waarden: (string | null | undefined)[],
  volgorde: string[],
  labels: Record<string, string>,
): Verdeling[] {
  const telling = new Map<string, number>();
  for (const raw of waarden) {
    const sleutel = raw == null || raw === "" ? "__leeg" : raw;
    telling.set(sleutel, (telling.get(sleutel) ?? 0) + 1);
  }

  const rijen: Verdeling[] = [];
  for (const k of volgorde) {
    if (telling.has(k)) rijen.push({ label: labels[k] ?? k, aantal: telling.get(k)! });
  }
  // Onbekende sleutels (nieuwe formulieropties) niet stilzwijgend laten vallen.
  for (const [k, n] of telling) {
    if (k === "__leeg" || k === "unsure" || volgorde.includes(k)) continue;
    rijen.push({ label: labels[k] ?? k, aantal: n });
  }
  if (telling.has("unsure")) rijen.push({ label: ONBEKEND, aantal: telling.get("unsure")! });
  if (telling.has("__leeg"))
    rijen.push({ label: NIET_INGEVULD, aantal: telling.get("__leeg")! });
  return rijen;
}

export function telGrootte(waarden: (string | null | undefined)[]): Verdeling[] {
  return tel(waarden, GROOTTE_VOLGORDE, GROOTTE_LABELS);
}

export function telBudget(waarden: (string | null | undefined)[]): Verdeling[] {
  return tel(waarden, BUDGET_VOLGORDE, BUDGET_LABELS);
}

// --- Modellen-link op maat -------------------------------------------------
//
// De modellencatalogus op de site filtert via /modellen?grootte=…&budget=…
// (zie src/lib/modellen-filters.ts in de site-repo). Die kent andere waarden dan
// het erfcheck-formulier, dus we vertalen expliciet:
//
//   grootte : de band waar de gewenste maat in valt
//   budget  : een PLAFOND (tot € 75.000 / 125.000 / 200.000)
//
// Bij budget kiezen we bewust het kleinste plafond dat de bovenkant van de band
// van de lead nog omvat. Zo filteren we nooit woningen weg die hij zich kan
// veroorloven; hooguit tonen we er een paar te veel.

const GROOTTE_NAAR_PARAM: Record<string, string> = {
  "40": "tot50",
  "60": "50-75",
  "80": "75-100",
  "100": "100m2",
};

const BUDGET_NAAR_PARAM: Record<string, string> = {
  lt_50000: "75",
  "50000_100000": "125",
  "100000_150000": "200",
  "150000_200000": "200",
  // Boven € 200.000 heeft de catalogus geen plafond meer: alles tonen.
  "200000_250000": "",
  "250000_plus": "",
};

/**
 * Bouwt de modellen-link met de wensen van de lead voorgefilterd. Onbekende of
 * 'weet ik nog niet'-antwoorden laten we weg: dan toont de catalogus gewoon
 * alles, wat beter is dan een lege of misleidende selectie.
 *
 * De link krijgt UTM-tags mee, zodat een lead die hierlangs terugkomt in het
 * bron-overzicht als 'E-mail' herkend wordt en niet als 'Direct'.
 */
export function modellenUrl(
  basis: string,
  grootte: string | null | undefined,
  budget: string | null | undefined,
): string {
  const p = new URLSearchParams();
  const g = grootte ? GROOTTE_NAAR_PARAM[grootte] : undefined;
  if (g) p.set("grootte", g);
  const b = budget ? BUDGET_NAAR_PARAM[budget] : undefined;
  if (b) p.set("budget", b);
  p.set("utm_source", "email");
  p.set("utm_medium", "nurture");
  p.set("utm_campaign", "erfcheck-followup");
  p.set("utm_content", "modellen");
  return `${basis}/modellen?${p.toString()}`;
}
