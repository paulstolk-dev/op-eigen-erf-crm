-- Welke leads klikten in een flow-stap? Voedt de klikbare "Geklikt"-teller in
-- Instellingen -> E-mailflow -> Prestaties per stap.
--
-- De join is bewust identiek aan nurture.v_step_performance (incl. de
-- stap-loze erfcheck-rapportmails die aan stap 0 worden toegerekend), zodat de
-- lijst altijd precies het getal in de tabel oplevert.
create or replace function public.nurture_step_clickers(p_step_order integer)
returns table (
  lead_id          uuid,
  email            text,
  naam             text,
  first_clicked_at timestamptz,
  click_count      integer,
  lead_status      text
)
language sql
stable
security definer
set search_path to 'public', 'nurture'
as $$
  select m.lead_id,
         m.to_email::text,
         nullif(trim(coalesce(l.naam, concat_ws(' ', l.voornaam, l.achternaam))), ''),
         m.first_clicked_at,
         m.click_count,
         l.status
  from email_sequence_steps st
  join nurture.messages m
    on m.email_step_id = st.id
    or (st.volgorde = 0 and m.email_step_id is null and m.stroom = 'erfcheck')
  left join leads l on l.id = m.lead_id
  where st.volgorde = p_step_order
    and m.first_clicked_at is not null
    and public.is_allowed_user()
  order by m.first_clicked_at desc;
$$;

-- Alleen ingelogde CRM-gebruikers; is_allowed_user() doet de rest.
revoke all on function public.nurture_step_clickers(integer) from public, anon;
grant execute on function public.nurture_step_clickers(integer) to authenticated;
