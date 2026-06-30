import { z } from "zod";

// Gestructureerde output die Claude oplevert voor het Erf Check-rapport.
export const reportSchema = z.object({
  conclusie: z
    .enum(["groen", "oranje", "rood"])
    .describe("Eindoordeel kleur. Gebruik het door de mens bevestigde oordeel."),
  conclusie_reden: z
    .string()
    .describe("1-2 zinnen waarom deze kleur, op basis van de feiten."),
  samenvatting: z
    .string()
    .describe("Korte, persoonlijke intro voor de klant (2-4 zinnen)."),
  secties: z
    .array(
      z.object({
        titel: z.string(),
        inhoud: z.string().describe("Lopende tekst, geen markdown-opmaak."),
      }),
    )
    .min(3)
    .max(6)
    .describe(
      "Rapportsecties, o.a.: Routebepaling (mantelzorg vs. familiewoning + timing), " +
        "Perceel & ruimte, Aandachtspunten (handmatig te verifiëren), Vervolgstappen.",
    ),
  concept_mail: z.object({
    onderwerp: z.string(),
    body: z
      .string()
      .describe(
        "Vriendelijke mail aan de lead: kernconclusie + uitnodiging voor een " +
          "gratis adviesgesprek of de betaalde Haalbaarheidsscan. Onderteken met 'Team opeigenerf'.",
      ),
  }),
});

export type ReportContent = z.infer<typeof reportSchema>;
