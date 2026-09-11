-- Opt-in doorverwijssysteem: consent-logging + doorverwijzingen naar aanbieders.
-- Prijspeil referentie: compleet dossier EUR 200/225/250, succesfee 1,5%.
--
-- Twee harde principes uit het ontwerp:
--   1. consent is een onveranderlijk logboek (AVG art. 7 lid 1, aantoonbaarheid):
--      intrekken = nieuwe rij met granted=false, nooit een update van de oude rij.
--   2. niets verlaat het systeem zonder menselijke goedkeuring: een referral start
--      op 'pending_review' en krijgt pas sent_at bij de wekelijkse batch.
--
-- leads.consent_delen bestaat al en blijft de snelle 'mag deze lead gedeeld
-- worden'-vlag; lead_consents is de onderbouwing daarvan.

-- ---------------------------------------------------------------------------
-- 1. Welke aanbieders mogen leads ontvangen?
-- ---------------------------------------------------------------------------
-- is_partner / partner_tier / partner_status gaan over WEERGAVE op de site
-- (badge, volgorde, landingspagina's) - niet over een afnameafspraak. Zonder een
-- eigen veld zou de cascade leads sturen naar aanbieders die daar nooit voor
-- getekend hebben. Datum leeg = ontvangt geen doorverwijzingen.
alter table public.aanbieders
  add column if not exists leads_afspraak_getekend_at timestamptz,
  add column if not exists lead_prijs_eur numeric(10,2);

comment on column public.aanbieders.leads_afspraak_getekend_at is
  'Datum waarop de afnameafspraak voor doorverwijzingen is getekend. NULL = deze aanbieder ontvangt geen leads, ongeacht is_partner/partner_tier.';
comment on column public.aanbieders.lead_prijs_eur is
  'Afgesproken vaste prijs per doorverwijzing. NULL = val terug op de prijs per budget-band (200/225/250).';

-- ---------------------------------------------------------------------------
-- 2. Consent-logboek (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.lead_consents (
  id                   uuid primary key default gen_random_uuid(),
  lead_id              uuid not null references public.leads (id) on delete cascade,
  consent_type         text not null
                         check (consent_type in ('delen_aanbieders', 'bellen', 'nurture')),
  granted              boolean not null,
  method               text not null
                         check (method in ('erfcheck_formulier', 'email_optin', 'landingspagina', 'telefonisch', 'intrek_link')),
  consent_text_version text not null,
  max_aanbieders       integer
                         check (max_aanbieders is null or max_aanbieders between 1 and 3),
  voorkeur_aanbieders  text[],
  ip_hash              text,
  user_agent           text,
  created_at           timestamptz not null default now()
);

comment on table public.lead_consents is
  'Onveranderlijk consent-logboek (AVG art. 7 lid 1: aantoonbaarheid). Nooit updaten of verwijderen; intrekking = nieuwe rij met granted=false.';
comment on column public.lead_consents.voorkeur_aanbieders is
  'Slugs van de aanbieders die de klant op dat moment op het scherm zag. Vastlegging van wat is getoond, GEEN limiet: de toestemming is gegeven voor "maximaal max_aanbieders aanbieders die wij selecteren", dus de review mag hiervan afwijken. Bewust een slug-snapshot en geen FK: het bewijs moet blijven kloppen ook als een aanbieder later hernoemd of verwijderd wordt.';
comment on column public.lead_consents.max_aanbieders is
  'Het aantal waar de klant maximaal mee akkoord ging (de belofte uit de consenttekst). Bij kies-voor-mij is dit de harde bovengrens die de review niet mag overschrijden.';
comment on column public.lead_consents.consent_text_version is
  'Versie van de consenttekst die de klant zag, bijv. v1.0-2026-09. Zonder dit is niet aantoonbaar waarvoor toestemming is gegeven.';
comment on column public.lead_consents.ip_hash is
  'Gehasht IP-adres (geen ruw IP): genoeg voor aantoonbaarheid, dataminimalisatie voor de rest.';

create index if not exists lead_consents_lead_id_idx
  on public.lead_consents (lead_id, consent_type, created_at desc);

-- Append-only afdwingen in de database zelf: een bug in de app mag de
-- AVG-bewijslast niet kunnen wissen.
create or replace function public.lead_consents_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'lead_consents is append-only: leg een intrekking vast als nieuwe rij met granted=false';
end $$;

drop trigger if exists trg_lead_consents_append_only on public.lead_consents;
create trigger trg_lead_consents_append_only
  before update or delete on public.lead_consents
  for each row execute function public.lead_consents_append_only();

-- ---------------------------------------------------------------------------
-- 3. Doorverwijzingen
-- ---------------------------------------------------------------------------
-- Status-flow: pending_review -> approved -> sent -> (won | lost | expired)
-- pending_review = human review gate; niets gaat automatisch naar buiten.
create table if not exists public.lead_referrals (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references public.leads (id) on delete cascade,
  consent_id      uuid not null references public.lead_consents (id),
  -- Wel een echte FK: slugs in aanbieders zijn uniek en schoon, en zonder FK kun
  -- je verwijzen naar een aanbieder die niet meer bestaat. De onveranderlijke
  -- vastlegging van wat de klant zag zit in lead_consents.voorkeur_aanbieders.
  aanbieder_id    uuid not null references public.aanbieders (id) on delete restrict,
  tier            text not null default 'brons'
                    check (tier in ('brons', 'zilver', 'goud')),
  status          text not null default 'pending_review'
                    check (status in ('pending_review', 'approved', 'sent', 'won', 'lost', 'expired', 'rejected')),
  price_eur       numeric(10,2),
  success_fee_pct numeric(4,2) not null default 1.50,
  budget_band     text,
  reviewed_at     timestamptz,
  reviewed_by     text,
  reject_reason   text,
  sent_at         timestamptz,
  outcome_at      timestamptz,
  invoice_ref     text,
  notitie         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.lead_referrals is
  'Attributie-anker: sent_at is het contractuele moment van verstrekking aan de aanbieder.';
comment on column public.lead_referrals.tier is
  'Partnerniveau op het moment van doorverwijzen (brons/zilver/goud, gelijk aan aanbieders.partner_tier). Snapshot, zodat een latere tier-wijziging oude doorverwijzingen niet herschrijft.';
comment on column public.lead_referrals.price_eur is
  'Leadfee zoals gefactureerd, vastgelegd bij het versturen en daarna niet meer afgeleid: latere prijswijzigingen mogen oude facturen niet raken.';
comment on column public.lead_referrals.reject_reason is
  'Reden van afwijzing in de wekelijkse review. Gestructureerd naast notitie, zodat je later op kwaliteit kunt sturen.';

-- Dezelfde lead niet twee keer naar dezelfde aanbieder; een afgewezen poging
-- mag wel opnieuw (in de review kun je van aanbieder wisselen).
create unique index if not exists lead_referrals_uniq
  on public.lead_referrals (lead_id, aanbieder_id)
  where status <> 'rejected';

create index if not exists lead_referrals_status_idx
  on public.lead_referrals (status, created_at desc);

drop trigger if exists trg_lead_referrals_updated on public.lead_referrals;
create trigger trg_lead_referrals_updated
  before update on public.lead_referrals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS: alles dicht; alleen de service role (server-side API routes en het
--    CRM met de service key) mag lezen/schrijven. Geen anon/authenticated
--    policies: de landingspagina schrijft via een server-side route, nooit
--    rechtstreeks vanuit de browser.
-- ---------------------------------------------------------------------------
alter table public.lead_consents  enable row level security;
alter table public.lead_referrals enable row level security;

-- ---------------------------------------------------------------------------
-- 5. Rapportage-view voor het CRM-dashboard.
--    Losse subquery's in plaats van een join: met een join telt een consent met
--    drie referrals ook drie keer mee in consents_totaal.
--    security_invoker, anders omzeilt de view precies de RLS uit stap 4.
-- ---------------------------------------------------------------------------
drop view if exists public.v_referral_funnel;
create view public.v_referral_funnel with (security_invoker = true) as
select
  (select count(distinct lead_id) from public.lead_consents
    where granted and consent_type = 'delen_aanbieders')            as consents_totaal,
  (select count(distinct lead_id) from public.lead_consents
    where not granted and consent_type = 'delen_aanbieders')        as consents_ingetrokken,
  count(distinct lr.lead_id)                                        as leads_met_referral,
  count(*) filter (where lr.status = 'pending_review')              as wacht_op_review,
  count(*) filter (where lr.status = 'approved')                    as goedgekeurd,
  count(*) filter (where lr.status = 'sent')                        as verstuurd,
  count(*) filter (where lr.status = 'won')                         as gewonnen,
  count(*) filter (where lr.status = 'lost')                        as verloren,
  coalesce(sum(lr.price_eur) filter (where lr.status in ('sent', 'won')), 0) as omzet_leadfee_eur
from public.lead_referrals lr;
