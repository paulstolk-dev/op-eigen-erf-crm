import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ensureBroll } from "./veo.mjs";

// Kern van de batch-render. Twee modi:
//   • Supabase-modus (env SUPABASE_URL + SUPABASE_SERVICE_KEY): haalt
//     status='concept' uit content_queue, rendert, uploadt de mp4 naar de
//     'socials'-bucket en zet status='gerenderd' + video_url(_landscape).
//   • Offline-modus: leest content/queue.json en schrijft out/<slug>.mp4.
//
// Per-artikel items (met b-roll-prompts) krijgen eerst Veo-beeldgeneratie en
// worden in TWEE formaten gerenderd (9:16 short/reel + 16:9 YouTube).
// Legacy thema-items (zonder b-roll) blijven één 9:16-render.

async function renderFormat(serveUrl, item, settings, broll, outPath) {
  const timeoutInMilliseconds = 120000;
  const inputProps = {
    ...item.props,
    ...(settings ? { settings } : {}),
    ...(broll && broll.length ? { broll, brollSeconds: Number(process.env.VEO_SECONDS) || 8 } : {}),
  };
  const composition = await selectComposition({
    serveUrl,
    id: "RegelgevingShort",
    inputProps,
    timeoutInMilliseconds,
  });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    inputProps,
    outputLocation: outPath,
    timeoutInMilliseconds,
    concurrency: Number(process.env.RENDER_CONCURRENCY) || 1,
    chromiumOptions: { enableMultiProcessOnLinux: true },
  });
}

export async function renderAll() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const useSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

  mkdirSync("out", { recursive: true });
  const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });

  let sb = null;
  let queue = [];
  let settings;
  if (useSupabase) {
    sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
    const { data: setRow } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "video_settings")
      .maybeSingle();
    if (setRow?.value) {
      try {
        settings = JSON.parse(setRow.value);
      } catch {
        /* val terug op de template-defaults */
      }
    }
    const { data, error } = await sb
      .from("content_queue")
      .select("id, slug, props, broll, broll_urls")
      .eq("status", "concept");
    if (error) throw error;
    queue = data ?? [];
    console.log(
      `Supabase-modus: ${queue.length} concept-aflevering(en); settings ${settings ? "geladen" : "default"}`,
    );
  } else {
    queue = JSON.parse(readFileSync("content/queue.json", "utf8"));
    console.log(`Offline-modus (queue.json): ${queue.length} aflevering(en)`);
  }

  // Portret- (9:16) en landschap- (16:9) varianten van de settings.
  const base = settings ?? {};
  const portret = { ...base, width: base.width || 1080, height: base.height || 1920 };
  const landschap = { ...base, width: 1920, height: 1080 };

  const rendered = [];
  for (const item of queue) {
    const heeftBroll = Array.isArray(item.broll) && item.broll.length > 0;

    // 1) Beeldlaag: zorg dat de Veo-clips bestaan (alleen per-artikel items).
    let broll = null;
    if (heeftBroll && useSupabase) {
      try {
        broll = await ensureBroll(sb, item);
      } catch (e) {
        console.error("  ✗ Veo-generatie mislukt, item overgeslagen:", item.slug, e.message ?? e);
        continue;
      }
    }

    // 2) Renders. Met b-roll: 9:16 + 16:9. Zonder: één 9:16.
    try {
      const outPortret = `out/${item.slug}.mp4`;
      await renderFormat(serveUrl, item, portret, broll, outPortret);
      console.log("✓ gerenderd (9:16):", item.slug);

      let outLandschap = null;
      if (heeftBroll) {
        outLandschap = `out/${item.slug}-landscape.mp4`;
        await renderFormat(serveUrl, item, landschap, broll, outLandschap);
        console.log("✓ gerenderd (16:9):", item.slug);
      }

      rendered.push(item.slug);

      if (useSupabase && item.id) {
        const patch = { status: "gerenderd" };
        patch.video_url = await uploadMp4(sb, `${item.slug}.mp4`, outPortret);
        if (outLandschap) {
          patch.video_url_landscape = await uploadMp4(sb, `${item.slug}-landscape.mp4`, outLandschap);
        }
        await sb.from("content_queue").update(patch).eq("id", item.id);
        console.log("  ↑ geüpload + status=gerenderd");
      }
    } catch (e) {
      console.error("  ✗ render/upload mislukt:", item.slug, e.message ?? e);
    }
  }
  return rendered;
}

async function uploadMp4(sb, storagePath, localPath) {
  const bytes = readFileSync(localPath);
  const up = await sb.storage
    .from("socials")
    .upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });
  if (up.error) throw up.error;
  const { data: pub } = sb.storage.from("socials").getPublicUrl(storagePath);
  return pub.publicUrl;
}
