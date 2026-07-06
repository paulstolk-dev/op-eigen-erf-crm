-- Houdt bij of een verstuurde nurture-stap al op de HubSpot-tijdlijn is gelogd.
-- Voorkomt dubbele logging en maakt een idempotente backfill mogelijk.

alter table public.email_sequence_sends
  add column if not exists hubspot_logged_at timestamptz;
