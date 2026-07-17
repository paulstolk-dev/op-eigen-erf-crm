-- Rijke, geciteerde regelset per gemeente uit de AI-analyse (mens keurt goed).
-- Voor de publieke gemeentepagina: de concrete 'wat mag er'-parameters + bronciting.
alter table public.gemeenten
  add column if not exists vergunningvrij_parameters jsonb,   -- [{label, waarde}]
  add column if not exists vergunningvrij_citaten jsonb,       -- [tekst, ...]
  add column if not exists vergunningvrij_bron_url text;
