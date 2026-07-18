-- ============================================================================
-- 0028 — Kanteling: van inhoudelijke omgevingsplan-monitoring naar VHP-readiness.
--
-- VOORSTEL — NIET auto-apply. Pas alleen toe na expliciete bevestiging.
--
-- Waarom: met de Wet/Besluit versterking regie volkshuisvesting verhuizen de
-- vergunningvrije mantelzorg-/familiewoning-regels TERUG naar het Rijk (art. 22.36
-- omgevingsplan → Bbl art. 2.30b, landelijk uniform). Per gemeente valt er
-- inhoudelijk vrijwel niets meer te monitoren; wat wél per gemeente verschilt is
-- het MOMENT waarop het ingaat — het beste waarneembare signaal daarvoor is de
-- vaststelling van het volkshuisvestingsprogramma (VHP).
--
-- NOG NIET DEFINITIEF: of het toepasbare moment per gemeente aan de VHP-vaststelling
-- hangt, of dat de landelijke Bbl-regel al bij inwerkingtreding van het Besluit
-- (~jan 2027) rechtstreeks geldt, is niet eenduidig. Daarom registreren we alleen
-- SIGNALEN (landelijke datum + VHP-status per gemeente); de interpretatie is aan de mens.
--
-- Deze migratie DEPRECIEERT de content-divergentievelden (comment, niet droppen —
-- bestaande data blijft behouden) en VOEGT de VHP-readinessvelden + één centrale
-- landelijke tijdlijn toe (geen datum dupliceren over alle gemeenten).
-- ============================================================================

-- 1. VHP-status enum (readiness per gemeente).
do $$ begin
  create type public.gemeente_vhp_status as enum
    ('niet_vastgesteld', 'in_voorbereiding', 'vastgesteld', 'onbekend');
exception when duplicate_object then null; end $$;

-- 2. VHP-readinessvelden op gemeenten (REDACTIONEEL — de poller vult ze NOOIT).
alter table public.gemeenten
  add column if not exists vhp_status public.gemeente_vhp_status not null default 'onbekend',
  add column if not exists vhp_vastgesteld_op date,
  add column if not exists vhp_bron_url text;

comment on column public.gemeenten.vhp_status is
  'Readiness: status volkshuisvestingsprogramma. Alleen door een mens gezet na review; de poller raakt dit nooit aan.';
comment on column public.gemeenten.vhp_vastgesteld_op is
  'Datum waarop de raad het VHP vaststelde (redactioneel, na review).';
comment on column public.gemeenten.vhp_bron_url is
  'Bron (bekendmaking) van de VHP-vaststelling (redactioneel, na review).';

-- 3. Content-divergentievelden DEPRECIEREN — niet droppen (data behouden). Deze
--    velden hoorden bij de inhoudelijke monitoring die met 0028 vervalt.
comment on column public.gemeenten.omgevingsplan_status is
  'DEPRECATED (0028): mantelzorg/familie-regels gaan naar het Rijk (Bbl 2.30b). Niet meer vullen/tonen.';
comment on column public.gemeenten.afwijking_richting is
  'DEPRECATED (0028): geen gemeentelijke inhoudelijke afwijking meer te monitoren voor deze producten.';
comment on column public.gemeenten.afwijking_samenvatting is
  'DEPRECATED (0028): idem. Framing wordt landelijk + readiness (zie vhp_status).';
comment on column public.gemeenten.dso_inhoud_hash is
  'DEPRECATED (0028): content-diff op artikelniveau verlaten.';
comment on column public.gemeenten.dso_regeling_identificatie is
  'DEPRECATED (0028): AKN-regelingidentificatie was voor content-diff; niet meer gebruikt.';

-- dso_laatst_gepolld + dso_ontwerp_aanwezig blijven als GENERIEKE poll-cursor/-vlag
-- (nu voor de VHP-readiness-poll i.p.v. content-diff).
comment on column public.gemeenten.dso_laatst_gepolld is
  'Generieke poll-cursor (nu VHP-readiness-poll). Laatste poll-moment per gemeente.';
comment on column public.gemeenten.dso_ontwerp_aanwezig is
  'Generieke vlag: er is een ontwerp-VHP gezien (nog niet vastgesteld).';

-- 4. Wijziging-type-enum uitbreiden met de procedurele VHP-signalen. De bestaande
--    omgevingsplan-content-typen blijven bestaan voor historische rijen, maar zijn
--    deprecated (worden niet meer geschreven).
alter type public.gemeente_wijziging_type add value if not exists 'vhp_vastgesteld';
alter type public.gemeente_wijziging_type add value if not exists 'vhp_ontwerp';

comment on type public.gemeente_wijziging_type is
  'Type gesignaleerde wijziging. Actief (0028): vhp_vastgesteld, vhp_ontwerp, onbekend. '
  'Deprecated: ontwerp_nieuw, ontwerp_gewijzigd, vastgesteld_gewijzigd, artikel_verdwenen (omgevingsplan-content).';

-- 5. Centrale landelijke tijdlijn — NIET per gemeente dupliceren. Eén bron voor de
--    landelijke ijkpunten; per gemeente leiden we "geldt het al?" hieruit + vhp_status af.
create table if not exists public.landelijke_tijdlijn (
  sleutel      text primary key,
  omschrijving text not null,
  datum        date,
  status       text not null default 'nog_niet_definitief',  -- 'nog_niet_definitief' | 'definitief'
  bron         text,
  bron_url     text,
  updated_at   timestamptz not null default now()
);

comment on table public.landelijke_tijdlijn is
  'Centrale landelijke ijkpunten (Wet/Besluit versterking regie volkshuisvesting, VHP-deadline). Eén bron, niet per gemeente.';

-- Seed — de geverifieerde juridische basis. 'nog_niet_definitief' waar de bron dat is.
insert into public.landelijke_tijdlijn (sleutel, omschrijving, datum, status, bron) values
  ('wet_vrvh_in_werking',
   'Wet versterking regie volkshuisvesting in werking',
   '2026-07-01', 'definitief', 'Volkshuisvesting Nederland'),
  ('besluit_vrvh_in_werking',
   'Besluit versterking regie volkshuisvesting (vergunningvrije mantelzorg/familie, Bbl 2.30b) in werking — verwacht',
   '2027-01-01', 'nog_niet_definitief', 'Volkshuisvesting Nederland'),
  ('vhp_deadline',
   'Deadline vaststelling volkshuisvestingsprogramma per gemeente',
   '2027-07-01', 'nog_niet_definitief', 'deomgevingsadviseurs')
on conflict (sleutel) do nothing;

-- updated_at bijhouden.
drop trigger if exists landelijke_tijdlijn_set_updated_at on public.landelijke_tijdlijn;
create trigger landelijke_tijdlijn_set_updated_at
  before update on public.landelijke_tijdlijn
  for each row execute function public.set_updated_at();

-- RLS: publiek leesbaar (landelijke feiten), CRM beheert.
alter table public.landelijke_tijdlijn enable row level security;
create policy "public read landelijke_tijdlijn" on public.landelijke_tijdlijn
  for select using (true);
create policy "crm all landelijke_tijdlijn" on public.landelijke_tijdlijn
  for all to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
