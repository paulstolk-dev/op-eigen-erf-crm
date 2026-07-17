#!/usr/bin/env python3
"""
omgevingsplan_poller.py — signaleert wijzigingen in de vergunningvrij-regels
(bruidsschat, hoofdstuk 22, art. 22.27 / 22.36) van gemeentelijke omgevingsplannen.

Bron: SRU 2.0 van Overheid.nl over de officiële publicaties (Gemeenteblad).
Gratis, geen API-key. De poller PUBLICEERT NOOIT; hij signaleert: bij een relevante
treffer schrijft hij een rij naar `gemeente_wijzigingen` en pingt het notificatie-
endpoint (werkopdracht per mail). Een mens verwerkt de inhoud.

Draaien (dry-run is default — schrijft niets):
    python omgevingsplan_poller.py --gemeente arnhem --sinds 2026-01-01
    python omgevingsplan_poller.py --commit                 # alle onderzochte gemeenten
    python omgevingsplan_poller.py --gemeente zaanstad --commit --limit 20

Env: SUPABASE_DB_URL (psycopg). Optioneel voor notificatie: NOTIFY_ENDPOINT + NOTIFY_SECRET.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import date, datetime, timedelta, timezone
from xml.etree import ElementTree as ET

import httpx

try:
    import psycopg
    from psycopg.rows import dict_row
    from psycopg.types.json import Jsonb
except Exception:  # pragma: no cover
    psycopg = None

# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
SRU_ENDPOINT = "https://repository.overheid.nl/sru"
REPO_BASE = "https://repository.overheid.nl/frbr/officielepublicaties"
USER_AGENT = (
    "OpEigenErfOmgevingsplanBot/1.0 "
    "(+https://opeigenerf.nl; monitoring omgevingsplan-wijzigingen; contact: info@opeigenerf.nl)"
)
TIMEOUT = 30.0
CURSOR_FALLBACK_DAGEN = 90
# Alleen mailen bij hoge zekerheid; 'indicatie'-signalen wél wegschrijven (zichtbaar
# in /regelgeving), niet mailen. Zet NOTIFY_ALLEEN_HOOG=0 om over alles te mailen.
NOTIFY_ALLEEN_HOOG = os.environ.get("NOTIFY_ALLEEN_HOOG", "1") not in ("0", "false", "False")

# Signaalwoorden voor de vergunningvrij-regels. 22.27/22.36 met woordgrens + punt,
# zodat gemeentelijke plannaamgeving als "TAM-Omgevingsplan 22h" GEEN valse hit geeft.
RE_2236 = re.compile(r"\b22\.36\b")
RE_2227 = re.compile(r"\b22\.27\b")
RE_HFST22 = re.compile(r"hoofdstuk\s*22\b", re.I)
CONTEXT_WOORDEN = re.compile(
    r"bruidsschat|bijbehorend(?:e)? bouwwerk|achtererfgebied|vergunningvrij", re.I
)
RE_INTREKKEN = re.compile(
    r"(ingetrokken|komt te verval|vervalt|wordt geschrapt|wordt verwijderd)", re.I
)


def log(msg: str) -> None:
    print(msg, flush=True)


# --------------------------------------------------------------------------- #
# SRU
# --------------------------------------------------------------------------- #
def build_query(gemeentenaam: str, sinds: str) -> str:
    """CQL: Gemeenteblad + deze gemeente + sinds-datum + omgevingsplan/bruidsschat."""
    return (
        f'w.publicatienaam=="Gemeenteblad" '
        f'and w.gemeentenaam=="{gemeentenaam}" '
        f'and dt.date >= "{sinds}" '
        f'and (dt.title all "omgevingsplan" or dt.title all "bruidsschat") '
        f"sortBy dt.date/sort.descending"
    )


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _find_text(el: ET.Element, localname: str) -> str | None:
    for c in el.iter():
        if _local(c.tag) == localname and (c.text or "").strip():
            return c.text.strip()
    return None


def sru_search(client: httpx.Client, gemeentenaam: str, sinds: str, limit: int) -> tuple[int, list[dict]]:
    """Geeft (totaal_aantal, records). Elke record: id/titel/datum/creator/urls/mededelingOver."""
    params = {
        "operation": "searchRetrieve",
        "version": "2.0",
        "httpAccept": "application/xml",
        "maximumRecords": str(min(limit, 100)),
        "query": build_query(gemeentenaam, sinds),
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
        item_urls: dict[str, str] = {}
        preferred = None
        for u in rec.iter():
            ln = _local(u.tag)
            if ln == "itemUrl":
                man = u.attrib.get("manifestation") or ""
                if u.text:
                    item_urls[man] = u.text.strip()
            elif ln == "preferredUrl" and u.text:
                preferred = u.text.strip()
        records.append(
            {
                "id": _find_text(rec, "identifier"),
                "titel": _find_text(rec, "title") or "",
                "datum": _find_text(rec, "date"),
                "gemeentenaam": _find_text(rec, "gemeentenaam"),
                "mededeling_over": _find_text(rec, "mededelingOver"),
                "item_urls": item_urls,
                "bron_url": preferred,
            }
        )
    return total, records


def _get_with_retry(client: httpx.Client, url: str, params: dict | None = None, tries: int = 4) -> httpx.Response:
    """GET met exponentiële backoff op 429/5xx. Beleefd bevragen."""
    delay = 1.5
    last: Exception | None = None
    for attempt in range(tries):
        try:
            resp = client.get(url, params=params)
            if resp.status_code in (429, 500, 502, 503, 504):
                raise httpx.HTTPStatusError("retryable", request=resp.request, response=resp)
            resp.raise_for_status()
            return resp
        except Exception as e:  # noqa: BLE001
            last = e
            if attempt < tries - 1:
                time.sleep(delay)
                delay *= 2
    raise last  # type: ignore[misc]


# --------------------------------------------------------------------------- #
# Besluit-id, document ophalen
# --------------------------------------------------------------------------- #
GMB_RE = re.compile(r"(gmb-\d{4}-\d+)")
AKN_GAZETTE_RE = re.compile(r"/gmb/(\d{4})/(\d+)")


def besluit_id(rec: dict) -> str | None:
    """Een kennisgeving (mededelingOver) mapt op het onderliggende besluit, zodat
    aankondiging + besluit dezelfde dedupe-sleutel krijgen."""
    mo = rec.get("mededeling_over")
    if mo:
        m = AKN_GAZETTE_RE.search(mo)
        if m:
            return f"gmb-{m.group(1)}-{m.group(2)}"
    return rec.get("id")


def doc_xml_url(pub_id: str) -> str | None:
    m = re.match(r"gmb-(\d{4})-\d+", pub_id or "")
    if not m:
        return None
    return f"{REPO_BASE}/gmb/{m.group(1)}/{pub_id}/1/xml/{pub_id}.xml"


def metadata_owms_url(pub_id: str) -> str | None:
    m = re.match(r"gmb-(\d{4})-\d+", pub_id or "")
    if not m:
        return None
    return f"{REPO_BASE}/gmb/{m.group(1)}/{pub_id}/1/metadataowms/metadata_owms.xml"


def strip_tags(xml_bytes: bytes) -> str:
    try:
        root = ET.fromstring(xml_bytes)
        return " ".join(t.strip() for t in root.itertext() if t and t.strip())
    except ET.ParseError:
        return re.sub(r"<[^>]+>", " ", xml_bytes.decode("utf-8", "replace"))


# --------------------------------------------------------------------------- #
# Relevantie + type (puur functioneel — getest)
# --------------------------------------------------------------------------- #
RE_VERGVRIJ = re.compile(r"vergunningvrij", re.I)
RE_ARTNUM = re.compile(r"\b\d{1,3}\.\d{1,3}\b")

# Brede signaalwoorden (recall). Voor de matchlijst in delta/mail én voor de
# 'indicatie'-trigger op artikel-opschriften.
SIGNAAL = {
    "bijbehorend bouwwerk": re.compile(r"bijbehorend(?:e)?\s+bouwwerk", re.I),
    "achtererf": re.compile(r"achtererf", re.I),
    "vergunningvrij": re.compile(r"vergunningvrij", re.I),
    "bruidsschat": re.compile(r"bruidsschat", re.I),
    "mantelzorg": re.compile(r"mantelzorg", re.I),
    "erf-/perceelafscheiding": re.compile(r"erf-?\s*of\s*perceelafscheiding|erfafscheiding", re.I),
}
# Rule-onderwerp in een artikel-opschrift (recall-trigger, nummer-onafhankelijk).
RE_BREED_OPSCHRIFT = re.compile(
    r"bijbehorend(?:e)?\s+bouwwerk|achtererf|mantelzorg|erf-?\s*of\s*perceelafscheiding", re.I
)
# Sluit locatie-vergunningplicht-artikelen uit (dat zijn geen vergunningvrij-regels).
RE_UITSLUIT_OPSCHRIFT = re.compile(r"vergunningplicht|beoordelingsregel", re.I)


def _to_bytes(doc) -> bytes:
    return doc if isinstance(doc, (bytes, bytearray)) else str(doc).encode("utf-8")


def _join_art(nums) -> str | None:
    seen: list[str] = []
    for n in nums:
        if n and n not in seen:
            seen.append(n)
    return ", ".join(seen[:4]) if seen else None


def _artikelen(doc) -> list[tuple[str | None, str]]:
    """(nummer, opschrift) per Artikel-element in de STOP-XML."""
    try:
        root = ET.fromstring(_to_bytes(doc))
    except ET.ParseError:
        return []
    out: list[tuple[str | None, str]] = []
    for el in root.iter():
        if _local(el.tag) != "Artikel":
            continue
        opschrift = nummer = None
        for c in el.iter():
            ln = _local(c.tag)
            if ln == "Nummer" and nummer is None and (c.text or "").strip():
                nummer = c.text.strip()
            if ln in ("Opschrift", "Kop") and opschrift is None and (c.text or "").strip():
                opschrift = c.text.strip()
        num = None
        if nummer and RE_ARTNUM.search(nummer):
            num = RE_ARTNUM.search(nummer).group(0)
        else:
            m = RE_ARTNUM.search(" ".join(t for t in el.itertext() if t))
            num = m.group(0) if m else None
        out.append((num, opschrift or ""))
    return out


def vergunningvrij_artikel(doc) -> str | None:
    """Nummer van het (voorkeurs)artikel met 'vergunningvrij' in het opschrift, of None.
    Voorkeur voor het artikel over *bijbehorende bouwwerken* (onze mantelzorg-case)."""
    arts = _artikelen(doc)
    vv_bij = [n for (n, op) in arts if n and RE_VERGVRIJ.search(op) and re.search(r"bijbehorend", op, re.I)]
    vv_all = [n for (n, op) in arts if n and RE_VERGVRIJ.search(op)]
    picked = vv_bij or vv_all
    return picked[0] if picked else None


# STOP per-artikel-mutatie-elementen. Staat een artikel hieronder, dan wordt het
# écht gewijzigd (renvooi). NIET 'VervangRegeling' (dat vervangt de hele regeling =
# herpublicatie; individuele artikelen zijn dan niet als gewijzigd gemarkeerd).
PER_ARTIKEL_MUTATIE = {"Vervang", "VoegToe", "VoegToeArtikel", "Verwijder", "VervangKop",
                       "WijzigArtikel", "WijzigArtikelen"}
_STOP_STOP = {"BesluitCompact", "OfficielePublicatie", "VervangRegeling"}


def _artikelen_met_scope(doc) -> list[tuple[str | None, str, bool]]:
    """(nummer, opschrift, gewijzigd) per Artikel. gewijzigd=True als het artikel
    onder een per-artikel-mutatie (Vervang/WijzigArtikel/…) staat — dus écht wordt
    gewijzigd, niet slechts aanwezig is in een geconsolideerde/herpublicatie-tekst."""
    try:
        root = ET.fromstring(_to_bytes(doc))
    except ET.ParseError:
        return []
    parent = {c: p for p in root.iter() for c in p}
    out: list[tuple[str | None, str, bool]] = []
    for el in root.iter():
        if _local(el.tag) != "Artikel":
            continue
        opschrift = nummer = None
        for c in el.iter():
            ln = _local(c.tag)
            if ln == "Nummer" and nummer is None and (c.text or "").strip():
                nummer = c.text.strip()
            if ln in ("Opschrift", "Kop") and opschrift is None and (c.text or "").strip():
                opschrift = c.text.strip()
        num = None
        if nummer and RE_ARTNUM.search(nummer):
            num = RE_ARTNUM.search(nummer).group(0)
        else:
            m = RE_ARTNUM.search(" ".join(t for t in el.itertext() if t))
            num = m.group(0) if m else None
        gewijzigd = False
        cur = el
        while cur in parent:
            cur = parent[cur]
            lp = _local(cur.tag)
            if lp in PER_ARTIKEL_MUTATIE:
                gewijzigd = True
                break
            if lp in _STOP_STOP:
                break
        out.append((num, opschrift or "", gewijzigd))
    return out


def relevance(doc, titel: str = "") -> tuple[bool, str | None, str | None, list[str]]:
    """Raakt de publicatie de vergunningvrij-regels voor bijbehorende bouwwerken?
    Geeft (relevant, artikel, zekerheid, signalen) — hybride precisie + recall.

    Zekerheid:
    - 'hoog'      : een vergunningvrij-artikel wordt écht GEWIJZIGD (staat onder een
                    per-artikel-mutatie/renvooi), of 'bruidsschat' in de titel.
    - 'indicatie' : een vergunningvrij-artikel is wél aanwezig maar niet als gewijzigd
                    gemarkeerd (herpublicatie/VervangRegeling — bv. Groningen), een
                    gewijzigd artikel over bijbehorende bouwwerken/achtererf, of literal
                    22.27/22.36 in de tekst. Recall-vangnet; een mens weegt het.
    Locatieplannen die over vergunning*plicht* gaan of de bruidsschat alleen aanhalen
    bevatten zo'n regel-artikel niet → afgewezen."""
    plate = doc if isinstance(doc, str) else strip_tags(_to_bytes(doc))
    signalen = sorted(n for n, rx in SIGNAAL.items() if rx.search(plate) or rx.search(titel or ""))
    arts = _artikelen_met_scope(doc)

    vv = [(n, op, g) for (n, op, g) in arts if n and RE_VERGVRIJ.search(op)]
    if vv:
        vv_bij = [t for t in vv if re.search(r"bijbehorend", t[1], re.I)]
        gekozen = vv_bij or vv
        nums = _join_art([n for (n, _, _) in gekozen])
        zek = "hoog" if any(g for (_, _, g) in gekozen) else "indicatie"
        return True, nums, zek, signalen
    if re.search(r"bruidsschat", titel or "", re.I):
        return True, "hoofdstuk 22 (bruidsschat)", "hoog", signalen

    breed = [
        n for (n, op, _) in arts
        if RE_BREED_OPSCHRIFT.search(op) and not RE_UITSLUIT_OPSCHRIFT.search(op)
    ]
    if breed:
        return True, _join_art([n for n in breed if n]) or "bijbehorende bouwwerken", "indicatie", signalen
    if RE_2236.search(plate):
        return True, "22.36", "indicatie", signalen
    if RE_2227.search(plate):
        return True, "22.27", "indicatie", signalen
    return False, None, None, signalen


def _near(text: str, a_patterns: tuple[re.Pattern, ...], b_pattern: re.Pattern, window: int = 300) -> bool:
    """True als een van a_patterns binnen `window` tekens van b_pattern voorkomt."""
    b_pos = [m.start() for m in b_pattern.finditer(text)]
    if not b_pos:
        return False
    for ap in a_patterns:
        for m in ap.finditer(text):
            if any(abs(m.start() - bp) <= window for bp in b_pos):
                return True
    return False


def classify_type(titel: str, text: str, ontwerp_al_bekend: bool = False, artikel: str = "") -> str:
    """Map op de gemeente_wijziging-type-enum.

    `artikel_verdwenen` (sterkste signaal) als de vergunningvrij-regel niet meer op
    zijn oorspronkelijke plek (hfst 22) staat — d.w.z. verplaatst/vervangen (Utrecht
    → 4.27, Groningen → 32.36, …) — of als 22.27/22.36 expliciet wordt ingetrokken."""
    t = (titel or "").lower()
    is_ontwerp = "ontwerp" in t or "terinzage" in t or "ter inzage" in t
    # Vergunningvrij-regel buiten hfst 22 → oorspronkelijk artikel is verdwenen/verplaatst.
    nums = re.findall(r"\b(\d{1,3})\.\d{1,3}\b", artikel or "")
    buiten_hfst22 = bool(nums) and all(n != "22" for n in nums)
    if buiten_hfst22 or _near(text, (RE_2227, RE_2236), RE_INTREKKEN, window=300):
        return "artikel_verdwenen"
    if is_ontwerp:
        return "ontwerp_gewijzigd" if ontwerp_al_bekend else "ontwerp_nieuw"
    if re.search(r"wijziging|vaststelling|vastgesteld|veegbesluit|in beheer nemen", t):
        return "vastgesteld_gewijzigd"
    return "onbekend"


def extract_delta(xml_bytes: bytes, artikel: str | None) -> dict:
    """Bescheiden renvooi-extractie: wijzig-opschriften + tekstfragmenten rond de
    signaalwoorden. Bewust beperkt (guardrail: geen hele publicatie opslaan)."""
    fragmenten: list[str] = []
    try:
        root = ET.fromstring(xml_bytes)
        for el in root.iter():
            ln = _local(el.tag)
            if ln in ("Wat", "Opschrift", "Kop") and (el.text or "").strip():
                txt = el.text.strip()
                if CONTEXT_WOORDEN.search(txt) or RE_2227.search(txt) or RE_2236.search(txt) or "wijzig" in txt.lower():
                    fragmenten.append(txt[:400])
    except ET.ParseError:
        pass
    # Tekstcontext rond de signaalwoorden (max enkele fragmenten).
    plat = strip_tags(xml_bytes)
    for pat in (RE_2236, RE_2227, RE_HFST22):
        m = pat.search(plat)
        if m:
            s, e = max(0, m.start() - 160), min(len(plat), m.end() + 160)
            fragmenten.append("…" + plat[s:e].strip() + "…")
    # Dedupe + cap.
    uniek: list[str] = []
    for f in fragmenten:
        if f not in uniek:
            uniek.append(f)
        if len(uniek) >= 6:
            break
    return {"artikel": artikel, "fragmenten": uniek}


# --------------------------------------------------------------------------- #
# DB
# --------------------------------------------------------------------------- #
class DB:
    def __init__(self, dsn: str):
        if psycopg is None:
            raise SystemExit("psycopg ontbreekt: pip install 'psycopg[binary]'")
        self.conn = psycopg.connect(dsn, row_factory=dict_row, autocommit=False)

    def gemeenten_te_pollen(self, slug: str | None) -> list[dict]:
        with self.conn.cursor() as cur:
            if slug:
                cur.execute(
                    "select slug, naam, dso_laatst_gepolld, dso_ontwerp_aanwezig "
                    "from public.gemeenten where slug = %s",
                    (slug,),
                )
                row = cur.fetchone()
                if row:
                    return [row]
                # Ad-hoc (backfill/test) — nog niet in de tabel.
                return [{
                    "slug": slug, "naam": slug.replace("-", " ").title(),
                    "dso_laatst_gepolld": None, "dso_ontwerp_aanwezig": False, "_adhoc": True,
                }]
            cur.execute(
                "select slug, naam, dso_laatst_gepolld, dso_ontwerp_aanwezig "
                "from public.gemeenten where research_status <> 'niet_onderzocht' "
                "order by dso_laatst_gepolld asc nulls first"
            )
            return cur.fetchall()

    def insert_wijziging(self, payload: dict) -> str | None:
        cols = list(payload.keys())
        ph = ", ".join(["%s"] * len(cols))
        sql = (
            f"insert into public.gemeente_wijzigingen ({', '.join(cols)}) values ({ph}) "
            f"on conflict (gemeente_slug, artikel, nieuwe_hash) do nothing returning id"
        )
        with self.conn.cursor() as cur:
            cur.execute(sql, [payload[c] for c in cols])
            row = cur.fetchone()
            return str(row["id"]) if row else None

    def update_gemeente_cursor(self, slug: str, ontwerp: bool, akn: str | None) -> None:
        with self.conn.cursor() as cur:
            cur.execute(
                "update public.gemeenten set dso_laatst_gepolld = now(), "
                "dso_ontwerp_aanwezig = %s, "
                "dso_regeling_identificatie = coalesce(%s, dso_regeling_identificatie) "
                "where slug = %s",
                (ontwerp, akn, slug),
            )

    def insert_check(self, slug: str, resultaat: str, treffers: int, relevant: int,
                     ruwe: str | None, fout: str | None) -> None:
        with self.conn.cursor() as cur:
            cur.execute(
                "insert into public.gemeente_checks "
                "(gemeente_slug, resultaat, aantal_treffers, aantal_relevant, ruwe_respons, foutmelding) "
                "values (%s,%s,%s,%s,%s,%s)",
                (slug, resultaat, treffers, relevant, (ruwe or "")[:4000], fout),
            )


# --------------------------------------------------------------------------- #
# Notificatie (poller → Next.js endpoint → Resend)
# --------------------------------------------------------------------------- #
def notify(client: httpx.Client, wijziging: dict) -> None:
    endpoint = os.environ.get("NOTIFY_ENDPOINT")
    secret = os.environ.get("NOTIFY_SECRET")
    if not endpoint or not secret:
        log("    (notificatie overgeslagen — NOTIFY_ENDPOINT/NOTIFY_SECRET niet gezet)")
        return
    try:
        client.post(
            endpoint.rstrip("/"),
            headers={"x-notify-secret": secret, "Content-Type": "application/json"},
            json=wijziging,
            timeout=20.0,
        )
    except Exception as e:  # noqa: BLE001
        log(f"    ! notificatie mislukt: {e}")


# --------------------------------------------------------------------------- #
# Kern: één gemeente pollen
# --------------------------------------------------------------------------- #
def poll_gemeente(db: DB | None, http: httpx.Client, gem: dict, sinds: str,
                  limit: int, commit: bool) -> dict:
    slug, naam = gem["slug"], gem["naam"]
    ontwerp_al = bool(gem.get("dso_ontwerp_aanwezig"))
    log(f"» {naam} ({slug}) — sinds {sinds}")

    total, records = sru_search(http, naam, sinds, limit)
    log(f"  {total} treffer(s) (verwerk {len(records)})")

    # Dedupe kennisgeving+besluit naar het besluit-id.
    per_besluit: dict[str, dict] = {}
    for rec in records:
        bid = besluit_id(rec)
        if not bid:
            continue
        # Bewaar de record met de meeste info (besluit boven kennisgeving).
        keep = per_besluit.get(bid)
        if keep is None or (keep.get("mededeling_over") and not rec.get("mededeling_over")):
            per_besluit[bid] = {**rec, "besluit_id": bid}

    relevant_count = 0
    ontwerp_gezien = ontwerp_al
    laatste_akn: str | None = None
    fragment_log: list[str] = []

    for bid, rec in per_besluit.items():
        url = doc_xml_url(bid)
        if not url:
            continue
        try:
            doc = _get_with_retry(http, url)
        except Exception as e:  # noqa: BLE001
            log(f"    ! document ophalen mislukt {bid}: {e}")
            continue
        text = strip_tags(doc.content)
        # Relevantie op de XML zelf (artikel-opschriften), niet alleen platte tekst.
        is_rel, artikel, zekerheid, signalen = relevance(doc.content, rec.get("titel", ""))
        if not is_rel:
            continue
        relevant_count += 1
        wtype = classify_type(rec["titel"], text, ontwerp_gezien, artikel)
        # Ontwerp-vlag onafhankelijk van het type (artikel_verdwenen kan een ontwerp zijn).
        if re.search(r"ontwerp|ter\s*inzage", rec.get("titel", ""), re.I):
            ontwerp_gezien = True
        # AKN uit de owms-metadata (best-effort).
        akn = None
        murl = metadata_owms_url(bid)
        if murl:
            try:
                md = _get_with_retry(http, murl)
                akn = _find_text(ET.fromstring(md.content), "betreftRegeling")
            except Exception:  # noqa: BLE001
                pass
        laatste_akn = akn or laatste_akn
        delta = extract_delta(doc.content, artikel)
        delta["zekerheid"] = zekerheid
        delta["signalen"] = signalen
        fragment_log.append(f"{bid} [{wtype}/{zekerheid}] art {artikel} ({', '.join(signalen)}): {rec['titel'][:70]}")

        payload = {
            "gemeente_slug": slug,
            "artikel": artikel,
            "type": wtype,
            "nieuwe_hash": bid,
            "delta": Jsonb(delta) if (commit and psycopg) else delta,
            "bron_url": rec.get("bron_url") or f"https://zoek.officielebekendmakingen.nl/{bid}.html",
        }
        log(f"    ✓ RELEVANT {bid} → art {artikel} · {wtype} · {zekerheid} · {', '.join(signalen)}")
        if commit and db is not None:
            new_id = db.insert_wijziging(payload)
            if new_id:
                if not NOTIFY_ALLEEN_HOOG or zekerheid == "hoog":
                    notify(http, {
                        "gemeente": naam, "type": wtype, "artikel": artikel,
                        "bron_url": payload["bron_url"], "id": new_id, "signalen": signalen,
                    })
                    log(f"      ↑ nieuw ({new_id}) + genotificeerd")
                else:
                    log(f"      ↑ nieuw ({new_id}) — opgeslagen, geen mail (zekerheid={zekerheid})")
            else:
                log("      = bestond al (on conflict do nothing)")

    resultaat = "geen_treffers" if relevant_count == 0 else "ok"
    if commit and db is not None and not gem.get("_adhoc"):
        db.update_gemeente_cursor(slug, ontwerp_gezien, laatste_akn)
        db.insert_check(slug, resultaat, total, relevant_count,
                        "\n".join(fragment_log), None)
        db.conn.commit()
    return {"slug": slug, "treffers": total, "relevant": relevant_count, "resultaat": resultaat}


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def default_sinds() -> str:
    return (date.today() - timedelta(days=CURSOR_FALLBACK_DAGEN)).isoformat()


def cursor_sinds(gem: dict, override: str | None) -> str:
    if override:
        return override
    laatst = gem.get("dso_laatst_gepolld")
    if isinstance(laatst, datetime):
        return laatst.date().isoformat()
    return default_sinds()


def run(commit: bool = False, gemeente: str | None = None,
        sinds: str | None = None, limit: int = 50) -> dict:
    """Draai de poller (herbruikbaar vanuit CLI én de HTTP-trigger). Geeft een
    samenvatting terug. Gooit RuntimeError alleen bij een structurele fout."""
    if not commit:
        log("== DRY-RUN (schrijft niets; gebruik commit=True om weg te schrijven) ==")

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
                log(f"  ! FOUT bij {gem['slug']}: {e}")
                resultaten.append({"slug": gem.get("slug"), "resultaat": "fout", "error": str(e)[:200]})
                if commit and db is not None and not gem.get("_adhoc"):
                    try:
                        db.insert_check(gem["slug"], "fout", 0, 0, None, str(e)[:500])
                        db.conn.commit()
                    except Exception:  # noqa: BLE001
                        db.conn.rollback()
            time.sleep(0.5)  # beleefd: lage frequentie

    log("Klaar.")
    return {
        "gemeenten": len(gemeenten),
        "relevant": sum(r.get("relevant", 0) for r in resultaten),
        "resultaten": resultaten,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="OpEigenErf omgevingsplan-poller (SRU)")
    ap.add_argument("--commit", action="store_true", help="schrijf naar Supabase (anders dry-run)")
    ap.add_argument("--gemeente", metavar="SLUG", help="alleen deze gemeente")
    ap.add_argument("--limit", type=int, default=50, help="max. treffers per gemeente (default 50)")
    ap.add_argument("--sinds", metavar="YYYY-MM-DD", help="cursor overschrijven (backfill)")
    args = ap.parse_args()
    try:
        run(commit=args.commit, gemeente=args.gemeente, sinds=args.sinds, limit=args.limit)
        return 0
    except Exception as e:  # noqa: BLE001
        log(f"! {e}")
        return 2


if __name__ == "__main__":
    sys.exit(main())
