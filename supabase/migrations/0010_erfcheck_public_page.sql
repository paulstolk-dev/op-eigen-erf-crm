-- Trackbare publieke Erf Check-pagina (/r/<token>): token per lead + bezoek-
-- tracking op de erfscan + terugbelverzoek-velden op de lead.

alter table public.leads
  add column if not exists report_token uuid not null default gen_random_uuid(),
  add column if not exists terugbel_verzoek_at timestamptz,
  add column if not exists terugbel_notitie text;

-- gen_random_uuid() is volatile → bestaande rijen krijgen elk een uniek token.
create unique index if not exists leads_report_token_idx on public.leads(report_token);

alter table public.erfscans
  add column if not exists viewed_at timestamptz,
  add column if not exists last_viewed_at timestamptz,
  add column if not exists view_count integer not null default 0;
