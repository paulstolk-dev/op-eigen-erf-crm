# opeigenerf CRM

CRM/dashboard voor leads van **opeigenerf.nl**. Next.js (App Router) + Supabase
(Auth, Postgres, Realtime), gehost op Vercel (`crm.opeigenerf.nl`).

## Stack

- **Next.js 15** App Router, TypeScript, Tailwind CSS v4
- **Supabase** project `opeigenerf` (`eyzhcmdydisaokqzqyli`, regio **eu-west-1**)
- **Auth**: magic link, toegang beperkt via e-mail-allowlist (`public.allowed_users`) + RLS
- **Realtime**: nieuwe/gewijzigde leads verschijnen live in de lijst

## Lokaal draaien

```bash
npm install
cp .env.local.example .env.local   # vul SUPABASE_SERVICE_ROLE_KEY in
npm run dev
```

Open http://localhost:3000 → je wordt naar `/login` gestuurd. Log in met
`paulstolk@gmail.com` (staat op de allowlist). De magic link komt binnen via
Supabase Auth-mail.

## Environment variabelen

| Var | Waar | Omschrijving |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | publiek | Supabase project-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publiek | publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **geheim** | service-role / secret key — alleen server-side |
| `NEXT_PUBLIC_SITE_URL` | publiek | basis-URL (magic-link redirect) |
| `LEAD_INGEST_SECRET` | geheim | (optioneel) shared secret voor `/api/leads` |
| `RESEND_API_KEY` | geheim | (Fase 3) opvolgmails via Resend |
| `LEAD_NOTIFY_EMAIL` | geheim | (Fase 3) ontvanger opvolg-notificaties |
| `CRON_SECRET` | geheim | (Fase 3) beveiligt de cron-endpoint |

De service-role key staat **nooit** in git. Op Vercel zet je 'm via
Project Settings → Environment Variables (of `vercel env add`).

## Database

Eén tabel `public.leads` (unified). Migraties zijn toegepast via Supabase MCP:

- `leads` — type (`erfcheck`/`haalbaarheidsscan`), status
  (`nieuw`/`contacted`/`gekwalificeerd`/`gewonnen`/`verloren`), NAW, adres,
  `audience/startdatum/budget/planning`, `details jsonb`, `source`.
- `lead_notes` — notities per lead.
- `allowed_users` — e-mail-allowlist; `is_allowed_user()` checkt de ingelogde user.
- RLS staat aan: alleen allowlisted users lezen/wijzigen leads & notes.
  De bestaande `leads_insert_public` policy laat de marketingsite inserten.

### Allowlist uitbreiden

```sql
insert into public.allowed_users (email) values ('collega@voorbeeld.nl');
```

## Fase 1 — leads binnenkrijgen

De marketingsite kan op twee manieren leads aanleveren:

1. **Via `/api/leads`** (aanbevolen): `POST` JSON met o.a. `type` (verplicht).
   Insert gebeurt server-side met de service-role key; RLS blijft dicht.
   Beveilig met `LEAD_INGEST_SECRET` (header `x-ingest-secret`).
2. **Direct via anon-key** (huidige situatie): de `leads_insert_public` policy
   staat directe inserts toe. Werkt zonder wijziging aan de site.

## Fase 3 — automatisering

- `vercel.json` bevat een **Vercel Cron** (`/api/cron/follow-up`, dagelijks 08:00)
  die leads die >24u op `nieuw` staan signaleert via Resend.
- Uitbreiden: status-gebaseerde sequenties, of een **Supabase database webhook /
  Edge Function** die direct bij `INSERT` op `leads` triggert.

## Erfscan-pipeline (lead → rapport)

Verwerking van een lead tot Erf Check-rapport, in 5 fases met één verplichte
mens-check:

```
① Lead → ② Verrijken (engine) → ③ Review (mens) → ④ Renderen (LLM) → ⑤ Versturen
```

- **`api/erfscan.py`** — Vercel **Python**-functie (Fluid Compute). Ontvangt
  `{lead_id}`, draait Tier 1 (PDOK geocode + perceel + luchtfoto + staffel),
  Tier 2 (BAG, zodra `BAG_API_KEY` gezet), schrijft `dossier` + status naar
  `public.erfscans` en de luchtfoto naar Storage-bucket `erfscans`. Vereist
  `SUPABASE_SERVICE_ROLE_KEY`. Beveiligd met `ERFSCAN_SECRET`.
- **`public.erfscans`** — dossier (jsonb), `status`
  (`queued→enriching→needs_review→rendered→sent`/`error`), `conclusie`
  (`groen`/`oranje`/`rood`), `tier3` (mens-in-de-lus checklist), pad naar PDF.
  Realtime aan zodat de CRM de status live volgt.
- **Trigger**: Supabase **database-webhook** op `INSERT` van `leads` → POST naar
  `https://crm.opeigenerf.nl/api/erfscan` met header `x-erfscan-secret`.
  Daarnaast een handmatige "Opnieuw draaien"-knop in de CRM (M3).
- **Render (M4)**: Claude zet `dossier` + `tier3` om in het Groen/Oranje/Rood-
  oordeel, een branded PDF en een concept-mail — die je in de CRM naleest en
  pas na akkoord verstuurt via Resend.

> **Deploy-nuance**: dit is een Next.js-project mét een losse Python-functie in
> `/api`. Vercel detecteert `api/erfscan.py` + `requirements.txt` automatisch als
> serverless functie naast de Next-app. De Next-API-routes staan onder
> `src/app/api/*` (geen botsing met `/api/erfscan`).

## Deploy naar Vercel

1. Push naar een eigen GitHub-repo, importeer in een **nieuw Vercel-project**.
2. Zet alle env-variabelen (zie tabel) in Vercel.
3. Voeg domein `crm.opeigenerf.nl` toe.
4. Zet in Supabase → Authentication → URL Configuration de **Site URL** en
   **Redirect URLs** op `https://crm.opeigenerf.nl` (en `/auth/confirm`).

## AVG / privacy

- EU-regio (eu-west-1) + RLS + service-role alleen server-side.
- Werk het privacybeleid bij i.v.m. opslag van leadgegevens.
