-- Gemeente-omgevingsplan-monitoring (SRU-poller). De poller signaleert wijzigingen
-- in de vergunningvrij-regels (bruidsschat hfst. 22, art. 22.27/22.36) via de
-- officiële bekendmakingen (Gemeenteblad) en schrijft ze hier; een mens verwerkt ze.
-- De poller schrijft ALLEEN de dso_*-/wijziging-/check-velden. De redactionele
-- velden (omgevingsplan_status, afwijking_*, gecontroleerd_op) vult alleen een mens.

-- Type van een gesignaleerde wijziging (poller mapt hierop).
do $$ begin
  create type public.gemeente_wijziging_type as enum (
    'ontwerp_nieuw',
    'ontwerp_gewijzigd',
    'vastgesteld_gewijzigd',
    'artikel_verdwenen',
    'onbekend'
  );
exception when duplicate_object then null; end $$;

-- Eén rij per gemeente.
create table if not exists public.gemeenten (
  slug text primary key,
  naam text not null,
  gemeentecode text,                       -- bv. 'GM0202' (optioneel)
  research_status text not null default 'niet_onderzocht',

  -- Door de poller beheerd:
  dso_laatst_gepolld timestamptz,          -- cursor: laatste poll-moment
  dso_ontwerp_aanwezig boolean not null default false,
  dso_regeling_identificatie text,         -- AKN, bv. /akn/nl/act/gm0202/2020/omgevingsplan/...
  dso_inhoud_hash text,                     -- ongebruikt in v1; voor latere DSO-API-upgrade

  -- Redactioneel (ALLEEN mens — poller raakt deze nooit aan):
  omgevingsplan_status text,               -- bv. 'bruidsschat_ongewijzigd' | 'gewijzigd'
  afwijking_richting text,                 -- 'strenger' | 'soepeler' | 'gelijk'
  afwijking_samenvatting text,
  gecontroleerd_op date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Eén rij per gesignaleerde, relevante wijziging.
create table if not exists public.gemeente_wijzigingen (
  id uuid primary key default gen_random_uuid(),
  gemeente_slug text not null references public.gemeenten(slug) on delete cascade,
  artikel text not null,                   -- '22.36' | '22.27' | 'hoofdstuk 22'
  type public.gemeente_wijziging_type not null default 'onbekend',
  nieuwe_hash text not null,               -- = publicatie-id (bv. 'gmb-2026-310561')
  delta jsonb,                             -- geëxtraheerde renvooi (toegevoegd/verwijderd)
  bron_url text,                           -- directe link naar de publicatie
  review_status text not null default 'nieuw',
  created_at timestamptz not null default now(),
  -- Idempotent: herhaalde runs mailen niet opnieuw.
  unique (gemeente_slug, artikel, nieuwe_hash)
);
create index if not exists gemeente_wijzigingen_review_idx
  on public.gemeente_wijzigingen(review_status, created_at desc);

-- Eén rij per gemeente per run (ook bij nul treffers en bij fouten) — onderbouwt
-- de "gecontroleerd op"-claim op de gemeentepagina.
create table if not exists public.gemeente_checks (
  id uuid primary key default gen_random_uuid(),
  gemeente_slug text not null references public.gemeenten(slug) on delete cascade,
  uitgevoerd_op timestamptz not null default now(),
  resultaat text not null,                 -- 'ok' | 'geen_treffers' | 'fout'
  aantal_treffers int not null default 0,
  aantal_relevant int not null default 0,
  ruwe_respons text,                        -- beperkt: alleen relevante fragmenten
  foutmelding text,
  created_at timestamptz not null default now()
);
create index if not exists gemeente_checks_gemeente_idx
  on public.gemeente_checks(gemeente_slug, uitgevoerd_op desc);

-- updated_at bijhouden op gemeenten.
drop trigger if exists gemeenten_set_updated_at on public.gemeenten;
create trigger gemeenten_set_updated_at
  before update on public.gemeenten
  for each row execute function public.set_updated_at();

-- RLS: CRM (authenticated + allowlisted) mag lezen/beheren; de poller schrijft met
-- de service-role (bypasst RLS).
alter table public.gemeenten enable row level security;
alter table public.gemeente_wijzigingen enable row level security;
alter table public.gemeente_checks enable row level security;

create policy "crm all gemeenten" on public.gemeenten
  for all to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy "crm all gemeente_wijzigingen" on public.gemeente_wijzigingen
  for all to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy "crm all gemeente_checks" on public.gemeente_checks
  for all to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
