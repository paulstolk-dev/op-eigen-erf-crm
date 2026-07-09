import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// Kern van de batch-render. Twee modi:
//   • Supabase-modus (env SUPABASE_URL + SUPABASE_SERVICE_KEY): haalt
//     status='concept' uit content_queue, rendert, uploadt de mp4 naar de
//     'socials'-bucket en zet status='gerenderd' + video_url.
//   • Offline-modus: leest content/queue.json en schrijft out/<slug>.mp4.
// Geeft de lijst gerenderde slugs terug.
export async function renderAll() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const useSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

  mkdirSync("out", { recursive: true });
  const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });

  let sb = null;
  let queue = [];
  let settings; // video-instellingen uit app_settings (kleuren/duur/logo/fps)
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
      .select("id, slug, props")
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

  const rendered = [];
  for (const item of queue) {
    // Ruime delayRender-timeout: koude Chromium + font-load haalt de default 30s
    // niet altijd in een container.
    const timeoutInMilliseconds = 120000;
    // Video-instellingen in de props mergen (kleuren/duur/logo/fps).
    const inputProps = settings ? { ...item.props, settings } : item.props;
    const composition = await selectComposition({
      serveUrl, id: "RegelgevingShort", inputProps,
      timeoutInMilliseconds,
    });
    const outPath = `out/${item.slug}.mp4`;
    await renderMedia({
      composition, serveUrl, codec: "h264",
      inputProps,
      outputLocation: outPath,
      timeoutInMilliseconds,
      // In een container: 1 Chromium-tab tegelijk (default = 1 per CPU-core, wat
      // op Railway het geheugen laat vollopen → OOM-kill). Overschrijfbaar via env.
      concurrency: Number(process.env.RENDER_CONCURRENCY) || 1,
      chromiumOptions: { enableMultiProcessOnLinux: true },
    });
    console.log("✓ gerenderd:", item.slug);
    rendered.push(item.slug);

    if (useSupabase && item.id) {
      try {
        const bytes = readFileSync(outPath);
        const storagePath = `${item.slug}.mp4`;
        const up = await sb.storage
          .from("socials")
          .upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });
        if (up.error) throw up.error;
        const { data: pub } = sb.storage.from("socials").getPublicUrl(storagePath);
        await sb
          .from("content_queue")
          .update({ status: "gerenderd", video_url: pub.publicUrl })
          .eq("id", item.id);
        console.log("  ↑ geüpload + status=gerenderd");
      } catch (e) {
        console.error("  ✗ upload/CRM-update mislukt:", item.slug, e.message ?? e);
      }
    }
  }
  return rendered;
}
