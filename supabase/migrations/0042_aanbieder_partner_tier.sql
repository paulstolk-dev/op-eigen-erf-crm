-- Partnerschap opgesplitst in niveaus: brons < zilver < goud.
-- Weergaveregels (op de site): goud staat bovenaan de overzichten met een
-- 'partner'-badge; de speciale landingspagina's tonen alleen zilver + goud.
alter table public.aanbieders
  add column if not exists partner_tier text
  check (partner_tier in ('brons', 'zilver', 'goud'));

-- Bestaande partners behouden hun huidige weergave (bovenaan + op de
-- landingspagina's): standaard op goud; de rest curateer je in de CRM.
update public.aanbieders set partner_tier = 'goud'
  where is_partner = true and partner_tier is null;

comment on column public.aanbieders.partner_tier is
  'Partnerniveau: brons/zilver/goud. Bepaalt weergave op de site (goud bovenaan + badge, zilver/goud op landingspagina''s).';
