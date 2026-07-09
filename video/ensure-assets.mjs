import { createClient } from "@supabase/supabase-js";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

// Haalt de merk-assets (fonts + logo's) uit de Supabase-bucket 'socials/_assets/'
// naar public/ als ze lokaal ontbreken. Zo hoeven de (gitignored) binaries niet
// in de repo/Docker-image; de renderserver haalt ze bij het opstarten op.
const ASSETS = [
  "Carlito-Regular.ttf",
  "Carlito-Bold.ttf",
  "oe-monogram.png",
  "wordmark-wit.png",
];

export async function ensureAssets({ force = false } = {}) {
  mkdirSync("public", { recursive: true });
  const missing = ASSETS.filter(
    (f) => force || !existsSync(path.resolve("public", f)),
  );
  if (missing.length === 0) return;

  const URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!URL || !KEY) {
    console.warn(
      `[assets] ontbreken lokaal (${missing.join(", ")}) en geen Supabase-env om ze op te halen.`,
    );
    return;
  }

  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  for (const f of missing) {
    const { data, error } = await sb.storage
      .from("socials")
      .download(`_assets/${f}`);
    if (error) throw new Error(`asset-download mislukt (${f}): ${error.message}`);
    const buf = Buffer.from(await data.arrayBuffer());
    writeFileSync(path.resolve("public", f), buf);
    console.log(`[assets] ↓ ${f} (${buf.length} bytes)`);
  }
}
