import type { Lead, Erfscan } from "@/lib/database.types";

// Leadscore — kwaliteit/prioriteit van de lead (los van de erfcheck-conclusie).
// Regel: tel een factor alleen mee als de info bekend is. Uitzondering: budget
// 'onbekend of laag' is een expliciete -20 (een lead die geen budget deelt is
// minder kansrijk), conform de scorecriteria.

export type ScoreLabel = "groen" | "oranje" | "rood";
export type ScoreFactor = { factor: string; punten: number };

export const SCORE_STYLES: Record<ScoreLabel, string> = {
  groen: "bg-green-100 text-green-800 ring-green-600/20",
  oranje: "bg-amber-100 text-amber-800 ring-amber-600/20",
  rood: "bg-red-100 text-red-800 ring-red-600/20",
};

export const SCORE_ACTIE: Record<ScoreLabel, string> = {
  groen: "Persoonlijk bellen + haalbaarheidsscan aanbieden",
  oranje: "Adviesgesprek aanbieden",
  rood: "E-mail met uitleg + eventueel later opvolgen",
};

// Korte actie voor in de dashboardtabel.
export const SCORE_ACTIE_KORT: Record<ScoreLabel, string> = {
  groen: "Bellen + scan",
  oranje: "Adviesgesprek",
  rood: "E-mail / nurture",
};

function parseBudget(budget?: string | null): number | null {
  if (!budget) return null;
  const nums = (budget.match(/\d[\d.]*/g) || [])
    .map((x) => parseInt(x.replace(/\./g, ""), 10))
    .filter((n) => !isNaN(n) && n >= 1000);
  return nums.length ? Math.max(...nums) : null;
}

function termijnBinnen12(startdatum?: string | null, planning?: string | null): boolean | null {
  const t = [startdatum, planning].filter(Boolean).join(" ").toLowerCase();
  if (!t) return null;
  const m = t.match(/(\d+)\s*maand/);
  if (m) return parseInt(m[1], 10) <= 12;
  if (/binnen (een|1) jaar|dit jaar|zo snel|z\.?s\.?m|per direct|acuut/.test(t)) return true;
  if (/orient|oriën|later|lange termijn|geen haast|\b[2-9]\s*jaar/.test(t)) return false;
  return null;
}

export function labelForScore(score: number): ScoreLabel {
  if (score >= 70) return "groen";
  if (score >= 40) return "oranje";
  return "rood";
}

export type LeadScore = {
  score: number;
  label: ScoreLabel;
  actie: string;
  breakdown: ScoreFactor[];
};

export function scoreLead(lead: Lead, erfscan?: Erfscan | null): LeadScore {
  const b: ScoreFactor[] = [];
  const details = (lead.details ?? {}) as Record<string, unknown>;
  const dossier = (erfscan?.dossier ?? {}) as Record<string, any>;
  const audience = (lead.audience ?? "").toLowerCase();
  const hay = [lead.audience, lead.planning, lead.startdatum, JSON.stringify(details)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // + Eigen erf aanwezig (erfscan vond een perceel)
  const perceel = dossier.perceel;
  if (perceel && (perceel.status === "ok" || perceel.oppervlakte_m2)) {
    b.push({ factor: "Eigen erf aanwezig", punten: 20 });
  }

  // + Grote tuin / ruim perceel (≥ 500 m²)
  const opp = perceel?.oppervlakte_m2;
  if (typeof opp === "number" && opp >= 500) {
    b.push({ factor: `Ruim perceel (${opp} m²)`, punten: 20 });
  }

  // + Doel is ouders / kind / mantelzorg
  if (["ouders", "kind", "kinderen", "mantelzorg"].includes(audience)) {
    b.push({ factor: "Doel: familie/mantelzorg", punten: 20 });
  }

  // Budget: > €100k = +20; bekend & laag óf onbekend = -20
  const budget = parseBudget(lead.budget);
  if (budget !== null) {
    if (budget > 100000) b.push({ factor: "Budget boven €100.000", punten: 20 });
    else b.push({ factor: "Budget laag (< €100.000)", punten: -20 });
  } else {
    b.push({ factor: "Budget onbekend", punten: -20 });
  }

  // + Termijn binnen 12 maanden
  if (termijnBinnen12(lead.startdatum, lead.planning) === true) {
    b.push({ factor: "Termijn binnen 12 maanden", punten: 10 });
  }

  // + Foto / schets meegestuurd
  if (
    details.foto ||
    details.fotos ||
    details.schets ||
    details.situatieschets ||
    details.bijlage ||
    /foto|schets/.test(hay)
  ) {
    b.push({ factor: "Foto/schets meegestuurd", punten: 10 });
  }

  // - Alleen oriënteren
  if (/orient|oriën|alleen kijk|verkenn/.test(hay)) {
    b.push({ factor: "Alleen oriënteren", punten: -10 });
  }

  // - Wil verhuren aan derden
  if (audience === "verhuur" || /verhuur|verhuren|aan derden/.test(hay)) {
    b.push({ factor: "Verhuur aan derden", punten: -30 });
  }

  // - Recreatiewoning / vakantiegebruik
  if (/recreat|vakantie/.test(hay)) {
    b.push({ factor: "Recreatie/vakantiegebruik", punten: -20 });
  }

  const score = b.reduce((sum, x) => sum + x.punten, 0);
  const label = labelForScore(score);
  return { score, label, actie: SCORE_ACTIE[label], breakdown: b };
}
