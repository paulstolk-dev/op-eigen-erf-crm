// Shared domain constants for the opeigenerf CRM.

export const LEAD_STATUSES = [
  "nieuw",
  "contacted",
  "gekwalificeerd",
  "gewonnen",
  "verloren",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  nieuw: "Nieuw",
  contacted: "Gecontacteerd",
  gekwalificeerd: "Gekwalificeerd",
  gewonnen: "Gewonnen",
  verloren: "Verloren",
};

// Tailwind classes per status (badge styling).
export const STATUS_STYLES: Record<LeadStatus, string> = {
  nieuw: "bg-blue-100 text-blue-800 ring-blue-600/20",
  contacted: "bg-amber-100 text-amber-800 ring-amber-600/20",
  gekwalificeerd: "bg-violet-100 text-violet-800 ring-violet-600/20",
  gewonnen: "bg-green-100 text-green-800 ring-green-600/20",
  verloren: "bg-gray-100 text-gray-700 ring-gray-500/20",
};

export const LEAD_TYPES = ["erfcheck", "haalbaarheidsscan"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const TYPE_LABELS: Record<LeadType, string> = {
  erfcheck: "Erfcheck",
  haalbaarheidsscan: "Haalbaarheidsscan",
};

export function isLeadStatus(v: string): v is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(v);
}

export function statusLabel(v: string): string {
  return isLeadStatus(v) ? STATUS_LABELS[v] : v;
}

export function typeLabel(v: string): string {
  return v in TYPE_LABELS ? TYPE_LABELS[v as LeadType] : v;
}

// --- Erfscan ---------------------------------------------------------------

export const ERFSCAN_STATUS_LABELS: Record<string, string> = {
  queued: "In wachtrij",
  enriching: "Bezig met verrijken…",
  needs_review: "Erfscan klaar — review nodig",
  rendered: "Rapport gegenereerd",
  sent: "Rapport verstuurd",
  error: "Fout",
};

export const ERFSCAN_STATUS_STYLES: Record<string, string> = {
  queued: "bg-slate-100 text-slate-700 ring-slate-500/20",
  enriching: "bg-amber-100 text-amber-800 ring-amber-600/20",
  needs_review: "bg-blue-100 text-blue-800 ring-blue-600/20",
  rendered: "bg-violet-100 text-violet-800 ring-violet-600/20",
  sent: "bg-green-100 text-green-800 ring-green-600/20",
  error: "bg-red-100 text-red-800 ring-red-600/20",
};

export function erfscanStatusLabel(v: string): string {
  return ERFSCAN_STATUS_LABELS[v] ?? v;
}

export const CONCLUSIE_LABELS: Record<string, string> = {
  groen: "Groen",
  oranje: "Oranje",
  rood: "Rood",
};

export const CONCLUSIE_STYLES: Record<string, string> = {
  groen: "bg-green-100 text-green-800 ring-green-600/20",
  oranje: "bg-amber-100 text-amber-800 ring-amber-600/20",
  rood: "bg-red-100 text-red-800 ring-red-600/20",
};
