-- ============================================================
-- SEED: aanbieders (catalogus opeigenerf.nl)
-- ============================================================
-- BRON: de ~13 aanbieders staan HARDCODED in de repo van de publieke site
--       (opeigenerf.nl), NIET in deze CRM-repo. Kopieer die data hierheen.
--
-- REGELS (belangrijk — niet schatten/verzinnen):
--   * Onbekende waarde  -> NULL   (of 'niet_vermeld' bij vergunningsbegeleiding)
--   * "Op aanvraag"      -> NULL   in prijsvelden (vanaf_prijs_incl_btw, etc.)
--   * prijzen            -> hele euro's als integer, incl. btw (vanaf-prijs)
--   * afwerkingsniveaus  -> array van 'casco'/'instapklaar'/'luxe', bv. '{casco,luxe}'
--   * prijspeil + bron   -> overnemen zoals bekend (bv. '2022 (verouderd)')
--   * woningen-tabel start LEEG; woningen voeg je later toe via het CRM.
--
-- Idempotent: on conflict (slug) do update, zodat je dit bestand kunt herdraaien.
-- Draai via de Supabase SQL-editor of MCP nadat je de rijen hebt aangevuld.
-- ============================================================

insert into public.aanbieders (
  slug, naam, website_url, logo_url, beschrijving,
  vestigingsplaats, servicegebied, bouwmethode, levertijd_indicatie,
  vergunningsbegeleiding, koop, huur, tweedehands,
  prijsklasse, vanaf_prijs_incl_btw, prijs_per_m2_indicatie, afwerkingsniveaus,
  in_vanaf_prijs, prijspeil, bron_url, laatst_gecontroleerd,
  is_partner, actief, sortering
) values

-- ---- 1) BUNDA (bekend: prijspeil verouderd; overige velden AANVULLEN uit publieke repo) ----
(
  'bunda',                    -- slug
  'BUNDA',                    -- naam
  null,                       -- website_url          TODO
  null,                       -- logo_url             TODO (upload via CRM -> Storage 'aanbieders')
  null,                       -- beschrijving         TODO
  null,                       -- vestigingsplaats     TODO
  'Heel NL',                  -- servicegebied        (default; pas aan indien bekend)
  null,                       -- bouwmethode          TODO
  null,                       -- levertijd_indicatie  TODO
  'niet_vermeld',             -- vergunningsbegeleiding  ('ja'/'nee'/'niet_vermeld')
  true,                       -- koop
  false,                      -- huur
  false,                      -- tweedehands
  null,                       -- prijsklasse          ('budget'/'standaard'/'luxe') TODO
  null,                       -- vanaf_prijs_incl_btw  (NULL = op aanvraag) TODO
  null,                       -- prijs_per_m2_indicatie TODO
  null,                       -- afwerkingsniveaus     bv. '{casco,instapklaar}'::text[] TODO
  null,                       -- in_vanaf_prijs        TODO
  '2022 (verouderd)',         -- prijspeil             (BEKEND)
  null,                       -- bron_url              TODO
  null,                       -- laatst_gecontroleerd  (date) TODO
  false,                      -- is_partner
  true,                       -- actief
  0                           -- sortering
)

-- ---- 2..13) TODO: voeg hier de overige aanbieders toe, één (...)-blok per aanbieder ----
--   Kopieer het BUNDA-blok, geef een uniek 'slug', vul in wat bekend is, rest = null.
--   Voorbeeld leeg blok:
--   , ( 'aanbieder-slug', 'Aanbieder Naam', null, null, null,
--       null, 'Heel NL', null, null, 'niet_vermeld',
--       true, false, false, null, null, null, null, null, null, null, null,
--       false, true, 0 )

on conflict (slug) do update set
  naam = excluded.naam,
  website_url = excluded.website_url,
  logo_url = excluded.logo_url,
  beschrijving = excluded.beschrijving,
  vestigingsplaats = excluded.vestigingsplaats,
  servicegebied = excluded.servicegebied,
  bouwmethode = excluded.bouwmethode,
  levertijd_indicatie = excluded.levertijd_indicatie,
  vergunningsbegeleiding = excluded.vergunningsbegeleiding,
  koop = excluded.koop,
  huur = excluded.huur,
  tweedehands = excluded.tweedehands,
  prijsklasse = excluded.prijsklasse,
  vanaf_prijs_incl_btw = excluded.vanaf_prijs_incl_btw,
  prijs_per_m2_indicatie = excluded.prijs_per_m2_indicatie,
  afwerkingsniveaus = excluded.afwerkingsniveaus,
  in_vanaf_prijs = excluded.in_vanaf_prijs,
  prijspeil = excluded.prijspeil,
  bron_url = excluded.bron_url,
  laatst_gecontroleerd = excluded.laatst_gecontroleerd,
  is_partner = excluded.is_partner,
  actief = excluded.actief,
  sortering = excluded.sortering;
