#!/usr/bin/env python3
"""
vhp_poller.py — Gemeente-readiness tracker (volkshuisvestingsprogramma).

VERVANGT de inhoudelijke omgevingsplan-monitoring. Reden: met de Wet/Besluit
versterking regie volkshuisvesting verhuizen de vergunningvrije mantelzorg-/
familiewoning-regels TERUG naar het Rijk (Bbl art. 2.30b, landelijk uniform).
Per gemeente valt er inhoudelijk vrijwel niets meer te monitoren; wat wél per
gemeente verschilt, is het MOMENT waarop het ingaat. Het beste waarneembare
signaal daarvoor is de vaststelling van het volkshuisvestingsprogramma (VHP).

NOG NIET DEFINITIEF: of het toepasbare moment per gemeente écht aan de
VHP-vaststelling hangt, of dat de landelijke Bbl-regel al bij inwerkingtreding van
het Besluit (~jan 2027) rechtstreeks geldt, is niet eenduidig. Deze poller
REGISTREERT alleen het signaal (VHP vastgesteld/ontwerp); de interpretatie is aan
de mens. Assereer geen mechanisme.

Bron: SRU 2.0 van Overheid.nl over de officiële publicaties (Gemeenteblad).
Gratis, geen API-key. De poller PUBLICEERT NOOIT en vult geen redactionele velden
(vhp_status, gecontroleerd_op, content). Bij een treffer schrijft hij een rij naar
`gemeente_wijzigingen` (type vhp_vastgesteld/vhp_ontwerp) en pingt het notificatie-
endpoint. Een mens verwerkt de inhoud.

Vereist migratie 0028 (vhp_* enumwaarden). Draaien (dry-run is default):
    python vhp_poller.py --gemeente woensdrecht --sinds 2024-01-01
    python vhp_poller.py --commit                          # alle onderzochte gemeenten
    python vhp_poller.py --gemeente aalten --commit --sinds 2024-01-01
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from xml.etree import ElementTree as ET

import httpx

# Hergebruik van de bewezen SRU-infra uit de (nu gedeprecieerde) omgevingsplan-poller.
from omgevingsplan_poller import (
    DB,
    NOTIFY_ALLEEN_HOOG,
    SRU_ENDPOINT,
    TIMEOUT,
    USER_AGENT,
    _find_text,
    _get_with_retry,
    _local,
    besluit_id,
    cursor_sinds,
    log,
    notify,
    strip_tags,
)

try:
    from psycopg.types.json import Jsonb
except Exception:  # pragma: no cover
    Jsonb = None

VERSION = "vhp-readiness-1"

# Sentinel voor de (not-null) artikel-kolom: VHP kent geen artikelnummer. Samen met
# de publicatie-id (nieuwe_hash) houdt dit de unique-constraint idempotent.
VHP_SENTINEL = "volkshuisvestingsprogramma"

# --------------------------------------------------------------------------- #
# Relevantie + type (puur functioneel — getest)
# --------------------------------------------------------------------------- #
RE_VHP = re.compile(r"volkshuisvestingsprogramma", re.I)
# Ontwerp/voornemen — nog niet vastgesteld. 'ontwerp' als prefix (vangt ook
# "Ontwerpwijzigingen", "Ontwerp-Volkshuisvestingsprogramma").
RE_ONTWERP = re.compile(r"\bontwerp|ter\s*inzage|terinzage|voornemen|zienswijze", re.I)
# Vaststelling — een besluit van de raad.
RE_VASTGESTELD = re.compile(r"raadsbesluit|vastgesteld|vaststelling|besluit\b", re.I)
# Gepubliceerd plan/omgevingsdocument (OWMS-doctype). Zonder "ontwerp" in de titel
# is dit doorgaans de vastgestelde versie (de ontwerpfase draagt altijd 'ontwerp').
RE_PLANDOC = re.compile(r"omgevingsdocument|ruimtelijk\s+plan|omgevingsprogramma", re.I)


def vhp_relevance(titel: str, doctype: str = "", text: str = "") -> tuple[bool, str, str]:
    """Raakt de publicatie een volkshuisvestingsprogramma? En zo ja: vastgesteld of ontwerp?

    Geeft (relevant, status, zekerheid):
      - status:    'vastgesteld' | 'ontwerp' | 'onbekend'
      - zekerheid: 'hoog' (duidelijke vaststelling → mailen) | 'indicatie' (ontwerp/
                   waarschijnlijke vaststelling/twijfel → geen mail, mens bevestigt)

    Semantisch, niet op documentnummer. Optimaliseert op recall: bij twijfel toch
    relevant. Een willekeurig ander raadsbesluit (geen VHP) valt af.
    """
    haystack = f"{titel or ''} {text or ''}"
    if not RE_VHP.search(haystack):
        return False, "onbekend", "indicatie"

    is_ontwerp = bool(RE_ONTWERP.search(titel or "")) or bool(RE_ONTWERP.search(text or ""))
    if is_ontwerp:
        return True, "ontwerp", "indicatie"

    # Een besluit-doctype (OWMS 'type', bv. "ander besluit van algemene strekking")
    # of vaststellings-taal in de titel → zekere vaststelling.
    besluit_doctype = "besluit" in (doctype or "").lower()
    if besluit_doctype or RE_VASTGESTELD.search(titel or ""):
        return True, "vastgesteld", "hoog"

    # Gepubliceerd VHP-omgevingsdocument zonder ontwerp-markering → waarschijnlijk
    # de vaststelling, maar niet als besluit gemarkeerd → vastgesteld/indicatie (geen mail).
    if RE_PLANDOC.search(doctype or ""):
        return True, "vastgesteld", "indicatie"

    # VHP-term aanwezig, geen enkel doctype-/titelsignaal → recall-vangnet.
    return True, "onbekend", "indicatie"


def classify_vhp_type(status: str) -> str:
    """Map de readiness-status op de gemeente_wijziging-type-enum (0028)."""
    if status == "vastgesteld":
        return "vhp_vastgesteld"
    if status == "ontwerp":
        return "vhp_ontwerp"
    return "onbekend"


# --------------------------------------------------------------------------- #
# SRU-zoek (VHP-variant)
# --------------------------------------------------------------------------- #
def build_vhp_query(gemeentenaam: str, sinds: str) -> str:
    """CQL: Gemeenteblad + deze gemeente + sinds-datum + titel volkshuisvestingsprogramma."""
    return (
        f'w.publicatienaam=="Gemeenteblad" '
        f'and w.gemeentenaam=="{gemeentenaam}" '
        f'and dt.date >= "{sinds}" '
        f'and dt.title all "volkshuisvestingsprogramma" '
        f"sortBy dt.date/sort.descending"
    )


def sru_vhp_search(client: httpx.Client, gemeentenaam: str, sinds: str, limit: int) -> tuple[int, list[dict]]:
    """(totaal, records). Elke record: id/titel/datum/type/gemeentenaam/bron_url/mededeling_over."""
    params = {
        "operation": "searchRetrieve",
        "version": "2.0",
        "httpAccept": "application/xml",
        "maximumRecords": str(min(limit, 100)),
        "query": build_vhp_query(gemeentenaam, sinds),
    }
    r = _get_with_retry(client, SRU_ENDPOINT, params)
    root = ET.fromstring(r.content)
    total = 0
    for c in root.iter():
        if _local(c.tag) == "numberOfRecords":
            total = int(c.text or "0")
            break
    records: list[dict] = []
    for rec in root.iter():
        if _local(rec.tag) != "recordData":
            continue
        preferred = None
        for u in rec.iter():
            if _local(u.tag) == "preferredUrl" and u.text:
                preferred = u.text.strip()
        records.append({
            "id": _find_text(rec, "identifier"),
            "titel": _find_text(rec, "title") or "",
            "datum": _find_text(rec, "date"),
            "type": _find_text(rec, "type") or "",
            "gemeentenaam": _find_text(rec, "gemeentenaam"),
            "mededeling_over": _find_text(rec, "mededelingOver"),
            "bron_url": preferred,
        })
    return total, records


# --------------------------------------------------------------------------- #
# Kern: één gemeente pollen
# --------------------------------------------------------------------------- #
def poll_gemeente(db: DB | None, http: httpx.Client, gem: dict, sinds: str,
                  limit: int, commit: bool) -> dict:
    slug, naam = gem["slug"], gem["naam"]
    ontwerp_al = bool(gem.get("dso_ontwerp_aanwezig"))
    log(f"» {naam} ({slug}) — VHP-readiness sinds {sinds}")

    total, records = sru_vhp_search(http, naam, sinds, limit)
    log(f"  {total} treffer(s) (verwerk {len(records)})")

    # Dedupe kennisgeving+besluit op het besluit-id.
    per_besluit: dict[str, dict] = {}
    for rec in records:
        bid = besluit_id(rec)
        if not bid:
            continue
        keep = per_besluit.get(bid)
        if keep is None or (keep.get("mededeling_over") and not rec.get("mededeling_over")):
            per_besluit[bid] = {**rec, "besluit_id": bid}

    relevant_count = 0
    ontwerp_gezien = ontwerp_al
    fragment_log: list[str] = []

    for bid, rec in per_besluit.items():
        titel = rec.get("titel", "")
        doctype = rec.get("type", "")
        is_rel, status, zekerheid = vhp_relevance(titel, doctype)
        if not is_rel:
            continue
        relevant_count += 1
        if status == "ontwerp":
            ontwerp_gezien = True
        wtype = classify_vhp_type(status)
        delta = {
            "titel": titel[:300],
            "doctype": doctype,
            "status": status,
            "zekerheid": zekerheid,
            "datum": rec.get("datum"),
        }
        bron_url = rec.get("bron_url") or f"https://zoek.officielebekendmakingen.nl/{bid}.html"
        fragment_log.append(f"{bid} [{wtype}/{zekerheid}] {status}: {titel[:70]}")
        log(f"    ✓ RELEVANT {bid} → {status} · {wtype} · {zekerheid}")

        if commit and db is not None:
            payload = {
                "gemeente_slug": slug,
                "artikel": VHP_SENTINEL,
                "type": wtype,
                "nieuwe_hash": bid,
                "delta": Jsonb(delta) if Jsonb else delta,
                "bron_url": bron_url,
            }
            new_id = db.insert_wijziging(payload)
            if new_id:
                if not NOTIFY_ALLEEN_HOOG or zekerheid == "hoog":
                    notify(http, {
                        "gemeente": naam, "type": wtype, "artikel": "volkshuisvestingsprogramma",
                        "bron_url": bron_url, "id": new_id, "signalen": [status],
                    })
                    log(f"      ↑ nieuw ({new_id}) + genotificeerd")
                else:
                    log(f"      ↑ nieuw ({new_id}) — opgeslagen, geen mail (zekerheid={zekerheid})")
            else:
                log("      = bestond al (on conflict do nothing)")

    resultaat = "geen_treffers" if relevant_count == 0 else "ok"
    if commit and db is not None and not gem.get("_adhoc"):
        # Cursor bijwerken; VHP kent geen AKN → None (coalesce laat bestaande staan).
        db.update_gemeente_cursor(slug, ontwerp_gezien, None)
        db.insert_check(slug, resultaat, total, relevant_count, "\n".join(fragment_log), None)
        db.conn.commit()
    return {"slug": slug, "treffers": total, "relevant": relevant_count, "resultaat": resultaat}


# --------------------------------------------------------------------------- #
# Run + CLI
# --------------------------------------------------------------------------- #
def run(commit: bool = False, gemeente: str | None = None,
        sinds: str | None = None, limit: int = 50) -> dict:
    """Herbruikbaar vanuit CLI én de HTTP-trigger (/poll). Geeft een samenvatting."""
    import os
    if not commit:
        log("== DRY-RUN (schrijft niets; commit=True om weg te schrijven) ==")

    db: DB | None = None
    if commit or not gemeente:
        dsn = os.environ.get("SUPABASE_DB_URL")
        if not dsn:
            raise RuntimeError("SUPABASE_DB_URL ontbreekt.")
        db = DB(dsn)
    elif os.environ.get("SUPABASE_DB_URL"):
        db = DB(os.environ["SUPABASE_DB_URL"])

    gemeenten = db.gemeenten_te_pollen(gemeente) if db else [{
        "slug": gemeente, "naam": (gemeente or "").replace("-", " ").title(),
        "dso_laatst_gepolld": None, "dso_ontwerp_aanwezig": False, "_adhoc": True,
    }]
    if not gemeenten:
        log("Geen gemeenten met research_status <> 'niet_onderzocht'. Niets te doen.")
        return {"gemeenten": 0, "relevant": 0, "resultaten": []}

    headers = {"User-Agent": USER_AGENT, "Accept": "application/xml"}
    resultaten: list[dict] = []
    with httpx.Client(headers=headers, timeout=TIMEOUT, follow_redirects=True) as http:
        for gem in gemeenten:
            try:
                res = poll_gemeente(db, http, gem, cursor_sinds(gem, sinds), limit, commit)
                log(f"  → {res['resultaat']}: {res['relevant']} relevant van {res['treffers']}")
                resultaten.append(res)
            except Exception as e:  # noqa: BLE001 — één gemeente mag de run niet stoppen
                log(f"  ! FOUT bij {gem.get('slug')}: {e}")
                resultaten.append({"slug": gem.get("slug"), "resultaat": "fout", "error": str(e)[:200]})
                if commit and db is not None and not gem.get("_adhoc"):
                    try:
                        db.insert_check(gem["slug"], "fout", 0, 0, None, str(e)[:500])
                        db.conn.commit()
                    except Exception:  # noqa: BLE001
                        db.conn.rollback()
            time.sleep(0.5)  # beleefd

    log("Klaar.")
    return {
        "gemeenten": len(gemeenten),
        "relevant": sum(r.get("relevant", 0) for r in resultaten),
        "resultaten": resultaten,
    }


def main() -> int:
    # Windows-console (cp1252) verslikt zich in ✓/» → forceer UTF-8 met replace,
    # zodat een lokale dry-run niet spuriously op een print faalt. No-op op Linux.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # pragma: no cover
        pass
    ap = argparse.ArgumentParser(description="OpEigenErf VHP-readiness-poller (SRU)")
    ap.add_argument("--commit", action="store_true", help="schrijf naar Supabase (anders dry-run)")
    ap.add_argument("--gemeente", metavar="SLUG", help="alleen deze gemeente")
    ap.add_argument("--limit", type=int, default=50, help="max. treffers per gemeente (default 50)")
    ap.add_argument("--sinds", metavar="YYYY-MM-DD", help="cursor overschrijven (backfill bij onboarding)")
    args = ap.parse_args()
    try:
        run(commit=args.commit, gemeente=args.gemeente, sinds=args.sinds, limit=args.limit)
        return 0
    except Exception as e:  # noqa: BLE001
        log(f"! {e}")
        return 2


if __name__ == "__main__":
    sys.exit(main())
