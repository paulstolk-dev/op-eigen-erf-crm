-- Test-leads kunnen handmatig uit de dashboard-telling gehaald worden.
-- excluded_from_stats = true → de lead telt niet mee in de statistieken
-- (aantal leads, qualified, gewonnen/verloren, kosten/lead, grafiek), maar
-- blijft gewoon in de leadslijst en de nurture-flow staan.
alter table public.leads
  add column if not exists excluded_from_stats boolean not null default false;
