-- De publieke site (opeigenerf.nl, anon-key) mag gepubliceerde gemeenten lezen.
-- Alleen SELECT, alleen rijen met research_status='onderzocht'. Schrijven blijft
-- voorbehouden aan de CRM-allowlist (bestaande 'crm all gemeenten'-policy).
create policy "public read gepubliceerde gemeenten" on public.gemeenten
  for select using (research_status = 'onderzocht');
