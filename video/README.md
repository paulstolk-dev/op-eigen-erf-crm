# opeigenerf-video — Remotion-renderproject (Socials, Fase 1)

Rendert merkvaste **regelgeving-shorts** (1080×1920, IG Reel + YouTube Short) uit
de `content_queue` van het CRM. Het CRM (`/socials`) schrijft de scripts (Claude,
met verplichte bron + "nog niet definitief"-markering); dit project rendert ze en
zet de video terug in het CRM ter goedkeuring.

## Keten

```
CRM /socials  → Claude schrijft props+caption → content_queue (status='concept')
video/        → render.mjs rendert → upload naar 'socials'-bucket → status='gerenderd' + video_url
CRM /socials  → jij bekijkt video + caption → status='goedgekeurd'
scheduler     → goedgekeurde mp4 + caption → Metricool/Publer (IG Reel + YouTube Short)
```

## Eenmalige setup

```bash
cd video
npm install
# Zet de merk-assets in public/ (zie public/ASSETS.md):
#   oe-monogram.png, wordmark-wit.png, Carlito-Regular.ttf, Carlito-Bold.ttf
cp .env.example .env      # vul SUPABASE_URL + SUPABASE_SERVICE_KEY (service_role JWT)
```

## Renderen op Railway (aanbevolen)

macOS kan Remotion's compositor pas vanaf macOS 13+ draaien; op oudere macOS
faalt de render (ffmpeg-symbol-error). Draai daarom op **Railway** (Linux),
net als de research-crawler. De service is een kleine HTTP-server (`server.mjs`)
die het CRM triggert.

**Eenmalige deploy:**
1. Nieuw Railway-project → deploy vanuit deze git-repo, **Root Directory = `video`**
   (Railway pakt dan `Dockerfile` + `railway.json`).
2. Zet op de Railway-service de env-vars:
   - `SUPABASE_URL` = `https://eyzhcmdydisaokqzqyli.supabase.co`
   - `SUPABASE_SERVICE_KEY` = de service_role JWT
   - `VIDEO_RENDER_SECRET` = een zelfgekozen geheim (zelfde waarde in Vercel bij het CRM)
3. In het CRM/Vercel: `VIDEO_RENDER_ENDPOINT` = de publieke Railway-URL,
   `VIDEO_RENDER_SECRET` = hetzelfde geheim.

De merk-assets (fonts + logo's) staan in de Supabase-bucket `socials/_assets/`
en worden bij het opstarten opgehaald (`ensure-assets.mjs`) — ze hoeven dus niet
in git of de image. Nieuwe/gewijzigde assets uploaden:
`node --env-file=.env scripts/upload-assets.mjs`.

**Trigger:** in het CRM op **`/socials`** → knop **Render** (POST `/render` met
`x-render-secret`). De server rendert alle `concept`-afleveringen, uploadt de mp4
naar de `socials`-bucket en zet ze op `gerenderd` + `video_url`.
`GET /` is een health check.

## Lokaal (alleen op macOS 13+ / Linux)

Preview + handmatig bijstellen in de studio:

```bash
npm run studio
```

Batchrenderen:

```bash
npm run render        # Supabase-modus (env gezet): rendert alle concepts, zet ze op 'gerenderd'
```

Zonder Supabase-env draait `render.mjs` in **offline-modus**: kopieer
`content/queue.example.json` naar `content/queue.json` en het schrijft
`out/<slug>.mp4`.

## Goedkeuren = merk-kritisch poortje

Dit automatiseer je nooit: de propositie is *onafhankelijk + defensible claims*.
Bekijk elke video + caption en check (1) klopt de regelgeving en staat de bron
erbij, (2) staat de amber-badge erop als iets nog niet definitief is, (3) geen
ACM-gevoelige claim. Akkoord → in het CRM op **Goedgekeurd** zetten.

## Inplannen (scheduler)

Kies één tool die IG Reels én YouTube Shorts autopublisht via zijn eigen
(goedgekeurde) koppeling — dan hoef je in Fase 1 géén Meta App Review en géén
YouTube compliance-audit te doen: **Metricool** (EU) of **Publer**. Upload de
goedgekeurde mp4, plak de caption, plan als Reel + Short. Begin met 2–3 posts/week.
