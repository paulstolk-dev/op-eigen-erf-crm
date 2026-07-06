-- Preferred-partner wervingsfunnel op aanbieders.
-- Contactpersoon + status om aanbieders te benaderen en als partner aan te sluiten.

alter table public.aanbieders
  add column if not exists contact_naam text,
  add column if not exists contact_email text,
  add column if not exists partner_status text not null default 'prospect'
    check (partner_status in ('prospect','benaderd','geinteresseerd','partner','afgewezen')),
  add column if not exists partner_benaderd_at timestamptz;
