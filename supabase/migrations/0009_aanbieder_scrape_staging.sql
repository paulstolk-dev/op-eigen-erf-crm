-- ============================================================================
-- OpEigenErf — staging-schema voor de aanbieder-/modellen-research-tool
--
-- Doel: gescrapete data en foto's veilig parkeren vóór review, zonder de
-- gecureerde publieke tabellen (aanbieders, woningen) te vervuilen.
--
-- Gescrapete aanbieders/woningen leven in de échte tabellen maar zijn gated door
-- actief=false + review_status. Kandidaatfoto's staan in een privé bucket
-- (aanbieder-scrape) tot een reviewer ze kiest; dan gaan ze naar de publieke
-- bucket (aanbieders) en wordt het model live gezet. Alles idempotent.
-- ============================================================================

-- 1. Privé storage-bucket voor kandidaatfoto's -------------------------------
insert into storage.buckets (id, name, public)
values ('aanbieder-scrape', 'aanbieder-scrape', false)
on conflict (id) do nothing;

-- 2. Herkomst- en reviewkolommen op de bestaande tabellen --------------------
--    Bestaande handmatige rijen blijven 'handmatig' / 'ok'.
alter table public.aanbieders
  add column if not exists bron text not null default 'handmatig',
  add column if not exists review_status text not null default 'ok';

alter table public.woningen
  add column if not exists bron text not null default 'handmatig',
  add column if not exists review_status text not null default 'ok';

-- 3. Staging-tabel voor gescrapete foto's ------------------------------------
create table if not exists public.scrape_afbeeldingen (
  id            uuid primary key default gen_random_uuid(),
  aanbieder_id  uuid references public.aanbieders(id) on delete cascade,
  woning_id     uuid references public.woningen(id) on delete cascade,
  bron_url      text not null,                 -- oorspronkelijke afbeelding-URL
  bron_pagina   text,                          -- pagina waarop de foto stond
  storage_path  text,                          -- pad in bucket 'aanbieder-scrape'
  sha256        text unique,                   -- dedupe over runs heen
  breedte       int,
  hoogte        int,
  bytes         int,
  gekozen       boolean not null default false,-- door reviewer geselecteerd
  review_status text not null default 'nieuw', -- nieuw | goedgekeurd | afgewezen
  created_at    timestamptz not null default now()
);

create index if not exists idx_scrape_afb_aanbieder on public.scrape_afbeeldingen(aanbieder_id);
create index if not exists idx_scrape_afb_woning    on public.scrape_afbeeldingen(woning_id);
create index if not exists idx_scrape_afb_status    on public.scrape_afbeeldingen(review_status);

-- 4. RLS: staging is intern. Aan zetten, géén public policy ------------------
--    Alleen de service role (die RLS omzeilt) leest/schrijft hier.
alter table public.scrape_afbeeldingen enable row level security;

-- 5. Reviewweergave: concepten die op beoordeling wachten --------------------
create or replace view public.v_scrape_review as
select
  a.id            as aanbieder_id,
  a.naam          as aanbieder,
  a.website_url,
  a.review_status as aanbieder_status,
  count(distinct w.id)  as aantal_modellen,
  count(distinct sa.id) as aantal_fotos
from public.aanbieders a
left join public.woningen w             on w.aanbieder_id = a.id
left join public.scrape_afbeeldingen sa on sa.aanbieder_id = a.id
where a.bron = 'scrape'
group by a.id, a.naam, a.website_url, a.review_status
order by a.review_status, a.naam;

-- View draait met rechten van de aanroeper (niet SECURITY DEFINER) — linter-clean.
alter view public.v_scrape_review set (security_invoker = on);
