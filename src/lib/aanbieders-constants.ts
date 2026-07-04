// Gedeelde enum-waarden + Nederlandse labels voor de aanbieders/woningen-UI.

export const VERGUNNINGSBEGELEIDING = ["ja", "nee", "niet_vermeld"] as const;
export const VERGUNNINGSBEGELEIDING_LABELS: Record<string, string> = {
  ja: "Ja",
  nee: "Nee",
  niet_vermeld: "Niet vermeld",
};

export const PRIJSKLASSE = ["budget", "standaard", "luxe"] as const;
export const PRIJSKLASSE_LABELS: Record<string, string> = {
  budget: "Budget (€)",
  standaard: "Standaard (€€)",
  luxe: "Luxe (€€€)",
};

export const AFWERKINGSNIVEAUS = ["casco", "instapklaar", "luxe"] as const;
export const AFWERKINGSNIVEAU_LABELS: Record<string, string> = {
  casco: "Casco",
  instapklaar: "Instapklaar",
  luxe: "Luxe",
};

export const AANBOD_TYPE = ["koop", "huur", "tweedehands"] as const;
export const AANBOD_TYPE_LABELS: Record<string, string> = {
  koop: "Koop",
  huur: "Huur",
  tweedehands: "Tweedehands",
};

export const BTW_BASIS = ["incl", "ex"] as const;
export const BTW_BASIS_LABELS: Record<string, string> = {
  incl: "Incl. btw",
  ex: "Excl. btw",
};

// slug uit een naam: lowercase, diacritics weg, niet-alfanumeriek -> streepje.
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Prijs (hele euro's) -> "€ 1.234" of "Op aanvraag" bij null.
export function euro(n: number | null | undefined): string {
  if (n === null || n === undefined) return "Op aanvraag";
  return "€ " + n.toLocaleString("nl-NL");
}
