import { z } from "zod";

// Video-instellingen (spiegelt src/lib/video-settings.ts in het CRM). Worden als
// prop 'settings' meegegeven aan de compositie; render-core leest ze uit
// app_settings.video_settings en merget ze in de inputProps.
export const settingsSchema = z.object({
  width: z.number().default(1080),
  height: z.number().default(1920),
  fps: z.number().default(30),
  intro: z.number().default(3.5),
  perScene: z.number().default(9),
  outro: z.number().default(4.5),
  bg: z.string().default("#f3efe6"),
  accent: z.string().default("#6b8563"),
  card: z.string().default("#ffffff"),
  text: z.string().default("#2c2a24"),
  radius: z.number().default(28),
  logoPosition: z.enum(["linksboven", "rechtsonder"]).default("rechtsonder"),
  logoSize: z.number().default(200),
  logoUrl: z.string().nullable().default(null),
  logoPath: z.string().nullable().default(null),
});

export type VideoSettings = z.infer<typeof settingsSchema>;

export const defaultSettings: VideoSettings = settingsSchema.parse({});
