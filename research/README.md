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

# VHP-readiness-poller (`vhp_poller.py`) — actief

Signaleert per gemeente de **vaststelling van het volkshuisvestingsprogramma (VHP)**,
via de **SRU 2.0-service** van Overheid.nl (Gemeenteblad). **Gratis, geen API-key.**

**Waarom deze i.p.v. de omgevingsplan-poller (hieronder):** met de Wet/Besluit
versterking regie volkshuisvesting verhuizen de vergunningvrije mantelzorg-/
familiewoning-regels **terug naar het Rijk** (art. 22.36 omgevingsplan → Bbl art.
2.30b, landelijk uniform). Inhoudelijk valt er per gemeente vrijwel niets meer te
monitoren; wat wél verschilt, is het **moment** waarop het ingaat. Het beste
waarneembare signaal daarvoor is de VHP-vaststelling.

> **Nog niet definitief:** of het toepasbare moment per gemeente écht aan de
> VHP-vaststelling hangt, of dat de landelijke Bbl-regel al bij inwerkingtreding van
> het Besluit (~jan 2027) rechtstreeks geldt, is niet eenduidig. De poller
> **registreert alleen het signaal**; de interpretatie is aan de mens.

**Relevantiefilter = semantisch** (titel bevat *volkshuisvestingsprogramma*), met
`status` + `zekerheid`:
- **vastgesteld / hoog** — raadsbesluit of OWMS-doctype "besluit van algemene
  strekking". Alleen deze mailen (`NOTIFY_ALLEEN_HOOG`, standaard aan).
- **ontwerp / indicatie** — "ontwerp"/"ter inzage"/"voornemen" in de titel.
- **onbekend / indicatie** — VHP-term aanwezig, geen duidelijk signaal (recall-vangnet).

De poller **publiceert nooit** en vult **geen** redactionele velden (`vhp_status`,
`gecontroleerd_op`). Bij een treffer schrijft hij een rij naar `gemeente_wijzigingen`
(`type = vhp_vastgesteld|vhp_ontwerp`, `artikel = 'volkshuisvestingsprogramma'`) en
pingt het CRM-notificatie-endpoint. Vereist **migratie `0028`** (vhp_*-enumwaarden).

```bash
# Dry-run (default — schrijft niets), verkennen per gemeente (backfill bij onboarding):
python vhp_poller.py --gemeente woensdrecht --sinds 2024-01-01

# Echt wegschrijven over alle onderzochte gemeenten:
python vhp_poller.py --commit
python vhp_poller.py --gemeente aalten --commit --sinds 2024-01-01

# Tests (relevantiefilter + backfill-cursor, met echte titels/doctypes):
python -m unittest discover -s tests
```

**Cursor:** per gemeente `dso_laatst_gepolld` (nu generieke poll-cursor; valt terug op
90 dagen — gebruik `--sinds` voor de eerste backfill). **Idempotent** via
`on conflict (gemeente_slug, artikel, nieuwe_hash) do nothing`. **Planning:** wekelijks
via `POST /poll` op de research-service (zelfde secret + Supabase pg_cron als voorheen;
de `/poll`-handler roept nu de VHP-poller aan). **Env:** `SUPABASE_DB_URL` +
(voor de mail) `NOTIFY_ENDPOINT` + `NOTIFY_SECRET`.

---

# Omgevingsplan-poller (`omgevingsplan_poller.py`) — GEDEPRECIEERD

> Vervangen door de VHP-readiness-poller (zie boven). De premisse (per-gemeente
> inhoudelijke divergentie van mantelzorg/familie-regels) is achterhaald. De module
> blijft bestaan als bron van de gedeelde SRU-helpers die `vhp_poller.py` hergebruikt;
> draai hem niet meer als poller.

Signaleert wijzigingen in de **vergunningvrij-regels voor bijbehorende bouwwerken**
(bruidsschat) van gemeentelijke omgevingsplannen, via de **SRU 2.0-service** van
Overheid.nl over de officiële publicaties (Gemeenteblad). **Gratis, geen API-key.**

**Relevantiefilter = semantisch, niet op artikelnummer.** Gemeenten verplaatsen de
regels vaak: Utrecht → 4.27/4.28, Groningen → 32.36 (hfst 32 'Voorlopige Regels'),
Haarlemmermeer → hfst 5, Rotterdam → 6.19/6.24. Een 22.36-filter mist die allemaal.
Hybride, met een `zekerheid`-veld:
- **hoog** — een vergunningvrij-artikel wordt **écht gewijzigd**: het staat onder een
  per-artikel-mutatie/renvooi (STOP `Vervang`/`WijzigArtikel`/…), of 'bruidsschat' in
  de titel. Alleen deze mailen (`NOTIFY_ALLEEN_HOOG`, standaard aan).
- **indicatie** — een vergunningvrij-artikel is wél aanwezig maar niet aantoonbaar
  gewijzigd (herpublicatie / `VervangRegeling`, bv. Groningen), of een gewijzigd artikel
  over bijbehorende bouwwerken/achtererf, of literal 22.27/22.36. Recall-vangnet:
  zichtbaar in /regelgeving, geen mail.

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
