-- 'Prestaties per stap' krijgt een conversiekolom: hoeveel kennismakingsgesprekken
-- er uit welke opvolgmail zijn gekomen.
--
-- Attributie op de UTM van de CTA-link. De flow-CTA's volgen het patroon
-- utm_content=<sleutel>-<doel> (e1-scan, e3-gesprek, e4-scan), en de site slaat de
-- volledige landings-URL op in leads.details->>'source_page_url'. Daarmee weten we
-- exact wélke mail het gesprek opleverde — geen aanname, maar de echte bron.

create or replace view nurture.v_step_performance as
select
  st.volgorde as step_order,
  st.onderwerp as subject,
  count(m.id) as verzonden,
  count(m.id) filter (where m.status = 'delivered'::nurture.message_status) as bezorgd,
  count(m.id) filter (where m.first_opened_at is not null) as geopend,
  count(m.id) filter (where m.first_clicked_at is not null) as geklikt,
  count(m.id) filter (where m.status = 'bounced'::nurture.message_status) as gebounced,
  round(
    100.0 * count(m.id) filter (where m.first_clicked_at is not null)::numeric
    / nullif(count(m.id) filter (where m.status = 'delivered'::nurture.message_status), 0)::numeric,
    1
  ) as ctr_pct,
  (
    select count(*)
    from public.leads k
    where k.type = 'kennismaking'
      and coalesce(substring(k.details->>'source_page_url' from 'utm_content=([^&]+)'), '')
          like st.sleutel || '-%'
  ) as geconverteerd
from public.email_sequence_steps st
left join nurture.messages m
  on m.email_step_id = st.id
  or (st.volgorde = 0 and m.email_step_id is null and m.stroom::text = 'erfcheck')
group by st.volgorde, st.onderwerp, st.sleutel
order by st.volgorde;

-- RPC uitbreiden met de conversiekolom (guard blijft: alleen allowlist-admins).
drop function if exists public.nurture_step_performance();
create or replace function public.nurture_step_performance()
returns table(
  step_order int, subject text, verzonden bigint, bezorgd bigint,
  geopend bigint, geklikt bigint, gebounced bigint, ctr_pct numeric,
  geconverteerd bigint
)
language sql security definer set search_path = public, nurture as $$
  select v.step_order, v.subject, v.verzonden, v.bezorgd, v.geopend, v.geklikt,
         v.gebounced, v.ctr_pct, v.geconverteerd
  from nurture.v_step_performance v
  where public.is_allowed_user();
$$;

grant execute on function public.nurture_step_performance() to authenticated, service_role;
