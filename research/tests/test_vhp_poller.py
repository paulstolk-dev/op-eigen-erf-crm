"""
Tests voor de VHP-readiness-poller: relevantiefilter (echte VHP-vaststelling
positief, willekeurig raadsbesluit negatief, ontwerp vs vastgesteld) en de
backfill-cursor. Fixtures = titels/doctypes zoals live waargenomen op de SRU-feed.

Draaien vanuit research/:  python -m unittest discover -s tests
"""
import os
import sys
import unittest
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import vhp_poller as vp  # noqa: E402
from omgevingsplan_poller import cursor_sinds, default_sinds  # noqa: E402


class TestVhpRelevance(unittest.TestCase):
    # --- positief: echte vaststellingen (raadsbesluit / besluit-doctype) ---
    def test_raadsbesluit_vastgesteld(self):
        rel, status, zek = vp.vhp_relevance(
            "Raadsbesluit Volkshuisvestingsprogramma Woensdrecht",
            "ander besluit van algemene strekking",
        )
        self.assertTrue(rel)
        self.assertEqual(status, "vastgesteld")
        self.assertEqual(zek, "hoog")

    def test_besluit_doctype_vastgesteld(self):
        # kale titel, maar OWMS-doctype = besluit → vastgesteld
        rel, status, zek = vp.vhp_relevance(
            "Volkshuisvestingsprogramma gemeente Aalten",
            "ander besluit van algemene strekking",
        )
        self.assertTrue(rel)
        self.assertEqual(status, "vastgesteld")
        self.assertEqual(zek, "hoog")

    # --- positief: ontwerpen (nog niet vastgesteld) ---
    def test_kennisgeving_ontwerp(self):
        rel, status, zek = vp.vhp_relevance(
            "Kennisgeving ontwerp Volkshuisvestingsprogramma Molenlanden", "kennisgeving"
        )
        self.assertTrue(rel)
        self.assertEqual(status, "ontwerp")
        self.assertEqual(zek, "indicatie")

    def test_ontwerp_titel(self):
        rel, status, _ = vp.vhp_relevance(
            "Ontwerp Volkshuisvestingsprogramma 2026-2030 Gemeente Winterswijk", ""
        )
        self.assertTrue(rel)
        self.assertEqual(status, "ontwerp")

    def test_ontwerpwijzigingen_is_ontwerp(self):
        # 'Ontwerp' als prefix (geen woordgrens) — echte Dinkelland-casus
        rel, status, _ = vp.vhp_relevance(
            "Ontwerpwijzigingen beleidsnota Volkshuisvestingsprogramma 2025-2029",
            "ruimtelijk plan of omgevingsdocument",
        )
        self.assertTrue(rel)
        self.assertEqual(status, "ontwerp")

    # --- negatief: willekeurig ander raadsbesluit (geen VHP) ---
    def test_bestemmingsplan_niet_relevant(self):
        rel, status, _ = vp.vhp_relevance(
            "Raadsbesluit vaststelling bestemmingsplan Kern-Noord",
            "ander besluit van algemene strekking",
        )
        self.assertFalse(rel)

    def test_parkeerverordening_niet_relevant(self):
        rel, _, _ = vp.vhp_relevance("Parkeerverordening gemeente X 2026", "verordeningen")
        self.assertFalse(rel)

    # --- gepubliceerd omgevingsdocument zonder 'ontwerp' → waarschijnlijke vaststelling ---
    def test_plan_omgevingsdocument_is_vastgesteld_indicatie(self):
        # echte Aalten-casus: kale titel, doctype "ruimtelijk plan of omgevingsdocument"
        rel, status, zek = vp.vhp_relevance(
            "Volkshuisvestingsprogramma gemeente Aalten",
            "ruimtelijk plan of omgevingsdocument",
        )
        self.assertTrue(rel)
        self.assertEqual(status, "vastgesteld")
        self.assertEqual(zek, "indicatie")   # geen besluit-marker → geen automatische mail

    # --- recall-vangnet: VHP-term aanwezig, geen enkel doctype-/titelsignaal ---
    def test_kale_titel_zonder_doctype_is_onbekend(self):
        rel, status, zek = vp.vhp_relevance("Volkshuisvestingsprogramma Almelo", "")
        self.assertTrue(rel)          # recall: toch een reviewrij
        self.assertEqual(status, "onbekend")
        self.assertEqual(zek, "indicatie")


class TestClassify(unittest.TestCase):
    def test_mapping(self):
        self.assertEqual(vp.classify_vhp_type("vastgesteld"), "vhp_vastgesteld")
        self.assertEqual(vp.classify_vhp_type("ontwerp"), "vhp_ontwerp")
        self.assertEqual(vp.classify_vhp_type("onbekend"), "onbekend")


class TestQuery(unittest.TestCase):
    def test_query_bevat_kernvelden(self):
        q = vp.build_vhp_query("Zaanstad", "2024-01-01")
        self.assertIn('w.publicatienaam=="Gemeenteblad"', q)
        self.assertIn('w.gemeentenaam=="Zaanstad"', q)
        self.assertIn('dt.date >= "2024-01-01"', q)
        self.assertIn("volkshuisvestingsprogramma", q)


class TestBackfillCursor(unittest.TestCase):
    def test_override_wint(self):
        # backfill bij onboarding: --sinds override wint van de cursor
        self.assertEqual(cursor_sinds({"dso_laatst_gepolld": None}, "2024-01-01"), "2024-01-01")

    def test_cursor_uit_laatst_gepolld(self):
        dt = datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc)
        self.assertEqual(cursor_sinds({"dso_laatst_gepolld": dt}, None), "2026-05-01")

    def test_fallback_zonder_cursor(self):
        # geen override, geen cursor → 90-dagen-fallback (geldige ISO-datum)
        s = cursor_sinds({"dso_laatst_gepolld": None}, None)
        self.assertEqual(s, default_sinds())
        self.assertRegex(s, r"^\d{4}-\d{2}-\d{2}$")


if __name__ == "__main__":
    unittest.main()
