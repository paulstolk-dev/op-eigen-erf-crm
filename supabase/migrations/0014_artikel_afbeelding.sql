-- Website-artikelen: uitgelichte afbeelding + publieke bucket om er een te uploaden.
alter table public.artikelen add column if not exists afbeelding_url text;

insert into storage.buckets (id, name, public)
values ('artikelen', 'artikelen', true)
on conflict (id) do nothing;

create policy "crm write artikelen"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'artikelen' and public.is_allowed_user());
create policy "crm update artikelen"
  on storage.objects for update to authenticated
  using (bucket_id = 'artikelen' and public.is_allowed_user());
create policy "crm delete artikelen"
  on storage.objects for delete to authenticated
  using (bucket_id = 'artikelen' and public.is_allowed_user());
