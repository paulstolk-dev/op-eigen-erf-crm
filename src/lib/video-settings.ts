// Client-veilige video-instellingen voor de social-shorts. Opgeslagen als één
// JSON-string in app_settings (sleutel 'video_settings'); de Remotion-render leest
// dezelfde JSON en past 'm toe. GEEN server-only import → bruikbaar in de UI.

export const VIDEO_SETTINGS_KEY = "video_settings";

export type LogoPosition = "linksboven" | "rechtsonder";

export type VideoSettings = {
  width: number;
  height: number;
  fps: number;
  // Timings in seconden; totale duur = intro + scenes × perScene + outro.
  intro: number;
  perScene: number;
  outro: number;
  // Kleuren + vorm.
  bg: string; // achtergrond
  accent: string; // accenten (koppen, nummers, badges)
  card: string; // kaartvlakken
  text: string; // hoofdtekst
  radius: number; // hoekafronding cards (px)
  // Logo.
  logoPosition: LogoPosition;
  logoPath: string | null; // pad in de 'socials'-bucket, bijv. "_assets/logo.png"
  logoUrl: string | null; // publieke URL (preview in CRM + render)
};

// Defaults = de afgesproken huisstijl (beige/donkergroen/witte cards, rustig).
export const defaultVideoSettings: VideoSettings = {
  width: 1080,
  height: 1920,
  fps: 30,
  intro: 3.5,
  perScene: 9,
  outro: 4.5,
  bg: "#f3efe6",
  accent: "#6b8563",
  card: "#ffffff",
  text: "#2c2a24",
  radius: 28,
  logoPosition: "rechtsonder",
  logoPath: null,
  logoUrl: null,
};

// Totale duur (sec) bij een gegeven aantal scenes.
export function videoDuration(s: VideoSettings, scenes: number): number {
  return s.intro + scenes * s.perScene + s.outro;
}

// Merge opgeslagen JSON over de defaults (robuust tegen ontbrekende/oude velden).
export function parseVideoSettings(raw: string | null | undefined): VideoSettings {
  if (!raw) return { ...defaultVideoSettings };
  try {
    const o = JSON.parse(raw) as Partial<VideoSettings>;
    return { ...defaultVideoSettings, ...o };
  } catch {
    return { ...defaultVideoSettings };
  }
}
