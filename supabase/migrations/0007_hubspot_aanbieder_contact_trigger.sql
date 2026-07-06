-- HubSpot-sync ook aftrappen bij wijziging van contactpersoon/e-mail/partnerstatus,
-- zodat de wervingsgegevens naar de HubSpot-company gaan.

create or replace function public.trigger_hubspot_aanbieder()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_op = 'INSERT'
     or old.naam is distinct from new.naam
     or old.website_url is distinct from new.website_url
     or old.vestigingsplaats is distinct from new.vestigingsplaats
     or old.beschrijving is distinct from new.beschrijving
     or old.prijsklasse is distinct from new.prijsklasse
     or old.contact_naam is distinct from new.contact_naam
     or old.contact_email is distinct from new.contact_email
     or old.partner_status is distinct from new.partner_status then
    perform net.http_post(
      url := 'https://crm.opeigenerf.nl/api/hubspot-sync',
      body := jsonb_build_object('aanbieder_id', new.id::text),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-erfscan-secret', 'a1b708fee9dc674efb044638f5d32157559509d94ef19fa0'
      ),
      timeout_milliseconds := 30000
    );
  end if;
  return new;
end;
$$;
