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

---

# Omgevingsplan-poller (`omgevingsplan_poller.py`)

Signaleert wijzigingen in de **vergunningvrij-regels voor bijbehorende bouwwerken**
(bruidsschat) van gemeentelijke omgevingsplannen, via de **SRU 2.0-service** van
Overheid.nl over de officiële publicaties (Gemeenteblad). **Gratis, geen API-key.**

**Relevantiefilter = semantisch, niet op artikelnummer.** Gemeenten verplaatsen de
regels vaak: Utrecht → 4.27/4.28, Groningen → 32.36 (hfst 32 'Voorlopige Regels'),
Haarlemmermeer → hfst 5, Rotterdam → 6.19/6.24. Een 22.36-filter mist die allemaal.
Hybride, met een `zekerheid`-veld:
- **hoog** — een Artikel met **'vergunningvrij'** in het opschrift, of 'bruidsschat'
  in de titel: de regel zélf wordt (ver)plaatst/gewijzigd.
- **indicatie** — een gewijzigd Artikel over bijbehorende bouwwerken/achtererf/
  mantelzorg (géén vergunning*plicht*-artikel), of literal 22.27/22.36 in de tekst.
  Recall-vangnet.

Precisie komt van het feit dat een STOP-wijziging alleen de gewijzigde artikelen
bevat: een locatieplan dat de bruidsschat slechts aanhaalt (of dat over
vergunningplicht gaat) bevat zo'n gewijzigd regel-artikel niet en wordt afgewezen.
`artikel` = de feitelijk geraakte vindplaats(en), komma-gescheiden (bv. `6.19, 6.24`);
de gematchte signaalwoorden staan in `delta` en in de notificatiemail. De poller publiceert nooit — hij schrijft een rij naar
`gemeente_wijzigingen` en pingt het CRM-notificatie-endpoint (werkopdracht per mail);
een mens verwerkt de inhoud. Tabellen: `gemeenten`, `gemeente_wijzigingen`,
`gemeente_checks` (migratie `0023`).

```bash
# Dry-run (default — schrijft niets), verkennen per gemeente:
python omgevingsplan_poller.py --gemeente arnhem --sinds 2026-01-01

# Echt wegschrijven over alle gemeenten met research_status <> 'niet_onderzocht':
python omgevingsplan_poller.py --commit
# Backfill één gemeente:
python omgevingsplan_poller.py --gemeente roermond --commit --sinds 2026-01-01 --limit 20

# Tests (relevantiefilter + type-mapping, met echte fixtures):
python tests/test_omgevingsplan_poller.py
```

**Cursor:** per gemeente `dso_laatst_gepolld` (valt terug op 90 dagen). **Idempotent**
via `on conflict (gemeente_slug, artikel, nieuwe_hash) do nothing` — herhaalde runs
mailen niet opnieuw. De poller raakt de **redactionele** velden
(`omgevingsplan_status`, `afwijking_*`, `gecontroleerd_op`) nooit aan.

**Planning (automatisch):** de poller draait wekelijks via een **Supabase pg_cron**
(`omgevingsplan-poller-weekly`, maandag 06:00 UTC) die `POST /poll` op de
research-service aanroept (secret-guarded, achtergrondthread → `run(commit=True)`
over alle onderzochte gemeenten). Handmatig triggeren kan met dezelfde POST, of
lokaal met de CLI: `python omgevingsplan_poller.py --commit`.

De research-service heeft daarvoor nodig: `SUPABASE_DB_URL`, en voor de mail
`NOTIFY_ENDPOINT` + `NOTIFY_SECRET` (zonder die twee schrijft de run wél naar de
DB maar mailt hij niet).

**Env (extra t.o.v. de crawler):** `NOTIFY_ENDPOINT` + `NOTIFY_SECRET` (voor de
mail-werkopdracht; leeg = wel signaleren, niet mailen).

**Notitie:** v1 leest de openbare bekendmakingen (renvooi/verschilmarkering zit in de
STOP-XML). De DSO Omgevingsdocumenten-API (gratis key) is later een tweede bron voor
gestructureerd diffen op objectniveau — de kolommen `dso_regeling_identificatie` /
`dso_inhoud_hash` zijn daarop voorbereid.
