-- Nieuwe aanbieder-funnel: nieuw → benaderd → afspraak_gepland → partner
-- (+ afgewezen als terminale status). Vervangt prospect/geinteresseerd.
alter table public.aanbieders drop constraint if exists aanbieders_partner_status_check;

update public.aanbieders set partner_status = 'nieuw' where partner_status = 'prospect';
update public.aanbieders set partner_status = 'afspraak_gepland' where partner_status = 'geinteresseerd';

alter table public.aanbieders alter column partner_status set default 'nieuw';

alter table public.aanbieders add constraint aanbieders_partner_status_check
  check (partner_status = any (array['nieuw','benaderd','afspraak_gepland','partner','afgewezen']));

-- Deal-id voor de aparte HubSpot-pipeline 'Aanbieders' (deal per aanbieder).
alter table public.hubspot_company_sync add column if not exists deal_id text;
