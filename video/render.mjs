import { ensureAssets } from "./ensure-assets.mjs";
import { renderAll } from "./render-core.mjs";

// CLI: `npm run render`. Haalt de merk-assets op (indien nodig) en rendert de
// hele queue (Supabase-modus als de env gezet is, anders offline via queue.json).
await ensureAssets();
const rendered = await renderAll();
console.log(`Klaar. ${rendered.length} video(s).`);
