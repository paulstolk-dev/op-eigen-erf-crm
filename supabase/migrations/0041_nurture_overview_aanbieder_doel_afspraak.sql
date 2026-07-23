-- Aanbieder-werving: eerste doel is nu 'Afspraak gepland' (niet meteen partner).
-- Conversie telt aanbieders die minstens een afspraak gepland hebben (of partner zijn).
create or replace function public.nurture_flow_overview()
returns table(
  stroom text, naam text, doel text, waarde_per_conversie int,
  enrolled bigint, verzonden bigint, bezorgd bigint, geopend bigint,
  geklikt bigint, afgemeld bigint, gebounced bigint, geconverteerd bigint
)
language sql security definer set search_path = public, nurture as $$
  select * from (
    select
      'erfcheck'::text, 'Erfcheck-opvolging'::text, 'Haalbaarheidsscan'::text, 99,
      (select count(distinct lead_id) from public.erfscans where sent_at is not null),
      (select count(*) from nurture.messages where stroom = 'erfcheck'),
      (select count(*) from nurture.messages where stroom = 'erfcheck' and status = 'delivered'),
      (select count(*) from nurture.messages where stroom = 'erfcheck' and first_opened_at is not null),
      (select count(*) from nurture.messages where stroom = 'erfcheck' and first_clicked_at is not null),
      (select count(*) from nurture.suppressions s where s.reason = 'unsubscribe'
        and s.email in (select to_email from nurture.messages where stroom = 'erfcheck')),
      (select count(*) from nurture.messages where stroom = 'erfcheck' and status = 'bounced'),
      (select count(*) from public.leads l where l.status = 'gewonnen'
        and l.id in (select lead_id from public.erfscans where sent_at is not null))
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
