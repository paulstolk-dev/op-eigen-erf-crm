-- ============================================================================
-- 0032 — Meetlaag ook voor de aanbieder-wervingssequence (partner-pitch).
-- nurture.messages wordt generiek: naast lead-mails (erfcheck) ook aanbieder-mails.
-- Eén meetlaag, twee stromen ('erfcheck' | 'aanbieder').
-- ============================================================================

alter table nurture.messages alter column lead_id drop not null;
alter table nurture.messages
  add column if not exists aanbieder_id uuid references public.aanbieders(id) on delete cascade,
  add column if not exists stroom text not null default 'erfcheck',
  add column if not exists stap_label text;

create index if not exists ix_message_aanbieder on nurture.messages (aanbieder_id);

-- Log één partner-pitch-mail (service_role: worker + handmatige pitch).
create or replace function public.nurture_log_partner_message(
  p_aanbieder uuid, p_stap int, p_to citext, p_subject text, p_pmid text
) returns uuid
language plpgsql security definer set search_path = public, nurture as $$
declare v_id uuid;
begin
  insert into nurture.messages (aanbieder_id, stroom, stap_label, to_email, subject, provider_message_id, status)
  values (p_aanbieder, 'aanbieder', 'Pitch ' || p_stap, p_to, p_subject, p_pmid, 'sent')
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.nurture_log_partner_message(uuid, int, citext, text, text) from public;
grant execute on function public.nurture_log_partner_message(uuid, int, citext, text, text) to service_role;

-- Metrics per pitch-stap (allowlist-guarded).
create or replace function public.nurture_partner_performance()
returns table(stap text, verzonden bigint, bezorgd bigint, geklikt bigint, gebounced bigint, ctr_pct numeric)
language sql security definer set search_path = public, nurture as $$
  select
    m.stap_label,
    count(*),
    count(*) filter (where m.status = 'delivered'),
    count(*) filter (where m.first_clicked_at is not null),
    count(*) filter (where m.status = 'bounced'),
    round(100.0 * count(*) filter (where m.first_clicked_at is not null)
      / nullif(count(*) filter (where m.status = 'delivered'), 0), 1)
  from nurture.messages m
  where m.stroom = 'aanbieder' and public.is_allowed_user()
  group by m.stap_label
  order by m.stap_label;
$$;

grant execute on function public.nurture_partner_performance() to authenticated, service_role;
