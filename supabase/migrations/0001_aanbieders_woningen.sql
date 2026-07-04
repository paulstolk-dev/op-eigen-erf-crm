-- ============================================================
-- Aanbieders + woningen (catalogus) voor opeigenerf.nl
-- Beheer via dit CRM; publieke site leest read-only (anon, actief=true).
-- ============================================================

-- ---------- enums ----------
create type public.vergunningsbegeleiding_enum as enum ('ja', 'nee', 'niet_vermeld');
create type public.prijsklasse_enum as enum ('budget', 'standaard', 'luxe');
create type public.afwerkingsniveau_enum as enum ('casco', 'instapklaar', 'luxe');
create type public.aanbod_type_enum as enum ('koop', 'huur', 'tweedehands');
create type public.btw_basis_enum as enum ('incl', 'ex');

-- ---------- aanbieders ----------
create table public.aanbieders (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text unique,
  naam                    text not null,
  website_url             text,
  logo_url                text,
  beschrijving            text,
  vestigingsplaats        text,
  servicegebied           text default 'Heel NL',
  bouwmethode             text,
  levertijd_indicatie     text,
  vergunningsbegeleiding  public.vergunningsbegeleiding_enum not null default 'niet_vermeld',
  koop                    boolean not null default true,
  huur                    boolean not null default false,
  tweedehands             boolean not null default false,
  prijsklasse             public.prijsklasse_enum,
  vanaf_prijs_incl_btw    integer,   -- NULL = "Op aanvraag"
  prijs_per_m2_indicatie  integer,
  afwerkingsniveaus       text[],    -- waarden: casco/instapklaar/luxe
  in_vanaf_prijs          text,
  prijspeil               text,      -- bv. '2026' of '2022 (verouderd)'
  bron_url                text,
  laatst_gecontroleerd    date,
  is_partner              boolean not null default false,
  actief                  boolean not null default true,
  sortering               integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint aanbieders_vanaf_prijs_positief check (vanaf_prijs_incl_btw is null or vanaf_prijs_incl_btw >= 0),
  constraint aanbieders_prijs_m2_positief check (prijs_per_m2_indicatie is null or prijs_per_m2_indicatie >= 0)
);

-- ---------- woningen ----------
create table public.woningen (
  id                    uuid primary key default gen_random_uuid(),
  aanbieder_id          uuid not null references public.aanbieders (id) on delete cascade,
  slug                  text,
  naam                  text not null,
  oppervlakte_m2        integer,
  oppervlakte_max_m2    integer,   -- voor ranges
  slaapkamers           integer,
  prijs_incl_btw        integer,   -- NULL = op aanvraag
  btw_basis_bron        public.btw_basis_enum not null default 'incl',
  is_vanaf_prijs        boolean not null default true,
  -- prijs per m2: afgeleid, null-safe, niet los opslaan
  prijs_per_m2 integer generated always as (
    case
      when prijs_incl_btw is not null and oppervlakte_m2 is not null and oppervlakte_m2 > 0
        then prijs_incl_btw / oppervlakte_m2
      else null
    end
  ) stored,
  afwerkingsniveau      public.afwerkingsniveau_enum,
  aanbod_type           public.aanbod_type_enum not null default 'koop',
  in_prijs_inbegrepen   text,
  beschrijving          text,
  gelijkvloers          boolean,   -- nullable: vaak niet vermeld
  energieneutraal_beng  boolean,   -- nullable: vaak niet vermeld
  afbeeldingen          text[],    -- Supabase Storage public URLs
  bron_url              text,
  prijspeil             text,
  laatst_gecontroleerd  date,
  actief                boolean not null default true,
  uitgelicht            boolean not null default false,
  sortering             integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint woningen_prijs_positief check (prijs_incl_btw is null or prijs_incl_btw >= 0),
  constraint woningen_opp_positief check (oppervlakte_m2 is null or oppervlakte_m2 > 0),
  constraint woningen_opp_max_positief check (oppervlakte_max_m2 is null or oppervlakte_max_m2 > 0),
  constraint woningen_slaapkamers_positief check (slaapkamers is null or slaapkamers >= 0)
);

-- ---------- updated_at triggers (hergebruikt public.set_updated_at) ----------
create trigger aanbieders_set_updated_at
  before update on public.aanbieders
  for each row execute function public.set_updated_at();

create trigger woningen_set_updated_at
  before update on public.woningen
  for each row execute function public.set_updated_at();

-- ---------- indexes ----------
create index woningen_aanbieder_id_idx on public.woningen (aanbieder_id);
create index woningen_prijs_idx on public.woningen (prijs_incl_btw);
create index aanbieders_actief_sortering_idx on public.aanbieders (actief, sortering);
create index aanbieders_afwerkingsniveaus_gin on public.aanbieders using gin (afwerkingsniveaus);

-- ---------- RLS ----------
alter table public.aanbieders enable row level security;
alter table public.woningen enable row level security;

-- Publieke site (anon): alleen actieve rijen lezen, geen schrijven.
create policy "public read active aanbieders"
  on public.aanbieders for select to anon using (actief = true);
create policy "public read active woningen"
  on public.woningen for select to anon using (actief = true);

-- CRM (authenticated allowlisted): volledige toegang (incl. inactieve rijen).
create policy "crm all aanbieders"
  on public.aanbieders for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy "crm all woningen"
  on public.woningen for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

-- ---------- Storage: public bucket 'aanbieders' (logo's + woningfoto's) ----------
insert into storage.buckets (id, name, public)
values ('aanbieders', 'aanbieders', true)
on conflict (id) do nothing;

-- Publieke leestoegang loopt via de public-bucket; schrijven alleen via CRM.
create policy "crm insert aanbieders files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'aanbieders' and public.is_allowed_user());
create policy "crm update aanbieders files"
  on storage.objects for update to authenticated
  using (bucket_id = 'aanbieders' and public.is_allowed_user());
create policy "crm delete aanbieders files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'aanbieders' and public.is_allowed_user());
