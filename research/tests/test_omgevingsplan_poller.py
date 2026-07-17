"""Tests voor de omgevingsplan-poller: relevantiefilter + type-mapping.
Draai: python3 tests/test_omgevingsplan_poller.py   (of via pytest)
Gebruikt echte, opgeslagen publicatie-fragmenten in ../fixtures/.
"""
import os
import sys

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.dirname(HERE))  # research/ op het pad

from omgevingsplan_poller import (  # noqa: E402
    relevance, vergunningvrij_artikel, classify_type, besluit_id, _near,
    RE_2227, RE_2236, RE_INTREKKEN,
)

FIX = os.path.join(os.path.dirname(HERE), "fixtures")


def _fix(name: str) -> str:
    with open(os.path.join(FIX, name), encoding="utf-8") as f:
        return f.read()


# --- Relevantiefilter (semantisch: vergunningvrij-artikel, nummer-onafhankelijk) --- #
def test_relevantie_groningen_verplaatst_naar_32_36():
    # Regels inhoudelijk gelijk, alleen verplaatst naar art 32.36 (hfst 32). Een
    # 22.36-filter mist dit; de opschrift-filter moet het vangen.
    xml = _fix("groningen_32_36_vergunningvrij_pos.xml")
    rel, art = relevance(xml, "Technische wijziging omgevingsplan gemeente Groningen")
    assert rel is True and art == "32.36", (rel, art)


def test_relevantie_utrecht_verplaatst_naar_4_27():
    # Utrecht: uit 22.27/22.36 verplaatst naar 4.27/4.28.
    xml = _fix("utrecht_4_27_vergunningvrij_pos.xml")
    rel, art = relevance(xml, "Ontwerp besluit omzetting buurten Utrecht")
    assert rel is True and art is not None and art != "22.36", (rel, art)


def test_relevantie_negatief_vergunningplicht_artikel():
    # Locatieplan-artikel over vergunning*plicht* (geen vergunningvrij) → geen hit.
    xml = _fix("arnhem_vergunningplicht_neg.xml")
    rel, art = relevance(xml, "Ontwerp Wijziging Omgevingsplan Arnhem - Zijpendaalseweg 167")
    assert rel is False and art is None, (rel, art)


def test_relevantie_negatief_locatieplan_crossreference():
    # Alleen bruidsschat-cross-reference in de body, geen vergunningvrij-artikel,
    # geen 22.27/22.36, geen bruidsschat in de titel → afgewezen.
    txt = _fix("arnhem_zijpendaalseweg_neg.txt")
    rel, art = relevance(txt, "Ontwerp Wijziging Omgevingsplan gemeente Arnhem - Zijpendaalseweg 167")
    assert rel is False and art is None, (rel, art)


def test_relevantie_fallback_literal_2236():
    # Zonder XML-artikel maar mét literal 22.36 in de tekst → fallback vangt het.
    txt = _fix("roermond_bruidsschat_2236_pos.txt")
    rel, art = relevance(txt, "Wijzigingsbesluit omgevingsplan Roermond")
    assert rel is True and art == "22.36", (rel, art)


def test_relevantie_bruidsschat_in_titel():
    rel, art = relevance("losse tekst zonder artikel", "Technisch in beheer nemen Bruidsschat gemeente X")
    assert rel is True and art == "hoofdstuk 22 (bruidsschat)", (rel, art)


def test_relevantie_geen_valse_hit_op_plannaam_22h():
    # Zaanstad noemt plannen 'TAM-Omgevingsplan 22h' — mag GEEN hit zijn.
    rel, art = relevance("TAM-Omgevingsplan 22h Datacenters gewijzigd", "TAM-Omgevingsplan 22h Datacenters")
    assert rel is False, (rel, art)


def test_vergunningvrij_artikel_helper():
    assert vergunningvrij_artikel(_fix("groningen_32_36_vergunningvrij_pos.xml")) == "32.36"
    assert vergunningvrij_artikel(_fix("arnhem_vergunningplicht_neg.xml")) is None


# --- Type-mapping ----------------------------------------------------------- #
def test_type_ontwerp_nieuw():
    assert classify_type("Ontwerp Wijziging Omgevingsplan gemeente X - Straat 1", "wat tekst", False) == "ontwerp_nieuw"


def test_type_ontwerp_gewijzigd_als_al_bekend():
    assert classify_type("Kennisgeving Ontwerp Wijziging Omgevingsplan X", "tekst", True) == "ontwerp_gewijzigd"


def test_type_vastgesteld():
    assert classify_type("Wijziging Omgevingsplan gemeente Arnhem - Veegbesluit 2026-1", "tekst zonder artikelen", False) == "vastgesteld_gewijzigd"


def test_type_in_beheer_nemen_bruidsschat():
    assert classify_type("Technisch in beheer nemen Bruidsschat gemeente Moerdijk", "tekst", False) == "vastgesteld_gewijzigd"


def test_type_artikel_verdwenen_bij_intrekking_nabij_artikel():
    txt = "Artikel 22.36 Bijbehorende bouwwerken komt te vervallen en wordt vervangen."
    assert classify_type("Wijzigingsbesluit omgevingsplan X", txt, False) == "artikel_verdwenen"


def test_type_geen_artikel_verdwenen_bij_ver_verwijderde_intrekking():
    # '22.36' en 'vervalt' ver uit elkaar → geen artikel_verdwenen (proximity).
    txt = "Artikel 22.36 blijft ongewijzigd. " + ("x " * 400) + " Een geheel ander artikel vervalt."
    t = classify_type("Wijzigingsbesluit omgevingsplan X", txt, False)
    assert t != "artikel_verdwenen", t


def test_type_onbekend():
    assert classify_type("Een of andere bekendmaking", "geen signaal", False) == "onbekend"


# --- Dedupe: kennisgeving → besluit ----------------------------------------- #
def test_besluit_id_kennisgeving_mapt_op_besluit():
    rec = {"id": "gmb-2026-312583", "mededeling_over": "/akn/nl/officialGazette/gmb/2026/310561/nld@2026-06-29"}
    assert besluit_id(rec) == "gmb-2026-310561"


def test_besluit_id_besluit_zelf():
    assert besluit_id({"id": "gmb-2026-310561", "mededeling_over": None}) == "gmb-2026-310561"


def test_near_helper():
    assert _near("... 22.36 ... vervalt ...", (RE_2227, RE_2236), RE_INTREKKEN, 30) is True
    assert _near("22.36 " + "x" * 400 + " vervalt", (RE_2227, RE_2236), RE_INTREKKEN, 100) is False


# --- Runner (zonder pytest) ------------------------------------------------- #
if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    faal = 0
    for t in tests:
        try:
            t()
            print(f"PASS  {t.__name__}")
        except AssertionError as e:
            faal += 1
            print(f"FAIL  {t.__name__}: {e}")
        except Exception as e:  # noqa: BLE001
            faal += 1
            print(f"ERROR {t.__name__}: {e}")
    print(f"\n{len(tests) - faal}/{len(tests)} geslaagd")
    sys.exit(1 if faal else 0)
