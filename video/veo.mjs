// Veo 3.1 b-roll-generatie via de Gemini API (predictLongRunning). Genereert per
// shot een sfeerclip, downloadt de mp4 en uploadt die naar de 'socials'-bucket
// onder broll/<slug>-N.mp4. Draait op de renderworker (lange operaties).
const API = "https://generativelanguage.googleapis.com/v1beta";

function apiKey() {
  const k = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY (of GOOGLE_API_KEY) niet gezet.");
  return k;
}
const MODEL = () => process.env.VEO_MODEL || "veo-3.1-fast-generate-preview";
// Bronverhouding van de b-roll. 16:9 = native landscape + nette center-crop naar 9:16.
const ASPECT = () => process.env.VEO_ASPECT || "16:9";

async function startVeo(prompt) {
  const res = await fetch(`${API}/models/${MODEL()}:predictLongRunning`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { aspectRatio: ASPECT(), personGeneration: "allow_adult" },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.name) {
    throw new Error(`Veo start ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data.name;
}

function extractUri(response) {
  const s =
    response?.generateVideoResponse?.generatedSamples ??
    response?.generatedSamples ??
    response?.generatedVideos ??
    response?.videos;
  const first = Array.isArray(s) ? s[0] : undefined;
  return first?.video?.uri ?? first?.video?.url ?? first?.uri ?? first?.url ?? null;
}

async function pollVeo(opName, timeoutMs = 600000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 10000));
    const res = await fetch(`${API}/${opName}`, { headers: { "x-goog-api-key": apiKey() } });
    const data = await res.json().catch(() => ({}));
    if (data.error) throw new Error(`Veo-operatie fout: ${JSON.stringify(data.error).slice(0, 300)}`);
    if (data.done) {
      const uri = extractUri(data.response);
      if (!uri) throw new Error(`Veo klaar maar geen video-uri: ${JSON.stringify(data.response).slice(0, 400)}`);
      return uri;
    }
  }
  throw new Error("Veo time-out (>10 min).");
}

async function downloadVeo(uri) {
  const sep = uri.includes("?") ? "&" : "?";
  const url = uri.includes("key=") ? uri : `${uri}${sep}key=${apiKey()}`;
  const res = await fetch(url, { headers: { "x-goog-api-key": apiKey() } });
  if (!res.ok) throw new Error(`Veo download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Zorgt dat de 3 b-roll-clips voor een queue-item bestaan. Idempotent: als er al
// broll_urls staan, hergebruikt het die. Retourneert de publieke URLs op volgorde.
export async function ensureBroll(sb, item) {
  if (Array.isArray(item.broll_urls) && item.broll_urls.length > 0) {
    return item.broll_urls;
  }
  const shots = [...(item.broll ?? [])].sort((a, b) => a.shot - b.shot);
  if (shots.length === 0) return [];

  await sb.from("content_queue").update({ broll_status: "bezig" }).eq("id", item.id);
  try {
    const urls = [];
    for (const shot of shots) {
      console.log(`  🎬 Veo shot ${shot.shot} (${MODEL()}, ${ASPECT()})…`);
      const op = await startVeo(shot.veo_prompt);
      const uri = await pollVeo(op);
      const bytes = await downloadVeo(uri);
      const path = `broll/${item.slug}-${shot.shot}.mp4`;
      const up = await sb.storage
        .from("socials")
        .upload(path, bytes, { contentType: "video/mp4", upsert: true });
      if (up.error) throw up.error;
      const { data: pub } = sb.storage.from("socials").getPublicUrl(path);
      urls.push(pub.publicUrl);
      console.log(`  ↑ ${path}`);
    }
    await sb
      .from("content_queue")
      .update({ broll_urls: urls, broll_status: "klaar" })
      .eq("id", item.id);
    return urls;
  } catch (e) {
    await sb
      .from("content_queue")
      .update({ broll_status: "fout" })
      .eq("id", item.id)
      .then(() => {}, () => {});
    throw e;
  }
}
