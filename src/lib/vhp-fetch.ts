import "server-only";

// Haalt de volledige tekst van een volkshuisvestingsprogramma-publicatie op (via het
// gmb-publicatie-id) en bouwt een KEYWORD-GEFOCUST fragment: de intro + tekstvensters
// rond de termen die voor Op Eigen Erf tellen (mantelzorg/familie, vergunningvrij,
// welstand/beschermd, vaststelling). Zo blijft de AI-analyse gegrond én betaalbaar,
// ook bij een VHP van 100k+ tekens.

import { docXmlUrl, bronUrlVan } from "./omgevingsplan-fetch";

function stripTags(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#160;|&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const KW =
  /(mantelzorg|familiewon|familie-?won|eerstegraads|vergunningvrij|bijbehorend bouwwerk|aanleunwon|welstand|beschermd|monument|erfgoed|vastgesteld|de raad besluit|raadsbesluit|in\s?werking|besluit van de raad)/gi;

/** Intro + gededupliceerde vensters rond de relevante signaalwoorden. */
export function vhpExcerpt(full: string, maxLen = 12000): string {
  const head = full.slice(0, 2500);
  const vensters: string[] = [];
  const gezien = new Set<number>();
  let m: RegExpExecArray | null;
  KW.lastIndex = 0;
  while ((m = KW.exec(full))) {
    const s = Math.max(0, m.index - 240);
    const e = Math.min(full.length, m.index + 360);
    const bucket = Math.floor(s / 400);
    if (gezien.has(bucket)) continue;
    gezien.add(bucket);
    vensters.push("…" + full.slice(s, e).trim() + "…");
    if (head.length + vensters.join("\n").length > maxLen) break;
  }
  return (head + "\n\n" + vensters.join("\n")).slice(0, maxLen);
}

/** Haalt de VHP-publicatie op en geeft een gegrond, gefocust tekstfragment terug. */
export async function fetchVhpTekst(
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
    const full = stripTags(await res.text());
    if (full.length < 40) return { error: "Publicatie bevat geen leesbare tekst." };
    return { tekst: vhpExcerpt(full), bronUrl: bronUrlVan(pubId) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Netwerkfout bij ophalen publicatie." };
  }
}
