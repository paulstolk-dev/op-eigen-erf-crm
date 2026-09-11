-- Correctie op 0046. De append-only trigger blokkeerde UPDATE én DELETE. Daarmee
-- werd een lead met een consent-rij onverwijderbaar: ook een cascade-delete vanaf
-- public.leads liep stuk op deze trigger.
--
-- Dat botst met het recht op verwijdering (AVG art. 17). De bewijslast uit art. 7
-- vraagt dat je een gegeven toestemming niet kunt HERSCHRIJVEN; hij vraagt niet
-- dat je een betrokkene nooit meer kunt wissen. Vanaf nu:
--
--   UPDATE  -> geblokkeerd (intrekken blijft een nieuwe rij met granted=false)
--   DELETE  -> toegestaan, zodat een verwijderverzoek uitgevoerd kan worden en
--              de cascade vanaf leads werkt
--
-- Verwijderen blijft een bewuste handeling via de service role; de tabel is met
-- RLS afgeschermd, dus de site of een ingelogde gebruiker komt er niet bij.
create or replace function public.lead_consents_append_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'lead_consents mag niet gewijzigd worden: leg een intrekking vast als nieuwe rij met granted=false';
end $$;

drop trigger if exists trg_lead_consents_append_only on public.lead_consents;
create trigger trg_lead_consents_append_only
  before update on public.lead_consents
  for each row execute function public.lead_consents_append_only();

comment on table public.lead_consents is
  'Onveranderlijk consent-logboek (AVG art. 7 lid 1: aantoonbaarheid). Rijen worden nooit gewijzigd; intrekking = nieuwe rij met granted=false. Verwijderen kan alleen bewust via de service role, voor een verwijderverzoek (art. 17) of een cascade vanaf de lead.';
