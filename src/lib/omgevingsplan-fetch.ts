import "server-only";

// Haalt de STOP-XML van een Gemeenteblad-publicatie op (via het publicatie-id, bv.
// 'gmb-2025-541104') en extraheert de VOLLEDIGE tekst van het vergunningvrij-
// bijbehorende-bouwwerken-artikel — de grondstof voor de AI-analyse. Grounded:
// we geven Claude de échte regeltekst, geen samenvatting uit geheugen.

const REPO_BASE = "https://repository.overheid.nl/frbr/officielepublicaties";

export function docXmlUrl(pubId: string): string | null {
  const m = /^gmb-(\d{4})-\d+$/.exec(pubId || "");
  if (!m) return null;
  return `${REPO_BASE}/gmb/${m[1]}/${pubId}/1/xml/${pubId}.xml`;
}

export function bronUrlVan(pubId: string): string {
  return `https://zoek.officielebekendmakingen.nl/${pubId}.html`;
}

function stripTags(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const ART_RE = /<(?:\w+:)?Artikel\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Artikel>/g;
const OPSCHRIFT_RE = /<(?:\w+:)?(?:Opschrift|Kop)\b[^>]*>([\s\S]*?)<\/(?:\w+:)?(?:Opschrift|Kop)>/i;

function opschriftVan(inner: string): string {
  const m = OPSCHRIFT_RE.exec(inner);
  return m ? stripTags(m[1]) : "";
}

/** Zoekt in de STOP-XML het relevante artikel en geeft de volledige tekst terug.
 *  Voorkeur: opschrift met 'vergunningvrij' (+ bijbehorend). Fallback: opschrift over
 *  bijbehorend bouwwerk/achtererf; anders de hele publicatie ingekort. */
export function extractArtikelTekst(xml: string, maxLen = 9000): string {
  const kandidaten: { score: number; tekst: string }[] = [];
  let m: RegExpExecArray | null;
  ART_RE.lastIndex = 0;
  while ((m = ART_RE.exec(xml))) {
    const inner = m[1];
    const op = opschriftVan(inner);
    if (!op) continue;
    const heeftVV = /vergunningvrij/i.test(op);
    const heeftBij = /bijbehorend/i.test(op);
    const heeftBreed = /bijbehorend|achtererf|mantelzorg/i.test(op);
    const isPlicht = /vergunningplicht|beoordelingsregel/i.test(op);
    let score = 0;
    if (heeftVV && heeftBij) score = 3;
    else if (heeftVV) score = 2;
    else if (heeftBreed && !isPlicht) score = 1;
    if (score > 0) kandidaten.push({ score, tekst: stripTags(inner) });
  }
  kandidaten.sort((a, b) => b.score - a.score || b.tekst.length - a.tekst.length);
  if (kandidaten.length) return kandidaten[0].tekst.slice(0, maxLen);
  // Geen herkenbaar artikel → hele publicatie ingekort (Claude weegt het).
  return stripTags(xml).slice(0, maxLen);
}

/** Haalt de publicatie op en extraheert de relevante artikeltekst. */
export async function fetchArtikelTekst(
  pubId: string,
): Promise<{ tekst: string; bronUrl: string } | { error: string }> {
  const url = docXmlUrl(pubId);
  if (!url) return { error: `Ongeldig publicatie-id: ${pubId}` };
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "OpEigenErf-CRM/1.0 (+https://opeigenerf.nl)" },
      cache: "no-store",
    });
    if (!res.ok) return { error: `Publicatie ophalen mislukt (${res.status}).` };
    const xml = await res.text();
    return { tekst: extractArtikelTekst(xml), bronUrl: bronUrlVan(pubId) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Netwerkfout bij ophalen publicatie." };
  }
}
