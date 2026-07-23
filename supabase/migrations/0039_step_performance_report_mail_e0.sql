-- De Erf Check-rapportmail (verstuurd vanaf /leads via sendReport) wordt in de
-- meetlaag gelogd met email_step_id = NULL (stroom 'erfcheck'), want het is geen
-- flow-stap-verzending. Daardoor viel hij buiten 'Prestaties per stap'.
-- Attribueer die step-loze erfcheck-berichten aan de eerste stap (e0, volgorde 0):
-- dat is functioneel de eerste erfcheck-mail.
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
  ) as ctr_pct
from public.email_sequence_steps st
left join nurture.messages m
  on m.email_step_id = st.id
  or (st.volgorde = 0 and m.email_step_id is null and m.stroom::text = 'erfcheck')
group by st.volgorde, st.onderwerp
order by st.volgorde;
