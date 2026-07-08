import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// Batch-renderen. Twee modi:
//   • Supabase-modus (aanbevolen): haalt status='concept' uit content_queue,
//     rendert, uploadt de mp4 naar de 'socials'-bucket en zet status='gerenderd'
//     + video_url. Het CRM (/socials) toont dan de video ter goedkeuring.
//     Vereist env SUPABASE_URL + SUPABASE_SERVICE_KEY (service_role JWT).
//   • Offline-modus: leest content/queue.json en schrijft out/<slug>.mp4.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const useSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

mkdirSync('out', { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });

let sb = null;
let queue = [];
if (useSupabase) {
  sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from('content_queue')
    .select('id, slug, props')
    .eq('status', 'concept');
  if (error) throw error;
  queue = data ?? [];
  console.log(`Supabase-modus: ${queue.length} concept-aflevering(en) te renderen`);
} else {
  queue = JSON.parse(readFileSync('content/queue.json', 'utf8'));
  console.log(`Offline-modus (queue.json): ${queue.length} aflevering(en)`);
}

for (const item of queue) {
  const composition = await selectComposition({
    serveUrl, id: 'RegelgevingShort', inputProps: item.props,
  });
  const outPath = `out/${item.slug}.mp4`;
  await renderMedia({
    composition, serveUrl, codec: 'h264',
    inputProps: item.props,
    outputLocation: outPath,
  });
  console.log('✓ gerenderd:', item.slug);

  if (useSupabase && item.id) {
    try {
      const bytes = readFileSync(outPath);
      const storagePath = `${item.slug}.mp4`;
      const up = await sb.storage
        .from('socials')
        .upload(storagePath, bytes, { contentType: 'video/mp4', upsert: true });
      if (up.error) throw up.error;
      const { data: pub } = sb.storage.from('socials').getPublicUrl(storagePath);
      await sb
        .from('content_queue')
        .update({ status: 'gerenderd', video_url: pub.publicUrl })
        .eq('id', item.id);
      console.log('  ↑ geüpload + status=gerenderd');
    } catch (e) {
      console.error('  ✗ upload/CRM-update mislukt:', item.slug, e.message ?? e);
    }
  }
}

console.log('Klaar.');
