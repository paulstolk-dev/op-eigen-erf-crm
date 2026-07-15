import http from "node:http";
import { ensureAssets } from "./ensure-assets.mjs";
import { renderAll } from "./render-core.mjs";

// HTTP-trigger voor Railway (spiegelt research/server.py). Het CRM roept
// POST /render aan met VIDEO_RENDER_SECRET; de render draait in de achtergrond
// (kan minuten duren) en antwoordt direct 202. GET / is een health check.
const PORT = process.env.PORT || 3000;
const SECRET = process.env.VIDEO_RENDER_SECRET;

// Versiemarker: bump bij elke worker-wijziging zodat je in de startup-log en op
// GET /status ziet welke code live is (voorkomt gokken op deploy/commit).
const VERSION = "broll-music-7";

let running = false;
let last = { state: "idle" };

async function doRender() {
  running = true;
  last = { state: "running", startedAt: new Date().toISOString() };
  try {
    await ensureAssets();
    const rendered = await renderAll();
    last = { state: "done", rendered, finishedAt: new Date().toISOString() };
    console.log("[render] klaar:", rendered.join(", ") || "(niets)");
  } catch (e) {
    last = { state: "error", error: String(e?.message ?? e), finishedAt: new Date().toISOString() };
    console.error("[render] mislukt:", e);
  } finally {
    running = false;
  }
}

const server = http.createServer((req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  if (req.method === "GET" && (req.url === "/" || req.url === "/status")) {
    return send(200, { ok: true, version: VERSION, running, last });
  }

  if (req.method === "POST" && req.url === "/render") {
    if (SECRET) {
      const provided =
        req.headers["authorization"]?.replace(/^Bearer\s+/i, "") ??
        req.headers["x-render-secret"];
      if (provided !== SECRET) return send(401, { error: "Unauthorized" });
    }
    if (running) return send(409, { error: "Er draait al een render." });
    doRender(); // fire-and-forget
    return send(202, { ok: true, message: "Render gestart." });
  }

  send(404, { error: "Not found" });
});

server.listen(PORT, () => console.log(`video-render server op :${PORT} — versie ${VERSION}`));
