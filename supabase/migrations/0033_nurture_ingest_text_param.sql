-- ============================================================================
-- 0033 — Fix: nurture_ingest_event via PostgREST aanroepbaar maken.
-- De parameter was nurture.event_type (enum in het niet-blootgestelde nurture-
-- schema); PostgREST kan zo'n cross-schema-enum-parameter niet coërceren → de
-- Resend-webhook kreeg 500. Nu: parameter text, intern casten naar de enum.
-- ============================================================================

drop function if exists public.nurture_ingest_event(text, text, nurture.event_type, timestamptz, text, jsonb);

create or replace function public.nurture_ingest_event(
  p_event_id text, p_pmid text, p_event_type text,
  p_occurred timestamptz, p_link text, p_payload jsonb
) returns void
language plpgsql security definer set search_path = public, nurture as $$
declare v_msg uuid; v_email citext;
begin
  select id, to_email into v_msg, v_email from nurture.messages where provider_message_id = p_pmid;

  insert into nurture.message_events
    (message_id, provider_message_id, event_type, occurred_at, link_url, raw_payload, provider_event_id)
  values (v_msg, p_pmid, p_event_type::nurture.event_type, p_occurred, p_link, p_payload, p_event_id)
  on conflict (provider_event_id) do nothing;

  if v_msg is null then
    return;
  end if;

  if p_event_type = 'delivered' then
    update nurture.messages set status = 'delivered', delivered_at = coalesce(delivered_at, p_occurred) where id = v_msg;
  elsif p_event_type = 'opened' then
    update nurture.messages set open_count = open_count + 1, first_opened_at = coalesce(first_opened_at, p_occurred) where id = v_msg;
  elsif p_event_type = 'clicked' then
    update nurture.messages set click_count = click_count + 1, first_clicked_at = coalesce(first_clicked_at, p_occurred) where id = v_msg;
  elsif p_event_type = 'bounced' then
    update nurture.messages set status = 'bounced' where id = v_msg;
    insert into nurture.suppressions (email, reason, source_message_id) values (v_email, 'hard_bounce', v_msg)
      on conflict (email) do nothing;
  elsif p_event_type = 'complained' then
    update nurture.messages set status = 'complained' where id = v_msg;
    insert into nurture.suppressions (email, reason, source_message_id) values (v_email, 'complaint', v_msg)
      on conflict (email) do nothing;
  elsif p_event_type = 'failed' then
    update nurture.messages set status = 'failed' where id = v_msg;
  end if;
end;
$$;

revoke execute on function public.nurture_ingest_event(text, text, text, timestamptz, text, jsonb) from public;
grant execute on function public.nurture_ingest_event(text, text, text, timestamptz, text, jsonb) to service_role;
