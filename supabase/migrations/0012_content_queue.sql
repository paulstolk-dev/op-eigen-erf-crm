-- Social-media content-automation (Fase 1). De content_queue houdt per aflevering
-- de videoprops (RegelgevingShort) + captions bij, met statusflow
-- concept → gerenderd → goedgekeurd → ingepland. Claude vult 'concept'; het
-- Remotion-renderproject zet 'gerenderd' + video_url; de mens keurt goed in het CRM.
create table if not exists public.content_queue (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  props jsonb not null,                       -- RegelgevingProps (kicker/titel/scenes/...)
  caption jsonb not null,                      -- { instagram, youtube_title }
  status text not null default 'concept',      -- concept | gerenderd | goedgekeurd | ingepland
  video_url text,                              -- publieke URL van de gerenderde mp4
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_queue_status_idx
  on public.content_queue(status, created_at desc);

alter table public.content_queue enable row level security;

create policy "crm all content_queue"
  on public.content_queue for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

create trigger content_queue_set_updated_at
  before update on public.content_queue
  for each row execute function public.set_updated_at();

-- Publieke bucket voor de gerenderde video's (worden toch publiek gepost; preview in CRM).
insert into storage.buckets (id, name, public)
values ('socials', 'socials', true)
on conflict (id) do nothing;

create policy "crm write socials"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'socials' and public.is_allowed_user());
create policy "crm update socials"
  on storage.objects for update to authenticated
  using (bucket_id = 'socials' and public.is_allowed_user());
create policy "crm delete socials"
  on storage.objects for delete to authenticated
  using (bucket_id = 'socials' and public.is_allowed_user());
