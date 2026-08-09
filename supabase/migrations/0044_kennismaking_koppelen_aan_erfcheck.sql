-- Kennismakingsgesprek-aanvragen koppelen aan de erfcheck-lead van dezelfde
-- persoon, en die koppeling als conversie tellen in de erfcheck-nurtureflow.
--
-- Achtergrond: de site maakt voor een kennismakingsaanvraag een aparte lead
-- (type 'kennismaking'). Vraagt iemand een gesprek aan die eerder een Erf Check
-- deed, dan hoort dat bij dezelfde persoon — en is het de conversie waar de
-- opvolgmails op sturen ("Plan een gratis adviesgesprek").

-- 1) Koppeling: een lead kan naar een 'hoofdlead' wijzen (de erfcheck-lead).
alter table public.leads
  add column if not exists parent_lead_id uuid references public.leads(id) on delete set null;

create index if not exists leads_parent_lead_id_idx on public.leads(parent_lead_id);

-- 2) Automatisch koppelen bij binnenkomst. De site schrijft met de anon-key, dus
--    SECURITY DEFINER zodat de lookup langs RLS kan. Koppelt op e-mailadres aan
--    de meest recente erfcheck-lead.
create or replace function public.link_lead_to_erfcheck()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'erfcheck' or new.email is null or new.parent_lead_id is not null then
    return new;
  end if;

  select l.id into new.parent_lead_id
  from public.leads l
  where l.type = 'erfcheck'
    and lower(l.email) = lower(new.email)
    and l.id <> new.id
  order by l.created_at desc
  limit 1;

  return new;
end;
$$;

drop trigger if exists leads_link_to_erfcheck on public.leads;
create trigger leads_link_to_erfcheck
  before insert on public.leads
  for each row execute function public.link_lead_to_erfcheck();

-- 3) Backfill: bestaande niet-erfcheck-leads alsnog koppelen op e-mailadres.
update public.leads k
set parent_lead_id = e.id
from public.leads e
where k.type <> 'erfcheck'
  and k.parent_lead_id is null
  and k.email is not null
  and e.type = 'erfcheck'
  and lower(e.email) = lower(k.email)
  and e.id <> k.id;

-- 4) Conversie: een erfcheck-lead telt als geconverteerd zodra hij 'gewonnen' is
--    óf er een kennismakingsgesprek aan gekoppeld is. Het doel van de flow is
--    daarmee 'Scan of kennismaking'.
create or replace function public.nurture_flow_overview()
returns table(
  stroom text, naam text, doel text, waarde_per_conversie int,
  enrolled bigint, verzonden bigint, bezorgd bigint, geopend bigint,
  geklikt bigint, afgemeld bigint, gebounced bigint, geconverteerd bigint
)
language sql security definer set search_path = public, nurture as $$
  select * from (
    select
      'erfcheck'::text, 'Erfcheck-opvolging'::text, 'Scan of kennismaking'::text, 99,
      (select count(distinct lead_id) from public.erfscans where sent_at is not null),
      (select count(*) from nurture.messages where stroom = 'erfcheck'),
      (select count(*) from nurture.messages where stroom = 'erfcheck' and status = 'delivered'),
      (select count(*) from nurture.messages where stroom = 'erfcheck' and first_opened_at is not null),
      (select count(*) from nurture.messages where stroom = 'erfcheck' and first_clicked_at is not null),
      (select count(*) from nurture.suppressions s where s.reason = 'unsubscribe'
        and s.email in (select to_email from nurture.messages where stroom = 'erfcheck')),
      (select count(*) from nurture.messages where stroom = 'erfcheck' and status = 'bounced'),
      (select count(*) from public.leads l
        where l.id in (select lead_id from public.erfscans where sent_at is not null)
          and (
            l.status = 'gewonnen'
            or exists (
              select 1 from public.leads k
              where k.parent_lead_id = l.id and k.type = 'kennismaking'
            )
          ))
    union all
    select
      'aanbieder'::text, 'Aanbieder-werving'::text, 'Afspraak gepland'::text, null::int,
      (select count(*) from public.aanbieders where partner_benaderd_at is not null),
      (select count(*) from nurture.messages where stroom = 'aanbieder'),
      (select count(*) from nurture.messages where stroom = 'aanbieder' and status = 'delivered'),
      (select count(*) from nurture.messages where stroom = 'aanbieder' and first_opened_at is not null),
      (select count(*) from nurture.messages where stroom = 'aanbieder' and first_clicked_at is not null),
      (select count(*) from nurture.suppressions s where s.reason = 'unsubscribe'
        and s.email in (select to_email from nurture.messages where stroom = 'aanbieder')),
      (select count(*) from nurture.messages where stroom = 'aanbieder' and status = 'bounced'),
      (select count(*) from public.aanbieders
        where partner_status in ('afspraak_gepland','partner') and partner_benaderd_at is not null)
  ) t
  where public.is_allowed_user();
$$;
