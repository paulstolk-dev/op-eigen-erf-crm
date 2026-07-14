-- Extra content-velden op artikelen: verwerk-status + social/video-uitwerkingen.
alter table public.artikelen
  add column if not exists content_processed boolean not null default false,
  add column if not exists ytvideo_url text,
  add column if not exists instapost_tekst text,
  add column if not exists yt_post_tekst text,
  add column if not exists instareel_url text;
