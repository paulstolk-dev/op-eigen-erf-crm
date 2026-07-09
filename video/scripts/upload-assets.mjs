// Eenmalig/hulp: uploadt de merk-assets uit public/ naar de Supabase-bucket
// 'socials' onder de prefix `_assets/`. De Railway-renderserver haalt ze daar
// bij het opstarten weer op (zie ensure-assets.mjs). Draai met:
//   node --env-file=.env scripts/upload-assets.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) {
  console.error("SUPABASE_URL en SUPABASE_SERVICE_KEY vereist (node --env-file=.env ...).");
  process.exit(1);
}

const ASSETS = [
  { file: "Carlito-Regular.ttf", type: "font/ttf" },
  { file: "Carlito-Bold.ttf", type: "font/ttf" },
  { file: "oe-monogram.png", type: "image/png" },
  { file: "wordmark-wit.png", type: "image/png" },
];

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

for (const a of ASSETS) {
  const bytes = readFileSync(path.resolve("public", a.file));
  const dest = `_assets/${a.file}`;
  const { error } = await sb.storage
    .from("socials")
    .upload(dest, bytes, { contentType: a.type, upsert: true });
  if (error) {
    console.error(`✗ ${a.file}:`, error.message);
    process.exit(1);
  }
  console.log(`✓ geüpload: socials/${dest} (${bytes.length} bytes)`);
}
console.log("Klaar.");
