-- Aanvullende wensen die de lead zelf achterlaat op opeigenerf.nl/mijn/erf,
-- voor een uitgebreider advies op maat. Klikbare keuzes; direct weggeschreven.
alter table public.leads
  add column if not exists gewenst_formaat text,
  add column if not exists budget_indicatie text,
  add column if not exists voor_wie text,
  add column if not exists termijn text,
  add column if not exists advies_intake_at timestamptz;

comment on column public.leads.gewenst_formaat is 'Gewenste woninggrootte (band), ingevuld door de lead op /mijn/erf';
comment on column public.leads.budget_indicatie is 'Budgetindicatie (band), ingevuld door de lead op /mijn/erf';
comment on column public.leads.voor_wie is 'Voor wie is de woning: ouder / kind';
comment on column public.leads.termijn is 'Gewenste termijn (band)';
comment on column public.leads.advies_intake_at is 'Wanneer de lead de aanvullende wensen invulde op /mijn/erf';
