-- Platte PNG-afbeelding van de erf-intekening (luchtfoto + kadaster + vlakken),
-- opgeslagen in de privé 'erfscans'-bucket; hier het pad (zoals luchtfoto_path).
alter table public.erfscans add column if not exists tekening_path text;
