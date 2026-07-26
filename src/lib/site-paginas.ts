// Vaste lijst van de statische publieke pagina's op opeigenerf.nl, voor het
// beheer van per-pagina SEO-overrides (titel + meta-description) op /website.
// Dynamische routes (/aanbieders/[slug], /modellen/[woning]) staan hier niet in:
// die krijgen data-gedreven SEO, geen per-pagina override.
//
// Houd deze lijst in sync met de app-routes van de site-repo (opeigenerf).

export type SitePagina = { pad: string; label: string; groep: string };

export const SITE_PAGINAS: SitePagina[] = [
  { pad: "/", label: "Home", groep: "Hoofd" },
  { pad: "/aanbieders", label: "Aanbieders", groep: "Hoofd" },
  { pad: "/modellen", label: "Modellen", groep: "Hoofd" },
  { pad: "/diensten", label: "Diensten", groep: "Hoofd" },
  { pad: "/kennisbank", label: "Kennisbank", groep: "Hoofd" },
  { pad: "/kennismaking", label: "Kennismaking", groep: "Hoofd" },
  { pad: "/gratis-erfcheck", label: "Gratis Erfcheck", groep: "Hoofd" },
  { pad: "/gratis-erfcheck/bedankt", label: "Gratis Erfcheck — bedankt", groep: "Hoofd" },
  { pad: "/haalbaarheidsscan", label: "Haalbaarheidsscan", groep: "Hoofd" },
  { pad: "/kostencalculator", label: "Kostencalculator", groep: "Hoofd" },
  { pad: "/woning-op-eigen-erf-begeleiding", label: "Woning op eigen erf — begeleiding", groep: "Hoofd" },

  { pad: "/mantelzorgwoning", label: "Mantelzorgwoning", groep: "Mantelzorgwoning" },
  { pad: "/mantelzorgwoning/40m2", label: "Mantelzorgwoning — 40 m²", groep: "Mantelzorgwoning" },
  { pad: "/mantelzorgwoning/50m2", label: "Mantelzorgwoning — 50 m²", groep: "Mantelzorgwoning" },
  { pad: "/mantelzorgwoning/60m2", label: "Mantelzorgwoning — 60 m²", groep: "Mantelzorgwoning" },
  { pad: "/mantelzorgwoning/70m2", label: "Mantelzorgwoning — 70 m²", groep: "Mantelzorgwoning" },
  { pad: "/mantelzorgwoning/80m2", label: "Mantelzorgwoning — 80 m²", groep: "Mantelzorgwoning" },
  { pad: "/mantelzorgwoning/100m2", label: "Mantelzorgwoning — 100 m²", groep: "Mantelzorgwoning" },
  { pad: "/mantelzorgwoning/kosten", label: "Mantelzorgwoning — kosten", groep: "Mantelzorgwoning" },
  { pad: "/mantelzorgwoning/plaatsen", label: "Mantelzorgwoning — plaatsen", groep: "Mantelzorgwoning" },
  { pad: "/mantelzorgwoning/regels", label: "Mantelzorgwoning — regels", groep: "Mantelzorgwoning" },
  { pad: "/mantelzorgwoning/offerte-begeleiding", label: "Mantelzorgwoning — offerte-begeleiding", groep: "Mantelzorgwoning" },

  { pad: "/familiewoning", label: "Familiewoning", groep: "Familiewoning" },

  { pad: "/tuinkantoor", label: "Tuinkantoor", groep: "Tuinkantoor" },
  { pad: "/tuinkantoor/15m2", label: "Tuinkantoor — 15 m²", groep: "Tuinkantoor" },
  { pad: "/tuinkantoor/20m2", label: "Tuinkantoor — 20 m²", groep: "Tuinkantoor" },
  { pad: "/tuinkantoor/25m2", label: "Tuinkantoor — 25 m²", groep: "Tuinkantoor" },
  { pad: "/tuinkantoor/30m2", label: "Tuinkantoor — 30 m²", groep: "Tuinkantoor" },

  { pad: "/vergunningsvrij", label: "Vergunningsvrij", groep: "Vergunningsvrij" },
  { pad: "/vergunningsvrij/per-gemeente", label: "Vergunningsvrij — per gemeente", groep: "Vergunningsvrij" },

  { pad: "/algemene-voorwaarden", label: "Algemene voorwaarden", groep: "Juridisch" },
  { pad: "/privacybeleid", label: "Privacybeleid", groep: "Juridisch" },
];

// Volgorde van de groepen in de UI.
export const SITE_PAGINA_GROEPEN = [
  "Hoofd",
  "Mantelzorgwoning",
  "Familiewoning",
  "Tuinkantoor",
  "Vergunningsvrij",
  "Juridisch",
] as const;
