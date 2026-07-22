-- termijn dupliceert de bestaande kolom planning. De /mijn/erf-intake schrijft
-- voortaan naar planning; termijn wordt verwijderd.
alter table public.leads drop column if exists termijn;
