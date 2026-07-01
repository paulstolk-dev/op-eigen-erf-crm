import { z } from "zod";

// Gestructureerde output voor het Erf Check-rapport. Volgt de 6-delige opzet:
// 1) Samenvatting  2) Locatie & perceel  3) Regelcheck  4) Kansen
// 5) Aandachtspunten  6) Advies & vervolgstap. Toon: concreet, niet juridisch.
export const reportSchema = z.object({
  doel_type: z
    .enum([
      "mantelzorg",
      "familiewoning",
      "pre_mantelzorg",
      "regulier",
      "orientatie",
      "onbekend",
    ])
    .describe(
      "Classificatie van het doel o.b.v. doelgroep + zorgvraag. Ouders/kinderen = eerstegraads → mantelzorg of familiewoning (afhankelijk van zorgvraag).",
    ),
  conclusie: z
    .enum(["groen", "oranje", "rood"])
    .describe("Neem het door de mens bevestigde eindoordeel over; verander de kleur niet."),
  advies_vervolgstap: z.enum([
    "gratis_adviesgesprek",
    "haalbaarheidsscan",
    "begeleidingstraject",
  ]),
  samenvatting: z
    .string()
    .describe("2-4 zinnen, persoonlijk en concreet: wat lijkt mogelijk op dit erf."),

  // 'In het kort' — de 5 kernvragen, elk in één concrete zin.
  kort: z.object({
    ruimte_achtererf: z.string().describe("Q1: Ligt er voldoende ruimte op het achtererf?"),
    vergunningvrij: z
      .string()
      .describe("Q2: Kan er mogelijk vergunningvrij gebouwd/geplaatst worden? (indicatie)"),
    route: z
      .string()
      .describe("Q3: mantelzorg, familiewoning, pré-mantelzorg of reguliere bewoning?"),
    risicos: z.string().describe("Q4: Welke regels of risico's kunnen het plan blokkeren?"),
    vervolgstap: z.string().describe("Q5: Wat is de logische vervolgstap?"),
  }),

  locatie_perceel: z
    .string()
    .describe(
      "Sectie 2: perceelgrootte, ligging hoofdwoning, vermoedelijk achtererfgebied, bestaande bebouwing en beschikbare ruimte. Concreet, geen juridisch jargon.",
    ),
  regelcheck: z
    .string()
    .describe(
      "Sectie 3: wat mag nu? Vergunningvrij (technisch + ruimtelijk), achtererfgebied, " +
        "bebouwingsgebied, max. oppervlakte, hoogte/dakvorm, gebruik (mantelzorg/familiewoning) " +
        "inclusief 'nu en straks' t.a.v. de Wet versterking regie volkshuisvesting (per 1-7-2026 " +
        "in werking; familiewoning-voorwaarden). Formuleer indicaties voorzichtig: 'lijkt mogelijk, mits...'.",
    ),
  kansen: z.array(z.string()).min(2).max(6),
  aandachtspunten: z.array(z.string()).min(2).max(6),
  advies_tekst: z
    .string()
    .describe(
      "Sectie 6: eerlijk maar commercieel. Waarom de haalbaarheidsscan de logische vervolgstap is.",
    ),

  concept_mail: z.object({
    onderwerp: z.string(),
    body: z
      .string()
      .describe("Mail aan de lead: kernconclusie + uitnodiging. Onderteken met 'Team opeigenerf'."),
  }),
});

export type ReportContent = z.infer<typeof reportSchema>;
