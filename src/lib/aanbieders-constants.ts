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

// Alle geldige partnerstatussen (voor validatie + de status-dropdown).
export const PARTNER_STATUS = [
  "nieuw",
  "benaderd",
  "afspraak_gepland",
  "partner",
  "afgewezen",
] as const;
// De funnel-stadia (voorwaartse route); 'afgewezen' is een losse terminale status.
export const PARTNER_FUNNEL = [
  "nieuw",
  "benaderd",
  "afspraak_gepland",
  "partner",
] as const;
export const PARTNER_STATUS_LABELS: Record<string, string> = {
  nieuw: "Nieuw",
  benaderd: "Benaderd",
  afspraak_gepland: "Afspraak gepland",
  partner: "Partner",
  afgewezen: "Afgewezen",
};
export const PARTNER_STATUS_STYLES: Record<string, string> = {
  nieuw: "bg-slate-100 text-slate-600 ring-slate-400/20",
  benaderd: "bg-amber-100 text-amber-700 ring-amber-600/20",
  afspraak_gepland: "bg-blue-100 text-blue-700 ring-blue-600/20",
  partner: "bg-green-100 text-green-700 ring-green-600/20",
  afgewezen: "bg-red-100 text-red-700 ring-red-600/20",
};

// Review-status voor gescrapete aanbieders/woningen (bron='scrape').
export const SCRAPE_REVIEW_STATUS = ["nieuw", "ok", "afgewezen"] as const;
export const SCRAPE_REVIEW_STATUS_LABELS: Record<string, string> = {
  nieuw: "Te beoordelen",
  ok: "Gepubliceerd",
  afgewezen: "Afgewezen",
};
export const SCRAPE_REVIEW_STATUS_STYLES: Record<string, string> = {
  nieuw: "bg-amber-100 text-amber-700 ring-amber-600/20",
  ok: "bg-green-100 text-green-700 ring-green-600/20",
  afgewezen: "bg-red-100 text-red-700 ring-red-600/20",
};

// Modeltype (meerdere mogelijk per model) — kolom woningen.woningtypes (text[]).
export const WONINGTYPES = ["mantelzorgwoning", "familiewoning", "tuinkantoor"] as const;
export const WONINGTYPE_LABELS: Record<string, string> = {
  mantelzorgwoning: "Mantelzorgwoning",
  familiewoning: "Familiewoning",
  tuinkantoor: "Tuinkantoor",
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

// Toon-hostname uit een website-URL. Robuust tegen ontbrekende scheme
// (bv. "woningopmaat.nl") zodat een kale domeinwaarde de pagina niet laat crashen.
export function hostnameOf(url: string | null | undefined): string {
  if (!url) return "—";
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    return new URL(withScheme).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./, "").replace(/\/.*$/, "");
  }
}
