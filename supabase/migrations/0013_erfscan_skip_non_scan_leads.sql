-- Alleen scan-types krijgen een automatische erfscan/erfcheck. Nieuwe lead-types
-- zonder scan (zoals 'besluit-alert', een besluit-alert-inschrijving) worden
-- overgeslagen zodat er geen erfscan/erfcheck-rapport voor wordt aangemaakt.
create or replace function public.trigger_erfscan()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.type not in ('erfcheck', 'haalbaarheidsscan') then
    return new;
  end if;

  perform net.http_post(
    url := 'https://crm.opeigenerf.nl/api/erfscan',
    body := jsonb_build_object('lead_id', new.id::text),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-erfscan-secret', 'a1b708fee9dc674efb044638f5d32157559509d94ef19fa0'
    ),
    timeout_milliseconds := 30000
  );
  return new;
end;
$function$;
