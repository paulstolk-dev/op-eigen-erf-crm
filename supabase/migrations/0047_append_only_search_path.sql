-- Hardening na de advisor-check op 0046: de append-only trigger draaide met een
-- rol-afhankelijk search_path. De functie raakt zelf geen tabellen aan, dus het
-- risico is klein, maar dit is precies de functie die de AVG-bewijslast bewaakt --
-- die wil je niet laten afhangen van waar de aanroeper zijn search_path op zet.
create or replace function public.lead_consents_append_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'lead_consents is append-only: leg een intrekking vast als nieuwe rij met granted=false';
end $$;
