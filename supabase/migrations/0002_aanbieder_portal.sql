-- ============================================================================
-- Aanbieder-portal: eigen login, eigen woningen beheren, toegewezen leads inzien.
--   * aanbieder_users  — koppelt auth-account aan aanbieder, met goedkeuring
--   * lead_aanbieder   — deelt een lead met een aanbieder, met PII-vrijgave
--   * helpers          — current_aanbieder_id() / is_aanbieder_user() / status
--   * portal_leads     — view die contactgegevens maskeert tot vrijgave
--   * RLS + storage    — aanbieder beheert ALLEEN eigen data
-- ============================================================================

-- 1. Account <-> aanbieder, met goedkeuringsflow -----------------------------
create table if not exists public.aanbieder_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  aanbieder_id uuid not null references public.aanbieders(id) on delete cascade,
  email text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'geweigerd')),
  bericht text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text
);
create index if not exists aanbieder_users_aanbieder_idx on public.aanbieder_users(aanbieder_id);
create index if not exists aanbieder_users_status_idx on public.aanbieder_users(status);

-- 2. Lead-deling naar aanbieders, met contact-vrijgave -----------------------
create table if not exists public.lead_aanbieder (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  aanbieder_id uuid not null references public.aanbieders(id) on delete cascade,
  status text not null default 'gedeeld'
    check (status in ('gedeeld', 'geinteresseerd', 'afgewezen')),
  contact_vrijgegeven boolean not null default false,
  gedeeld_at timestamptz not null default now(),
  gedeeld_by text,
  vrijgegeven_at timestamptz,
  gereageerd_at timestamptz,
  unique (lead_id, aanbieder_id)
);
create index if not exists lead_aanbieder_aanbieder_idx on public.lead_aanbieder(aanbieder_id);
create index if not exists lead_aanbieder_lead_idx on public.lead_aanbieder(lead_id);

-- 3. Helpers (security definer -> bypassen RLS, geen recursie) ----------------
create or replace function public.current_aanbieder_id()
returns uuid language sql stable security definer set search_path = public as $$
  select aanbieder_id from public.aanbieder_users
  where user_id = auth.uid() and status = 'approved'
  limit 1
$$;

create or replace function public.is_aanbieder_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.aanbieder_users
    where user_id = auth.uid() and status = 'approved'
  )
$$;

create or replace function public.my_aanbieder_status()
returns text language sql stable security definer set search_path = public as $$
  select status from public.aanbieder_users where user_id = auth.uid() limit 1
$$;

grant execute on function public.current_aanbieder_id() to authenticated;
grant execute on function public.is_aanbieder_user() to authenticated;
grant execute on function public.my_aanbieder_status() to authenticated;

-- 4. RLS: aanbieder_users ----------------------------------------------------
alter table public.aanbieder_users enable row level security;

create policy "own membership read" on public.aanbieder_users
  for select to authenticated using (user_id = auth.uid());
create policy "crm read memberships" on public.aanbieder_users
  for select to authenticated using (public.is_allowed_user());
create policy "crm update memberships" on public.aanbieder_users
  for update to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy "crm delete memberships" on public.aanbieder_users
  for delete to authenticated using (public.is_allowed_user());
-- Inserts gebeuren server-side via de service-role client (registratie).

-- 5. RLS: lead_aanbieder -----------------------------------------------------
alter table public.lead_aanbieder enable row level security;

create policy "crm all shares" on public.lead_aanbieder
  for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy "aanbieder read own shares" on public.lead_aanbieder
  for select to authenticated
  using (aanbieder_id = public.current_aanbieder_id());
-- Reageren gaat via portal_lead_reageer() zodat contact_vrijgegeven niet
-- door de aanbieder gewijzigd kan worden.

-- 6. RLS: aanbieder mag eigen aanbieder-rij lezen/bewerken -------------------
create policy "aanbieder read own profile" on public.aanbieders
  for select to authenticated using (id = public.current_aanbieder_id());
create policy "aanbieder update own profile" on public.aanbieders
  for update to authenticated
  using (id = public.current_aanbieder_id())
  with check (id = public.current_aanbieder_id());

-- 7. RLS: aanbieder beheert eigen woningen ----------------------------------
create policy "aanbieder manage own woningen" on public.woningen
  for all to authenticated
  using (aanbieder_id = public.current_aanbieder_id())
  with check (aanbieder_id = public.current_aanbieder_id());

-- 8. View portal_leads — maskeert PII tot contact_vrijgegeven ----------------
-- security_invoker=false: draait als owner en omzeilt zo de RLS op leads;
-- de WHERE beperkt tot de eigen toegewezen leads van de ingelogde aanbieder.
create or replace view public.portal_leads
with (security_invoker = false) as
select
  la.id                as share_id,
  la.lead_id,
  la.aanbieder_id,
  la.status            as reactie_status,
  la.contact_vrijgegeven,
  la.gedeeld_at,
  l.created_at,
  l.type,
  l.audience,
  l.budget,
  l.planning,
  l.startdatum,
  substring(coalesce(l.postcode, '') from '[0-9]{4}') as regio_postcode,
  case when la.contact_vrijgegeven then l.voornaam end   as voornaam,
  case when la.contact_vrijgegeven then l.achternaam end as achternaam,
  case when la.contact_vrijgegeven then l.naam end       as naam,
  case when la.contact_vrijgegeven then l.email end      as email,
  case when la.contact_vrijgegeven then l.telefoon end   as telefoon,
  case when la.contact_vrijgegeven then l.postcode end   as postcode,
  case when la.contact_vrijgegeven then l.huisnummer end as huisnummer,
  case when la.contact_vrijgegeven then l.toevoeging end as toevoeging
from public.lead_aanbieder la
join public.leads l on l.id = la.lead_id
where la.aanbieder_id = public.current_aanbieder_id();

revoke all on public.portal_leads from anon;
grant select on public.portal_leads to authenticated;

-- 9. Reactie-functie voor de aanbieder (alleen status, nooit PII) ------------
create or replace function public.portal_lead_reageer(p_lead_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_aid uuid;
begin
  v_aid := public.current_aanbieder_id();
  if v_aid is null then
    raise exception 'Geen toegang';
  end if;
  if p_status not in ('gedeeld', 'geinteresseerd', 'afgewezen') then
    raise exception 'Ongeldige status';
  end if;
  update public.lead_aanbieder
     set status = p_status, gereageerd_at = now()
   where lead_id = p_lead_id and aanbieder_id = v_aid;
end;
$$;
grant execute on function public.portal_lead_reageer(uuid, text) to authenticated;

-- 10. Storage: aanbieder mag alleen in de eigen map schrijven ---------------
-- Padconventie: 'woningen/<aanbieder_id>/...' en 'logos/<aanbieder_id>/...'.
create policy "aanbieder upload eigen media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'aanbieders'
    and public.current_aanbieder_id() is not null
    and (storage.foldername(name))[2] = public.current_aanbieder_id()::text
  );
create policy "aanbieder update eigen media" on storage.objects
  for update to authenticated using (
    bucket_id = 'aanbieders'
    and (storage.foldername(name))[2] = public.current_aanbieder_id()::text
  );
create policy "aanbieder delete eigen media" on storage.objects
  for delete to authenticated using (
    bucket_id = 'aanbieders'
    and (storage.foldername(name))[2] = public.current_aanbieder_id()::text
  );
