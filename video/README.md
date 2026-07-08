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

## Gebruik

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
