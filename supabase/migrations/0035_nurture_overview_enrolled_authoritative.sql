-- ============================================================================
-- 0035 — Dashboard: 'In flow' (enrolled) + conversie uit de echte flow-status,
-- niet uit de meetlaag. De meetlaag (nurture.messages) logt pas sinds kort, dus
-- reeds-lopende leads/aanbieders stonden daar niet in → 'In flow' toonde 0.
--   * erfcheck  enrolled = leads met een verstuurd erfcheck-rapport (de trigger)
--   * aanbieder enrolled = aanbieders die ooit benaderd zijn (partner_benaderd_at)
-- verzonden/bezorgd/geopend/geklikt/gebounced blijven de GEMETEN meetlaag-cijfers.
-- ============================================================================

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
      'aanbieder'::text, 'Aanbieder-werving'::text, 'Preferred partner'::text, null::int,
      (select count(*) from public.aanbieders where partner_benaderd_at is not null),
      (select count(*) from nurture.messages where stroom = 'aanbieder'),
      (select count(*) from nurture.messages where stroom = 'aanbieder' and status = 'delivered'),
      (select count(*) from nurture.messages where stroom = 'aanbieder' and first_opened_at is not null),
      (select count(*) from nurture.messages where stroom = 'aanbieder' and first_clicked_at is not null),
      (select count(*) from nurture.suppressions s where s.reason = 'unsubscribe'
        and s.email in (select to_email from nurture.messages where stroom = 'aanbieder')),
      (select count(*) from nurture.messages where stroom = 'aanbieder' and status = 'bounced'),
      (select count(*) from public.aanbieders where partner_status = 'partner' and partner_benaderd_at is not null)
  ) t
  where public.is_allowed_user();
$$;
