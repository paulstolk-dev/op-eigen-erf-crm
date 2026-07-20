-- ============================================================================
-- 0031 — Nurture-flow: verzendconditie per stap + klik-conditie-helper.
-- Sluit aan op de FlowInstellingen-UI (Erfcheck-flow). Flow-instellingen zelf
-- (naam/actief/verdict/venster/uitsluitingen) staan in app_settings.nurture_flow.
-- ============================================================================

-- Verzendconditie per stap: 'altijd' | 'niet_geconverteerd' | 'niet_geklikt_vorige'.
alter table public.email_sequence_steps
  add column if not exists send_condition text not null default 'altijd';

-- Welke stap-id's heeft een lead geklikt (uit de meetlaag) — voor de
-- 'niet_geklikt_vorige'-conditie in de verzendlogica.
create or replace function public.nurture_clicked_step_ids(p_lead uuid)
returns setof uuid
language sql security definer set search_path = public, nurture as $$
  select distinct email_step_id
  from nurture.messages
  where lead_id = p_lead and email_step_id is not null and first_clicked_at is not null;
$$;

revoke execute on function public.nurture_clicked_step_ids(uuid) from public;
grant execute on function public.nurture_clicked_step_ids(uuid) to service_role;
