create table if not exists public.pagina_seo (
  pad              text primary key,
  seo_titel        text,
  meta_description text,
  updated_at       timestamptz not null default now()
);

comment on table public.pagina_seo is
  'Per-pagina SEO-overrides (title/description) voor statische pagina''s; lege waarde of ontbrekende rij => frontend valt terug op de in code hardcoded waarde.';

alter table public.pagina_seo enable row level security;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_pagina_seo_updated on public.pagina_seo;
create trigger trg_pagina_seo_updated
  before update on public.pagina_seo
  for each row execute function public.set_updated_at();
