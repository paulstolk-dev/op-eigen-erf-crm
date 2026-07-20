-- ============================================================================
-- 0029 — Nurture-meetlaag (Fase 0, meetlaag-first).
--
-- Bovenop de BESTAANDE e-mailflow (public.email_sequence_steps / _sends +
-- runNurture): een meetlaag die Resend-events (bezorgd/geopend/geklikt/bounced/
-- klacht) vastlegt en per stap ontsluit — de HubSpot-achtige metrics op eigen data.
--
-- Bewuste keuzes t.o.v. het oorspronkelijke voorstel:
--  * meetlaag-first: GEEN sequences/steps/enrollments-tabellen (die bestaan al als
--    email_sequence_*); messages koppelt aan public.email_sequence_steps.
--  * RLS-admin via public.is_allowed_user() (public.profiles bestaat niet).
--  * Writes via service_role (webhook + worker); reads alleen voor allowlist-admins.
--
-- Caveat (in de views geëerbiedigd): open rates zijn onbetrouwbaar (Apple MPP /
-- Gmail prefetcht de pixel). Stuur op clicks/replies; ctr staat op 'delivered'.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create schema if not exists nurture;

-- ---------- Enums ----------
do $$ begin
  create type nurture.message_status as enum
    ('queued','sent','delivered','bounced','complained','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type nurture.event_type as enum
    ('sent','delivered','delivery_delayed','bounced','complained','opened','clicked','failed','scheduled','suppressed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type nurture.suppression_reason as enum
    ('unsubscribe','hard_bounce','complaint','manual');
exception when duplicate_object then null; end $$;

-- ---------- messages: één rij per verzonden nurture-mail (geaggregeerde status) ----------
create table if not exists nurture.messages (
  id                   uuid primary key default gen_random_uuid(),
  lead_id              uuid not null references public.leads(id) on delete cascade,
  -- welke stap van de bestaande e-mailflow (nullable: ook ad-hoc mails kunnen loggen)
  email_step_id        uuid references public.email_sequence_steps(id) on delete set null,
  channel              text not null default 'email',
  provider             text not null default 'resend',
  provider_message_id  text,                 -- Resend email-id; koppelt de webhooks
  to_email             citext not null,
  subject              text not null,
  status               nurture.message_status not null default 'sent',
  sent_at              timestamptz not null default now(),
  delivered_at         timestamptz,
  first_opened_at      timestamptz,
  first_clicked_at     timestamptz,
  open_count           integer not null default 0,
  click_count          integer not null default 0,
  created_at           timestamptz not null default now()
);

create unique index if not exists uq_message_provider_id
  on nurture.messages (provider_message_id) where provider_message_id is not null;
create index if not exists ix_message_lead on nurture.messages (lead_id);
create index if not exists ix_message_step on nurture.messages (email_step_id);

-- ---------- message_events: append-only ruwe webhook-events (audit + idempotent) ----------
create table if not exists nurture.message_events (
  id                   uuid primary key default gen_random_uuid(),
  message_id           uuid references nurture.messages(id) on delete set null,
  provider_message_id  text,                 -- fallback-koppeling
  event_type           nurture.event_type not null,
  occurred_at          timestamptz not null,
  link_url             text,
  raw_payload          jsonb not null,
  provider_event_id    text not null,        -- svix-id; idempotentiesleutel
  received_at          timestamptz not null default now()
);

create unique index if not exists uq_event_provider_id
  on nurture.message_events (provider_event_id);
create index if not exists ix_event_message on nurture.message_events (message_id);
create index if not exists ix_event_type_time on nurture.message_events (event_type, occurred_at);

-- ---------- suppressions: nooit meer mailen (bounce/klacht/afmelding) ----------
create table if not exists nurture.suppressions (
  id                 uuid primary key default gen_random_uuid(),
  email              citext not null unique,
  reason             nurture.suppression_reason not null,
  source_message_id  uuid references nurture.messages(id) on delete set null,
  note               text,
  created_at         timestamptz not null default now()
);

-- ---------- Rapportage-view per stap (join op de bestaande e-mailflow) ----------
create or replace view nurture.v_step_performance as
select
  st.volgorde                                              as step_order,
  st.onderwerp                                             as subject,
  count(m.id)                                              as verzonden,
  count(m.id) filter (where m.status = 'delivered')        as bezorgd,
  count(m.id) filter (where m.first_opened_at is not null) as geopend,
  count(m.id) filter (where m.first_clicked_at is not null) as geklikt,
  count(m.id) filter (where m.status = 'bounced')          as gebounced,
  round(
    100.0 * count(m.id) filter (where m.first_clicked_at is not null)
    / nullif(count(m.id) filter (where m.status = 'delivered'), 0), 1
  )                                                        as ctr_pct
from public.email_sequence_steps st
left join nurture.messages m on m.email_step_id = st.id
group by st.volgorde, st.onderwerp
order by st.volgorde;

-- ---------- RLS: reads alleen voor allowlist-admins; writes via service_role ----------
alter table nurture.messages       enable row level security;
alter table nurture.message_events enable row level security;
alter table nurture.suppressions   enable row level security;

create policy admin_read_messages on nurture.messages
  for select to authenticated using (public.is_allowed_user());
create policy admin_read_events on nurture.message_events
  for select to authenticated using (public.is_allowed_user());
create policy admin_read_suppressions on nurture.suppressions
  for select to authenticated using (public.is_allowed_user());
