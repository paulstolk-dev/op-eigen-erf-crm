-- Portaal deelt nu ook de erfscan-info (conclusie + perceel/achtererf/vergunningvrij
-- m² + report_token voor de volledige Erf Check) met de aanbieder.
drop function if exists public.get_portal_leads();

create function public.get_portal_leads()
returns table(
  share_id uuid, lead_id uuid, aanbieder_id uuid, reactie_status text,
  contact_vrijgegeven boolean, gedeeld_at timestamptz, created_at timestamptz,
  type text, audience text, budget text, planning text, startdatum text,
  regio_postcode text, voornaam text, achternaam text, naam text, email text,
  telefoon text, postcode text, huisnummer text, toevoeging text,
  erfcheck_conclusie text, perceel_m2 int, achtererf_m2 int,
  max_vergunningvrij_m2 int, report_token uuid
)
language sql stable security definer set search_path to 'public'
as $function$
  select
    la.id, la.lead_id, la.aanbieder_id, la.status, la.contact_vrijgegeven,
    la.gedeeld_at, l.created_at, l.type, l.audience, l.budget, l.planning,
    l.startdatum,
    substring(coalesce(l.postcode, '') from '[0-9]{4}'),
    case when la.contact_vrijgegeven then l.voornaam end,
    case when la.contact_vrijgegeven then l.achternaam end,
    case when la.contact_vrijgegeven then l.naam end,
    case when la.contact_vrijgegeven then l.email end,
    case when la.contact_vrijgegeven then l.telefoon end,
    case when la.contact_vrijgegeven then l.postcode end,
    case when la.contact_vrijgegeven then l.huisnummer end,
    case when la.contact_vrijgegeven then l.toevoeging end,
    e.conclusie,
    (e.dossier->'perceel'->>'oppervlakte_m2')::numeric::int,
    round((e.dossier->'ruimtelijk'->>'achtererf_proxy_m2')::numeric)::int,
    round((e.dossier->'ruimtelijk'->>'max_vergunningvrij_m2')::numeric)::int,
    l.report_token
  from public.lead_aanbieder la
  join public.leads l on l.id = la.lead_id
  left join public.erfscans e on e.lead_id = l.id
  where la.aanbieder_id = public.current_aanbieder_id()
  order by la.gedeeld_at desc
$function$;

grant execute on function public.get_portal_leads() to authenticated;
