-- Aanbieder-wervingssequence: houd per aanbieder bij welke pitch-mail (1/2/3)
-- als laatste is verstuurd en wanneer, zodat de cron mail 2 en 3 op tijd stuurt.
alter table public.aanbieders
  add column if not exists partner_pitch_step integer not null default 0,
  add column if not exists partner_pitch_last_at timestamptz;

-- Backfill: reeds benaderde aanbieders staan op stap 1; anker = benaderd-moment.
update public.aanbieders
  set partner_pitch_step = 1,
      partner_pitch_last_at = coalesce(partner_pitch_last_at, partner_benaderd_at)
  where partner_benaderd_at is not null and partner_pitch_step = 0;
