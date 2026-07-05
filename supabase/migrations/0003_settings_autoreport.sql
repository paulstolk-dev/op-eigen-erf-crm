-- ============================================================================
-- App-instellingen (o.a. bewerkbare concept-mail-prompt) + auto-rapportgeneratie.
-- ============================================================================

-- 1. Sleutel/waarde-instellingen (CRM-beheer) --------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy "crm read settings" on public.app_settings
  for select to authenticated using (public.is_allowed_user());
create policy "crm write settings" on public.app_settings
  for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

drop trigger if exists app_settings_updated_at on public.app_settings;
create trigger app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- 2. Auto-rapport: zodra de erfscan klaar is (status 'needs_review') en er nog
--    geen rapport is, roept de DB /api/generate-report aan. Zelfde pg_net-
--    patroon en secret als trigger_erfscan.
create or replace function public.trigger_generate_report()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if (tg_op = 'INSERT' or old.status is distinct from new.status)
     and new.status = 'needs_review'
     and new.report_pdf_path is null then
    perform net.http_post(
      url := 'https://crm.opeigenerf.nl/api/generate-report',
      body := jsonb_build_object('lead_id', new.lead_id::text),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-erfscan-secret', 'a1b708fee9dc674efb044638f5d32157559509d94ef19fa0'
      ),
      timeout_milliseconds := 60000
    );
  end if;
  return new;
end;
$$;

drop trigger if exists erfscans_generate_report on public.erfscans;
create trigger erfscans_generate_report
  after insert or update on public.erfscans
  for each row execute function public.trigger_generate_report();
