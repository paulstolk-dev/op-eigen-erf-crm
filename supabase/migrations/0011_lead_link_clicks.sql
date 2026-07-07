-- Klik-tracking voor links in opvolgmails. Links lopen via /l/<report_token> →
-- registreert de klik op de lead → 302 naar de bestemming. Zo is per lead
-- zichtbaar welke links (bijv. de haalbaarheidsscan) zijn aangeklikt.
create table if not exists public.lead_link_clicks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  url text not null,
  label text,
  clicked_at timestamptz not null default now(),
  user_agent text
);

create index if not exists lead_link_clicks_lead_idx
  on public.lead_link_clicks(lead_id, clicked_at desc);

alter table public.lead_link_clicks enable row level security;

-- CRM (authenticated, allowlisted) mag lezen; schrijven gaat via de service-role
-- (bypasst RLS) vanuit de redirect-route.
create policy "crm read lead_link_clicks"
  on public.lead_link_clicks for select to authenticated
  using (public.is_allowed_user());
