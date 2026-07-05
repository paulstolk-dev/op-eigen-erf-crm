-- ============================================================================
-- HubSpot-sync (CRM -> HubSpot). Mapping-tabellen (onthouden HubSpot-id's) +
-- DB-triggers die /api/hubspot-sync aanroepen bij nieuwe/gewijzigde leads,
-- erfscans en aanbieders. Zelfde pg_net-patroon en secret als de andere triggers.
-- ============================================================================

create table if not exists public.hubspot_sync (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  contact_id text,
  deal_id text,
  synced_at timestamptz,
  error text
);
create table if not exists public.hubspot_company_sync (
  aanbieder_id uuid primary key references public.aanbieders(id) on delete cascade,
  company_id text,
  synced_at timestamptz,
  error text
);
alter table public.hubspot_sync enable row level security;
alter table public.hubspot_company_sync enable row level security;
create policy "crm read hubspot_sync" on public.hubspot_sync
  for select to authenticated using (public.is_allowed_user());
create policy "crm read hubspot_company_sync" on public.hubspot_company_sync
  for select to authenticated using (public.is_allowed_user());

-- Helper: post naar de sync-route.
create or replace function public.trigger_hubspot_lead()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_op = 'INSERT'
     or old.status is distinct from new.status
     or old.email is distinct from new.email
     or old.voornaam is distinct from new.voornaam
     or old.achternaam is distinct from new.achternaam
     or old.naam is distinct from new.naam
     or old.telefoon is distinct from new.telefoon
     or old.postcode is distinct from new.postcode
     or old.audience is distinct from new.audience then
    perform net.http_post(
      url := 'https://crm.opeigenerf.nl/api/hubspot-sync',
      body := jsonb_build_object('lead_id', new.id::text),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-erfscan-secret', 'a1b708fee9dc674efb044638f5d32157559509d94ef19fa0'
      ),
      timeout_milliseconds := 30000
    );
  end if;
  return new;
end;
$$;

create or replace function public.trigger_hubspot_erfscan()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_op = 'INSERT'
     or old.conclusie is distinct from new.conclusie
     or old.status is distinct from new.status
     or old.sent_at is distinct from new.sent_at
     or old.report_pdf_path is distinct from new.report_pdf_path then
    perform net.http_post(
      url := 'https://crm.opeigenerf.nl/api/hubspot-sync',
      body := jsonb_build_object('lead_id', new.lead_id::text),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-erfscan-secret', 'a1b708fee9dc674efb044638f5d32157559509d94ef19fa0'
      ),
      timeout_milliseconds := 30000
    );
  end if;
  return new;
end;
$$;

create or replace function public.trigger_hubspot_aanbieder()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_op = 'INSERT'
     or old.naam is distinct from new.naam
     or old.website_url is distinct from new.website_url
     or old.vestigingsplaats is distinct from new.vestigingsplaats
     or old.beschrijving is distinct from new.beschrijving
     or old.prijsklasse is distinct from new.prijsklasse then
    perform net.http_post(
      url := 'https://crm.opeigenerf.nl/api/hubspot-sync',
      body := jsonb_build_object('aanbieder_id', new.id::text),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-erfscan-secret', 'a1b708fee9dc674efb044638f5d32157559509d94ef19fa0'
      ),
      timeout_milliseconds := 30000
    );
  end if;
  return new;
end;
$$;

drop trigger if exists leads_hubspot_sync on public.leads;
create trigger leads_hubspot_sync
  after insert or update on public.leads
  for each row execute function public.trigger_hubspot_lead();

drop trigger if exists erfscans_hubspot_sync on public.erfscans;
create trigger erfscans_hubspot_sync
  after insert or update on public.erfscans
  for each row execute function public.trigger_hubspot_erfscan();

drop trigger if exists aanbieders_hubspot_sync on public.aanbieders;
create trigger aanbieders_hubspot_sync
  after insert or update on public.aanbieders
  for each row execute function public.trigger_hubspot_aanbieder();
