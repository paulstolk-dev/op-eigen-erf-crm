// Herleidt het marketingkanaal van een lead uit de attributiegegevens die de site
// meestuurt (details.utm_*, details.gclid, details.referrer).
//
// Let op het verschil met leads.source: dát veld zegt via wélk formulier/pagina de
// lead binnenkwam ('gratis-erfcheck', 'familiewoning'). Hier gaat het om het kanaal
// dat de bezoeker naar de site bracht — Google Ads, organisch, ChatGPT, direct.

export type LeadBronVelden = {
  details?: unknown;
};

// De UTM-parameters staan meestal los in details, maar bij sommige formulieren
// alleen in de opgeslagen landings-URL. Beide paden afdekken.
function utmUit(details: Record<string, unknown>, key: string): string | null {
  const direct = details[key];
  if (typeof direct === "string" && direct.trim()) return direct.trim().toLowerCase();

  const pageUrl = details.source_page_url;
  if (typeof pageUrl === "string") {
    const m = new RegExp(`[?&]${key}=([^&\\s]+)`).exec(pageUrl);
    if (m) return decodeURIComponent(m[1]).toLowerCase();
  }
  return null;
}

function referrerHost(details: Record<string, unknown>): string | null {
  const ref = details.referrer;
  if (typeof ref !== "string" || !ref.trim()) return null;
  try {
    return new URL(ref).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Kanaal van één lead. Retourneert een vaste, leesbare label-set. */
export function leadBron(lead: LeadBronVelden): string {
  const details = (lead.details ?? {}) as Record<string, unknown>;

  const source = utmUit(details, "utm_source");
  const medium = utmUit(details, "utm_medium");

  // 1) Betaald: expliciete UTM óf een Google-klik-id (gclid staat er ook zonder UTM).
  const betaald =
    medium === "ppc" ||
    medium === "cpc" ||
    medium === "paid" ||
    source === "adwords" ||
    source === "googleads";
  if (betaald || (typeof details.gclid === "string" && details.gclid)) {
    return "Google Ads";
  }

  // 2) Eigen e-mail (nurture/opvolgmails).
  if (medium === "nurture" || medium === "email" || source === "email") return "E-mail";

  // 3) Overige UTM-bronnen — o.a. de AI-assistenten die zichzelf zo aankondigen.
  if (source) {
    const bekend = AI_EN_ZOEK[source.replace(/^www\./, "")];
    if (bekend) return bekend;
    return source.charAt(0).toUpperCase() + source.slice(1);
  }

  // 4) Geen UTM → afleiden uit de verwijzende site.
  const host = referrerHost(details);
  if (host) {
    if (host === "mail.google.com") return "E-mail";
    if (host.endsWith("opeigenerf.nl")) return "Direct";
    const bekend = AI_EN_ZOEK[host];
    if (bekend) return bekend;
    if (/(^|\.)google\./.test(host)) return "Google (organisch)";
    return `Verwijzing: ${host}`;
  }

  // 5) Niets bekend: rechtstreeks ingetypt, bookmark of referrer weggevallen.
  return "Direct";
}

// Hosts/UTM-bronnen die we onder één herkenbare naam willen zien.
const AI_EN_ZOEK: Record<string, string> = {
  "chatgpt.com": "ChatGPT",
  "chat.openai.com": "ChatGPT",
  "openai.com": "ChatGPT",
  "copilot.com": "Copilot",
  "copilot.microsoft.com": "Copilot",
  "perplexity.ai": "Perplexity",
  "gemini.google.com": "Gemini",
  "claude.ai": "Claude",
  "bing.com": "Bing",
  "duckduckgo.com": "DuckDuckGo",
  "search.brave.com": "Brave",
  "nl.search.yahoo.com": "Yahoo",
  "search.yahoo.com": "Yahoo",
  "facebook.com": "Facebook",
  "instagram.com": "Instagram",
  "linkedin.com": "LinkedIn",
};

/** Telt leads per kanaal, aflopend gesorteerd. */
export function telPerBron(leads: LeadBronVelden[]): { bron: string; aantal: number }[] {
  const telling = new Map<string, number>();
  for (const l of leads) {
    const b = leadBron(l);
    telling.set(b, (telling.get(b) ?? 0) + 1);
  }
  return Array.from(telling, ([bron, aantal]) => ({ bron, aantal })).sort(
    (a, b) => b.aantal - a.aantal || a.bron.localeCompare(b.bron),
  );
}
