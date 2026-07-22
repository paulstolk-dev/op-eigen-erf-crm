-- gewenst_formaat en budget_indicatie dupliceren wat het erfcheck-formulier al
-- opslaat (grootte → estimated_size/grootte_m2, budget → estimated_budget/budget).
-- De /mijn/erf-intake schrijft voortaan naar die bestaande kolommen. voor_wie en
-- termijn blijven (worden nergens anders vastgelegd).
alter table public.leads
  drop column if exists gewenst_formaat,
  drop column if exists budget_indicatie;
