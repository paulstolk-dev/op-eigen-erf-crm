# Aanbieder-research-crawler

Ontdekt nieuwe aanbieders van mantelzorg-/prefab-/modulaire woningen, oogst per
site de modellen + foto's, laat Claude er gestructureerde JSON van maken en
parkeert alles als **concept** (`actief=false, bron='scrape', review_status='nieuw'`)
in Supabase. Foto's gaan naar de privé-bucket `aanbieder-scrape` en worden pas na
review in het CRM naar de publieke bucket gekopieerd.

Dit is een **operator-tool**, bewust los van de Vercel-app (geen functietimeouts /
cron-limieten). Draait op **Railway** of lokaal.

## Bestanden
- `aanbieder_research.py` — de pipeline (CLI + herbruikbare functies).
- `server.py` — dunne FastAPI-wrapper met `POST /run` (secret-guarded), zodat het
  CRM de crawl met een knop kan starten.
- `requirements.txt`, `Procfile`, `railway.json`, `.env.example`.

## Lokaal draaien
```bash
cd research
python -m venv .venv && . .venv/Scripts/activate   # of source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # vul de waarden in; laad ze in je shell

# Dry-run (schrijft naar ./out/*.json, niets naar Supabase):
python aanbieder_research.py --discover --limit 3
python aanbieder_research.py --seed sites.txt      # 'naam, url' per regel

# Echt wegschrijven:
python aanbieder_research.py --discover --limit 3 --commit
```

## HTTP-server (voor het CRM / Railway)
```bash
uvicorn server:app --host 0.0.0.0 --port 8000
# Start een run (draait op de achtergrond, antwoordt 202):
curl -X POST http://localhost:8000/run \
  -H "x-research-secret: $RESEARCH_TRIGGER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"mode":"discover","limit":5}'
# Bestaande aanbieder her-scrapen (stage nieuwe modellen/foto's):
curl -X POST http://localhost:8000/run -H "x-research-secret: $RESEARCH_TRIGGER_SECRET" \
  -H "Content-Type: application/json" -d '{"mode":"refresh","aanbieder_id":"<uuid>"}'
```

## Railway
1. Nieuwe service → deploy vanaf deze map (`research/`) of vanuit de repo met root
   `research`. Nixpacks detecteert Python via `requirements.txt`; start-commando
   staat in `railway.json` / `Procfile`.
2. Zet de env-variabelen uit `.env.example` (Variables-tab).
3. Optioneel: een Railway-cron die periodiek `POST /run {"mode":"discover"}` doet.

## Env
Zie `.env.example`. `SUPABASE_DB_URL` = de directe Postgres-pooler-string uit
Supabase (Connect → ORMs). `SUPABASE_SERVICE_KEY` = de service-role key (voor
Storage-upload). `CLAUDE_MODEL` moet web_search ondersteunen (Sonnet 5 / Opus 4.6+).

## Review in het CRM
De concepten verschijnen onder **Aanbieders → Research** (`/aanbieders/research`):
per aanbieder de modellen + kandidaatfoto's, met **Publiceren** (kopieert gekozen
foto's naar de publieke bucket en zet het model live) of **Afwijzen**.
