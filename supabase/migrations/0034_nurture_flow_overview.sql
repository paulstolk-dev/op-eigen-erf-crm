-- ============================================================================
-- 0034 — Nurture-dashboard: geaggregeerd overzicht per flow (twee stromen:
-- 'erfcheck' en 'aanbieder'). Leest de meetlaag; conversie/afmelding uit de
-- bestaande CRM-status. Allowlist-guarded.
-- ============================================================================

create or replace function public.nurture_flow_overview()
returns table(
  stroom text, naam text, doel text, waarde_per_conversie int,
  enrolled bigint, verzonden bigint, bezorgd bigint, geopend bigint,
  geklikt bigint, afgemeld bigint, gebounced bigint, geconverteerd bigint
)
language sql security definer set search_path = public, nurture as $$
  select * from (
    -- Erfcheck-opvolgflow: doel = geboekte haalbaarheidsscan (proxy: lead gewonnen).
    select
      'erfcheck'::text, 'Erfcheck-opvolging'::text, 'Haalbaarheidsscan'::text, 99,
      (select count(distinct lead_id) from nurture.messages where stroom = 'erfcheck'),
      (select count(*) from nurture.messages where stroom = 'erfcheck'),
      (select count(*) from nurture.messages where stroom = 'erfcheck' and status = 'delivered'),
      (select count(*) from nurture.messages where stroom = 'erfcheck' and first_opened_at is not null),
      (select count(*) from nurture.messages where stroom = 'erfcheck' and first_clicked_at is not null),
      (select count(*) from nurture.suppressions s where s.reason = 'unsubscribe'
        and s.email in (select to_email from nurture.messages where stroom = 'erfcheck')),
      (select count(*) from nurture.messages where stroom = 'erfcheck' and status = 'bounced'),
      (select count(*) from public.leads l where l.status = 'gewonnen'
        and l.id in (select lead_id from nurture.messages where stroom = 'erfcheck' and lead_id is not null))
    union all
    -- Aanbieder-wervingssequence: doel = preferred partner.
    select
      'aanbieder'::text, 'Aanbieder-werving'::text, 'Preferred partner'::text, null::int,
      (select count(distinct aanbieder_id) from nurture.messages where stroom = 'aanbieder'),
      (select count(*) from nurture.messages where stroom = 'aanbieder'),
      (select count(*) from nurture.messages where stroom = 'aanbieder' and status = 'delivered'),
      (select count(*) from nurture.messages where stroom = 'aanbieder' and first_opened_at is not null),
      (select count(*) from nurture.messages where stroom = 'aanbieder' and first_clicked_at is not null),
      (select count(*) from nurture.suppressions s where s.reason = 'unsubscribe'
        and s.email in (select to_email from nurture.messages where stroom = 'aanbieder')),
      (select count(*) from nurture.messages where stroom = 'aanbieder' and status = 'bounced'),
      (select count(*) from public.aanbieders a where a.partner_status = 'partner'
        and a.id in (select aanbieder_id from nurture.messages where stroom = 'aanbieder' and aanbieder_id is not null))
  ) t
  where public.is_allowed_user();
$$;

grant execute on function public.nurture_flow_overview() to authenticated, service_role;
