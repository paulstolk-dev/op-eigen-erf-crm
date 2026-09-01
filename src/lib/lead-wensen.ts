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
