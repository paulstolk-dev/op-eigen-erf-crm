import { z } from "zod";

// ---------------------------------------------------------------------------
// Social-media content-automation (Fase 1). Client-veilige schemas, types en
// status-constanten (gebruikt door zowel server-acties als client-componenten).
// De AI-generatie zelf staat in socials-generate.ts (server-only).
// ---------------------------------------------------------------------------

// Props-schema = contract met de video-template (video/src/RegelgevingShort.tsx).
export const regelgevingSchema = z.object({
  kicker: z.string().describe("Korte bovenkop, bijv. 'Nieuwe regelgeving'."),
  titel: z.string().describe("Pakkende titel, max ~6 woorden."),
  scenes: z
    .array(
      z.object({
        kop: z.string().describe("Korte scene-kop, 2-4 woorden."),
        tekst: z.string().describe("Feitelijke uitleg, ≤ 18 woorden, gewone taal."),
      }),
    )
    .min(1)
    .max(4),
  nogNietDefinitief: z
    .boolean()
    .describe("true zodra iets over de familiewoning of nog niet ingegane regels gaat."),
  bron: z.string().describe("Verplicht en concreet, bijv. 'Bron: DSO omgevingsplan / Kadaster'."),
  laatstBijgewerkt: z.string().describe("Prijs-/kennispeil, bijv. 'jul 2026'."),
  cta: z.string().describe("Call-to-action, bijv. 'Doe de gratis erfcheck op opeigenerf.nl'."),
});
export type RegelgevingProps = z.infer<typeof regelgevingSchema>;

export const captionSchema = z.object({
  instagram: z.string().describe("IG-caption met hooks + hashtags; disclaimer als iets nog niet definitief is."),
  youtube_title: z.string().describe("YouTube Short-titel, eindig met #Shorts."),
});
export type Caption = z.infer<typeof captionSchema>;

// --- Statusflow -------------------------------------------------------------
export const CONTENT_STATUSSEN = [
  "concept",
  "gerenderd",
  "goedgekeurd",
  "ingepland",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSSEN)[number];

export const STATUS_LABEL: Record<string, string> = {
  concept: "Concept",
  gerenderd: "Gerenderd",
  goedgekeurd: "Goedgekeurd",
  ingepland: "Ingepland",
};

export const STATUS_STYLE: Record<string, string> = {
  concept: "bg-slate-100 text-slate-700 ring-slate-600/20",
  gerenderd: "bg-blue-100 text-blue-800 ring-blue-600/20",
  goedgekeurd: "bg-green-100 text-green-800 ring-green-600/20",
  ingepland: "bg-violet-100 text-violet-800 ring-violet-600/20",
};
