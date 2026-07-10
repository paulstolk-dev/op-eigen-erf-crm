-- Handmatige erf-intekening op de erfscan-kaart: GeoJSON-FeatureCollection met
-- de ingetekende vlakken (erf/achtererf, bebouwbaar gebied, ...) + hun m².
alter table public.erfscans add column if not exists tekening jsonb;
