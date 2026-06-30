"""
api/erfscan.py  —  Vercel Python Function (OpEigenErf Erf Check engine)
=======================================================================
POST /api/erfscan   body: {"lead_id": "<uuid>", "secret": "<ERFSCAN_SECRET>"}

Draait Tier 1 (gratis, geen sleutel) direct; Tier 2 (BAG) zodra BAG_API_KEY
gezet is. Schrijft het dossier + status terug naar public.erfscans via de
Supabase service-role key, en de luchtfoto naar de Storage-bucket 'erfscans'.

Mens-in-de-lus blijft leidend: de engine vult Tier 1/2 en zet status
'needs_review'. Het juridische eindoordeel + verzending gebeuren in de CRM.
"""

from __future__ import annotations

import os
import json
import datetime as dt
from http.server import BaseHTTPRequestHandler
from typing import Optional

import requests
from shapely.geometry import shape, Point

# --------------------------------------------------------------------------- #
# CONFIG
# --------------------------------------------------------------------------- #
PDOK_LOCATIESERVER = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free"
PDOK_KADASTER_WFS = "https://service.pdok.nl/kadaster/kadastralekaart/wfs/v5_0"
PDOK_LUCHTFOTO_WMS = "https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0"

BAG_API_BASE = "https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2"
BAG_API_KEY = os.environ.get("BAG_API_KEY", "")  # Tier 2 — gratis bij Kadaster

# Tier 2 — open bronnen voor automatische Tier-3 suggesties (geen sleutel)
RCE_WFS = "https://services.rce.geovoorziening.nl/rce/wfs"  # rijksmonumenten + gezichten
CBS_KERNEN_WFS = "https://service.pdok.nl/cbs/bevolkingskernen/2011/wfs/v1_0"

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ERFSCAN_SECRET = os.environ.get("ERFSCAN_SECRET", "")

UA = {"User-Agent": "OpEigenErf-Erfscan/1.0 (+https://www.opeigenerf.nl)"}
TIMEOUT = 20


# --------------------------------------------------------------------------- #
# SUPABASE REST HELPERS (service role — bypasses RLS)
# --------------------------------------------------------------------------- #
def _sb_headers(extra: Optional[dict] = None) -> dict:
    h = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def sb_get_lead(lead_id: str) -> dict:
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/leads",
        params={"id": f"eq.{lead_id}", "select": "*"},
        headers=_sb_headers({"Accept": "application/json"}),
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    rows = r.json()
    if not rows:
        raise ValueError(f"Lead {lead_id} niet gevonden")
    return rows[0]


def sb_upsert_erfscan(lead_id: str, fields: dict) -> None:
    """Upsert op unieke lead_id (merge-duplicates)."""
    body = {"lead_id": lead_id, **fields}
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/erfscans",
        params={"on_conflict": "lead_id"},
        headers=_sb_headers(
            {"Prefer": "resolution=merge-duplicates,return=minimal"}
        ),
        data=json.dumps(body),
        timeout=TIMEOUT,
    )
    r.raise_for_status()


def sb_upload_luchtfoto(lead_id: str, img_bytes: bytes) -> str:
    # Sniff magic bytes: PDOK WMS levert hier JPEG; val terug op png indien nodig.
    is_png = img_bytes[:4] == bytes([0x89, 0x50, 0x4E, 0x47])
    ext, ctype = ("png", "image/png") if is_png else ("jpg", "image/jpeg")
    path = f"{lead_id}/luchtfoto.{ext}"
    r = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/erfscans/{path}",
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": ctype,
            "x-upsert": "true",
        },
        data=img_bytes,
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return path


# --------------------------------------------------------------------------- #
# TIER 1 — GEOCODE
# --------------------------------------------------------------------------- #
def _parse_point(wkt: Optional[str]):
    if not wkt or "POINT" not in wkt:
        return None
    inside = wkt.split("(")[1].split(")")[0].strip()
    x, y = inside.split()
    return float(x), float(y)


def geocode(postcode: str, huisnummer: str, toevoeging: str = "") -> dict:
    """
    Exacte match op postcode + huisnummer (fq-filters), niet de losse vrije-tekst
    'q' — die pakte anders stil een verkeerd huis (bv. 1697KG 49 → Dorpsweg 107A).
    Gooit een fout als er geen exact adres bestaat (bv. postcode/huisnummer-typo).
    """
    pc = (postcode or "").replace(" ", "").upper()
    hn = str(huisnummer or "").strip()
    num = "".join(ch for ch in hn if ch.isdigit())
    hn_letter = "".join(ch for ch in hn if ch.isalpha())
    toev = (toevoeging or hn_letter or "").strip().upper()

    fq = ["type:adres"]
    if pc:
        fq.append(f"postcode:{pc}")
    if num:
        fq.append(f"huisnummer:{num}")

    r = requests.get(
        PDOK_LOCATIESERVER,
        params={"q": "*", "fq": fq, "rows": 25, "fl": "*"},
        headers=UA,
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    docs = r.json().get("response", {}).get("docs", [])
    if not docs:
        raise ValueError(
            f"Geen exact adres voor postcode {pc} huisnummer {num or hn} "
            f"— controleer postcode/huisnummer in de lead."
        )

    # Beste match op toevoeging/huisletter: exacte toevoeging eerst, anders het
    # 'kale' huisnummer zonder toevoeging, anders de eerste.
    def rank(d: dict) -> int:
        cand = ((d.get("huisletter") or "") + (d.get("huisnummertoevoeging") or "")).upper()
        if toev:
            return 0 if cand == toev else 2
        return 0 if not cand else 1

    d = sorted(docs, key=rank)[0]
    rd = _parse_point(d.get("centroide_rd"))
    ll = _parse_point(d.get("centroide_ll"))
    return {
        "weergavenaam": d.get("weergavenaam"),
        "straat": d.get("straatnaam"),
        "huisnummer": d.get("huis_nlt") or d.get("huisnummer"),
        "postcode": d.get("postcode"),
        "woonplaats": d.get("woonplaatsnaam"),
        "gemeente": d.get("gemeentenaam"),
        "provincie": d.get("provincienaam"),
        "rd_x": rd[0] if rd else None,
        "rd_y": rd[1] if rd else None,
        "lon": ll[0] if ll else None,
        "lat": ll[1] if ll else None,
        "adresseerbaarobject_id": d.get("adresseerbaarobject_id"),
        "nummeraanduiding_id": d.get("nummeraanduiding_id"),
        "pand_ids": d.get("pandid") or [],
        "perceel_codes": d.get("gekoppeld_perceel") or [],
    }


# --------------------------------------------------------------------------- #
# TIER 1 — PERCEEL (WFS via POST + XML filter; robuuster dan filter-in-GET)
# --------------------------------------------------------------------------- #
def get_perceel(rd_x: float, rd_y: float, half: float = 1.0) -> dict:
    """
    Perceel onder het adrespunt (RD/EPSG:28992). PDOK's WFS negeert cql_filter,
    dus we vragen een kleine BBOX op rond het punt en kiezen het perceel dat het
    punt daadwerkelijk bevat (shapely 'contains').
    """
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": "kadastralekaart:Perceel",
        "outputFormat": "application/json",
        "srsName": "EPSG:28992",
        "count": 50,
        "bbox": f"{rd_x-half},{rd_y-half},{rd_x+half},{rd_y+half},urn:ogc:def:crs:EPSG::28992",
    }
    r = requests.get(PDOK_KADASTER_WFS, params=params, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    feats = r.json().get("features", [])
    if not feats:
        return {"status": "n.b.", "note": "perceel niet gevonden via WFS"}
    pt = Point(rd_x, rd_y)
    f = next((ft for ft in feats if shape(ft["geometry"]).contains(pt)), feats[0])
    geom = shape(f["geometry"])
    props = f["properties"]
    aanduiding = " ".join(
        str(p)
        for p in [
            props.get("kadastraleGemeenteWaarde"),
            props.get("sectie"),
            props.get("perceelnummer"),
        ]
        if p
    )
    return {
        "kadastrale_aanduiding": aanduiding or props.get("identificatieLokaalID"),
        "kadastrale_gemeente": props.get("kadastraleGemeenteWaarde"),
        "sectie": props.get("sectie"),
        "perceelnummer": props.get("perceelnummer"),
        "oppervlakte_m2": props.get("kadastraleGrootteWaarde") or round(geom.area),
        "geometry": f["geometry"],
        "status": "ok",
    }


# --------------------------------------------------------------------------- #
# TIER 1 — LUCHTFOTO (PNG bytes)
# --------------------------------------------------------------------------- #
def fetch_luchtfoto_bytes(rd_x: float, rd_y: float, half=40) -> bytes:
    bbox = f"{rd_x-half},{rd_y-half},{rd_x+half},{rd_y+half}"
    r = requests.get(
        PDOK_LUCHTFOTO_WMS,
        params={
            "service": "WMS",
            "version": "1.3.0",
            "request": "GetMap",
            "layers": "Actueel_orthoHR",
            "crs": "EPSG:28992",
            "bbox": bbox,
            "width": 800,
            "height": 800,
            "format": "image/jpeg",
        },
        headers=UA,
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return r.content


# --------------------------------------------------------------------------- #
# TIER 1 — VERGUNNINGVRIJ STAFFEL (rekenformule, identiek aan geteste kern)
# --------------------------------------------------------------------------- #
def max_oppervlak_bijbehorende_bouwwerken(bebouwingsgebied_m2: float, cap: float = 100.0) -> float:
    b = bebouwingsgebied_m2
    if b <= 100:
        opp = 0.5 * b
    elif b <= 300:
        opp = 50 + 0.2 * (b - 100)
    else:
        opp = 90 + 0.1 * (b - 300)
    return round(min(opp, cap), 1)


def estimate_achtererf(perceel_geom_json: dict, pand_geom_json: Optional[dict]) -> dict:
    perceel = shape(perceel_geom_json)
    result = {"status": "INDICATIE - handmatig verifiëren"}
    if not pand_geom_json:
        result["perceel_m2"] = round(perceel.area)
        result["bebouwingsgebied_m2"] = "n.b. (pand-footprint ontbreekt)"
        return result
    pand = shape(pand_geom_json)
    footprint = round(pand.area)
    rest = max(perceel.area - pand.area, 0)
    achtererf_proxy = round(rest * 0.5)
    bebouwingsgebied = achtererf_proxy + footprint
    result.update(
        {
            "footprint_hoofdgebouw_m2": footprint,
            "achtererf_proxy_m2": achtererf_proxy,
            "bebouwingsgebied_m2": bebouwingsgebied,
            "max_vergunningvrij_m2": max_oppervlak_bijbehorende_bouwwerken(bebouwingsgebied),
        }
    )
    return result


# --------------------------------------------------------------------------- #
# TIER 2 — BAG (vereist BAG_API_KEY)
# --------------------------------------------------------------------------- #
def get_bag_pand(pand_id: str) -> dict:
    if not BAG_API_KEY:
        return {"status": "n.b.", "note": "BAG_API_KEY niet gezet (TIER 2)"}
    r = requests.get(
        f"{BAG_API_BASE}/panden/{pand_id}",
        headers={**UA, "X-Api-Key": BAG_API_KEY, "Accept": "application/hal+json", "Accept-Crs": "epsg:28992"},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    p = r.json().get("pand", {})
    return {
        "bouwjaar": p.get("oorspronkelijkBouwjaar"),
        "status_pand": p.get("status"),
        "geometry": p.get("geometrie"),
        "status": "ok",
    }


# --------------------------------------------------------------------------- #
# TIER 2 — ERFGOED & BEBOUWDE KOM  (open WFS, geen sleutel)
# Levert automatische SUGGESTIES voor de Tier-3 checklist. De mens bevestigt.
# --------------------------------------------------------------------------- #
def _wfs_features(url: str, type_name: str, rd_x: float, rd_y: float, half: float, count: int = 20):
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": type_name,
        "outputFormat": "application/json",
        "srsName": "EPSG:28992",
        "count": count,
        "bbox": f"{rd_x-half},{rd_y-half},{rd_x+half},{rd_y+half},urn:ogc:def:crs:EPSG::28992",
    }
    r = requests.get(url, params=params, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json().get("features", [])


def check_erfgoed(rd_x: float, rd_y: float) -> dict:
    """Rijksmonument / beschermd stads-/dorpsgezicht / werelderfgoed (RCE)."""
    out: dict = {"rijksmonument": False, "beschermd_gezicht": False, "werelderfgoed": False}
    pt = Point(rd_x, rd_y)
    try:
        pts = _wfs_features(RCE_WFS, "rce:NationalListedMonumentPoints", rd_x, rd_y, 12)
        polys = _wfs_features(RCE_WFS, "rce:NationalListedMonumentPolygons", rd_x, rd_y, 12)
        near_pt = [f for f in pts if shape(f["geometry"]).distance(pt) <= 10]
        in_poly = [f for f in polys if shape(f["geometry"]).contains(pt)]
        if near_pt or in_poly:
            out["rijksmonument"] = True
            props = (near_pt or in_poly)[0]["properties"]
            out["rijksmonument_detail"] = (
                props.get("aard_monument") or props.get("hoofdcategorie") or "rijksmonument"
            )
            out["rijksmonument_url"] = props.get("rijksmonumenturl")

        town = _wfs_features(RCE_WFS, "rce:Townscapes", rd_x, rd_y, 3)
        in_town = [f for f in town if shape(f["geometry"]).contains(pt)]
        if in_town:
            out["beschermd_gezicht"] = True
            out["gezicht_naam"] = in_town[0]["properties"].get("NAAM")

        wh = _wfs_features(RCE_WFS, "rce:WorldHeritage", rd_x, rd_y, 3)
        in_wh = [f for f in wh if shape(f["geometry"]).contains(pt)]
        if in_wh:
            out["werelderfgoed"] = True
            out["werelderfgoed_naam"] = in_wh[0]["properties"].get("NAAM")
    except Exception as e:
        out["error"] = str(e)
    return out


def indicatie_bebouwde_kom(rd_x: float, rd_y: float) -> Optional[str]:
    """Indicatie binnen/buiten bebouwde kom via CBS bevolkingskernen (proxy)."""
    try:
        pt = Point(rd_x, rd_y)
        feats = _wfs_features(
            CBS_KERNEN_WFS, "bevolkingskernen:cbsbevolkingskernen2011", rd_x, rd_y, 2
        )
        binnen = any(shape(f["geometry"]).contains(pt) for f in feats)
        return "binnen" if binnen else "buiten"
    except Exception:
        return None


def build_tier3_suggesties(loc: dict, ruimtelijk: dict) -> dict:
    """Stelt per Tier-3 item een suggestie samen: waarde + zekerheid + bron.
    zekerheid: 'hoog' (bron-zeker) | 'indicatie' | 'handmatig' | 'klant'."""
    sug: dict = {}

    # Beschermd dorpsgezicht / monument (RCE — hoog, alleen rijksniveau)
    erf = check_erfgoed(loc["rd_x"], loc["rd_y"]) if loc.get("rd_x") else {}
    is_erfgoed = bool(
        erf.get("rijksmonument") or erf.get("beschermd_gezicht") or erf.get("werelderfgoed")
    )
    detail_parts = []
    if erf.get("rijksmonument"):
        detail_parts.append(f"rijksmonument ({erf.get('rijksmonument_detail')})")
    if erf.get("beschermd_gezicht"):
        detail_parts.append(f"beschermd gezicht ({erf.get('gezicht_naam')})")
    if erf.get("werelderfgoed"):
        detail_parts.append(f"werelderfgoed ({erf.get('werelderfgoed_naam')})")
    sug["beschermd_dorpsgezicht"] = {
        "waarde": "ja" if is_erfgoed else "nee",
        "zekerheid": "handmatig" if erf.get("error") else "hoog",
        "bron": "Rijksdienst Cultureel Erfgoed (rijksniveau)",
        "detail": "; ".join(detail_parts)
        or "Geen rijksmonument/gezicht op dit adres. Let op: gemeentelijke monumenten/gezichten apart checken.",
        "url": erf.get("rijksmonument_url")
        or "https://www.cultureelerfgoed.nl/onderwerpen/monumenten",
    }

    # Bebouwde kom (CBS — indicatie)
    kom = indicatie_bebouwde_kom(loc["rd_x"], loc["rd_y"]) if loc.get("rd_x") else None
    sug["bebouwde_kom"] = {
        "waarde": kom or "",
        "zekerheid": "indicatie" if kom else "handmatig",
        "bron": "CBS bevolkingskernen 2011 (proxy)",
        "detail": "Indicatie buiten de kom → max. 100 m² verplaatsbare voorziening."
        if kom == "buiten"
        else "Indicatie binnen de kom."
        if kom == "binnen"
        else "Niet bepaald — handmatig controleren.",
        "url": "",
    }

    # Vergunningvrij (eigen staffel — indicatie)
    maxm2 = ruimtelijk.get("max_vergunningvrij_m2")
    sug["vergunningcheck"] = {
        "waarde": "vergunningvrij",
        "zekerheid": "indicatie",
        "bron": "Eigen staffel (Bbl) + achtererf-indicatie",
        "detail": (
            f"Indicatie vergunningvrij tot ± {maxm2} m² (bijbehorend bouwwerk in achtererfgebied). "
            if maxm2
            else "Indicatie: bijbehorend bouwwerk in achtererfgebied vaak vergunningvrij; exacte m² na BAG-footprint. "
        )
        + "Bevestig via de officiële Vergunningcheck.",
        "url": "https://omgevingswet.overheid.nl/vergunningcheck/",
    }

    # Welstand — handmatig (geen landelijke laag)
    sug["welstand_principeverzoek"] = {
        "waarde": "",
        "zekerheid": "handmatig",
        "bron": "Gemeentelijke welstandsnota",
        "detail": "Geen landelijke bron — check de welstandsnota van de gemeente.",
        "url": loc.get("gemeente")
        and f"https://www.{(loc.get('gemeente') or '').lower().replace(' ', '')}.nl"
        or "",
    }

    # Zorgvraag — klant
    sug["zorgvraag"] = {
        "waarde": "",
        "zekerheid": "klant",
        "bron": "Klant",
        "detail": "Niet af te leiden uit data — vraag aan de klant (bepaalt mantelzorgroute).",
        "url": "",
    }
    return sug


# --------------------------------------------------------------------------- #
# DEEPLINKS (Tier 3 mens-in-de-lus)
# --------------------------------------------------------------------------- #
def deeplinks(loc: dict) -> dict:
    pc = (loc.get("postcode") or "").replace(" ", "")
    hn = loc.get("huisnummer") or ""
    return {
        "omgevingsloket_regels_op_de_kaart": "https://omgevingswet.overheid.nl/regels-op-de-kaart/",
        "omgevingsloket_vergunningcheck": "https://omgevingswet.overheid.nl/vergunningcheck/",
        "bag_viewer": f"https://bagviewer.kadaster.nl/lvbag/bag-viewer/?searchQuery={pc}%20{hn}",
        "iplo_stappenplan": "https://iplo.nl/thema/bouw/bouwen-vergunning-melding/bijbehorende-bouwwerken/stappenplan-bepaling-vergunningvrij-bouwen/",
        "ruimtelijkeplannen": "https://www.ruimtelijkeplannen.nl/",
        "gemeente": f"https://www.{(loc.get('gemeente') or '').lower().replace(' ', '')}.nl",
    }


# --------------------------------------------------------------------------- #
# ASSESSMENT (conservatief; conclusie lowercase voor de DB-check)
# --------------------------------------------------------------------------- #
def assess(lead: dict, perceel: dict) -> dict:
    flags, kansen = [], []

    if lead.get("audience") in ("ouders", "kinderen", "mantelzorg"):
        kansen.append(
            "Doelgroep = eerstegraads familie: past op mantelzorg- én "
            "(aankomende) familiewoningregeling."
        )
    opp = perceel.get("oppervlakte_m2")
    if isinstance(opp, (int, float)):
        if opp >= 500:
            kansen.append(f"Ruim perceel ({opp} m²): waarschijnlijk voldoende achtererf.")
        elif opp < 250:
            flags.append(f"Klein perceel ({opp} m²): achtererf mogelijk krap.")

    flags.append(
        "Controleer bebouwde kom vs. buitengebied: buiten de kom geldt max. 100 m² "
        "voor een verplaatsbare mantelzorgvoorziening."
    )
    flags.append(
        "Vergunningvrije fámiliewoning (zonder zorgvraag) hangt op het Besluit "
        "versterking regie volkshuisvesting — nog niet in werking. Mét "
        "mantelzorgrelatie is de mantelzorgroute nú al beschikbaar."
    )

    return {
        "conclusie": "oranje",  # conservatieve default; mens stelt definitief vast
        "flags": flags,
        "kansen": kansen,
        "advies": (
            "Op basis van deze eerste erfcheck lijkt het kansrijk, maar een "
            "betrouwbaar oordeel vraagt om perceelmeting, gemeentecheck en de "
            "actuele status van de familiewoningregeling."
        ),
    }


# --------------------------------------------------------------------------- #
# ORCHESTRATIE
# --------------------------------------------------------------------------- #
def run_erfscan(
    lead_id: str,
    postcode: Optional[str] = None,
    huisnummer: Optional[str] = None,
) -> dict:
    """postcode/huisnummer overschrijven de leadwaarden (handmatige adres-correctie
    bij een re-run). Schrijft uitsluitend naar public.erfscans, niet naar leads."""
    sb_upsert_erfscan(lead_id, {"status": "enriching", "error": None})
    try:
        lead = sb_get_lead(lead_id)
        pc = postcode or lead.get("postcode", "")
        hn = huisnummer if huisnummer is not None else lead.get("huisnummer", "")
        toev = lead.get("toevoeging", "") or ""
        dossier: dict = {
            "lead_id": lead_id,
            "gegenereerd": dt.datetime.now().isoformat(timespec="seconds"),
            "adres_invoer": {"postcode": pc, "huisnummer": hn, "toevoeging": toev},
            "locatie": {},
            "perceel": {},
            "bag": {},
            "ruimtelijk": {},
        }

        loc = geocode(pc, hn, toev)
        dossier["locatie"] = loc
        dossier["bronnen"] = deeplinks(loc)

        luchtfoto_path = None
        perceel = {}
        if loc.get("rd_x"):
            perceel = get_perceel(loc["rd_x"], loc["rd_y"])
            dossier["perceel"] = {k: v for k, v in perceel.items() if k != "geometry"}

            try:
                png = fetch_luchtfoto_bytes(loc["rd_x"], loc["rd_y"])
                luchtfoto_path = sb_upload_luchtfoto(lead_id, png)
            except Exception as e:  # luchtfoto is niet kritisch
                dossier.setdefault("flags", []).append(f"Luchtfoto mislukt: {e}")

            pand_geom = None
            if loc.get("pand_ids"):
                bag = get_bag_pand(loc["pand_ids"][0])
                dossier["bag"] = {k: v for k, v in bag.items() if k != "geometry"}
                pand_geom = bag.get("geometry")

            if perceel.get("geometry"):
                dossier["ruimtelijk"] = estimate_achtererf(perceel["geometry"], pand_geom)

            # Automatische Tier-3 suggesties (RCE-erfgoed, CBS-kom, staffel)
            dossier["tier3_suggesties"] = build_tier3_suggesties(
                loc, dossier.get("ruimtelijk", {})
            )

        a = assess(lead, perceel)
        dossier["kansen"] = a["kansen"] + dossier.get("kansen", [])
        dossier["flags"] = a["flags"] + dossier.get("flags", [])
        dossier["advies"] = a["advies"]

        sb_upsert_erfscan(
            lead_id,
            {
                "status": "needs_review",
                "dossier": dossier,
                "conclusie": a["conclusie"],
                "luchtfoto_path": luchtfoto_path,
                "enriched_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                "error": None,
            },
        )
        return {"ok": True, "lead_id": lead_id, "conclusie": a["conclusie"]}

    except Exception as e:
        sb_upsert_erfscan(lead_id, {"status": "error", "error": str(e)})
        return {"ok": False, "lead_id": lead_id, "error": str(e)}


# --------------------------------------------------------------------------- #
# HTTP HANDLER (Vercel Python)
# --------------------------------------------------------------------------- #
class handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if not SUPABASE_URL or not SERVICE_KEY:
            return self._send(500, {"error": "Supabase env (URL/SERVICE_ROLE_KEY) ontbreekt"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
            data = json.loads(raw or b"{}")
        except Exception:
            return self._send(400, {"error": "Ongeldige JSON"})

        # Auth: shared secret (header of body). Database-webhook stuurt 'em mee.
        if ERFSCAN_SECRET:
            provided = (
                self.headers.get("x-erfscan-secret")
                or (self.headers.get("authorization", "").replace("Bearer ", ""))
                or data.get("secret")
            )
            if provided != ERFSCAN_SECRET:
                return self._send(401, {"error": "Unauthorized"})

        # Supabase DB-webhook payload heeft {record: {...}}; handmatig {lead_id}.
        lead_id = data.get("lead_id") or (data.get("record") or {}).get("id")
        if not lead_id:
            return self._send(422, {"error": "lead_id ontbreekt"})

        # Optionele adres-correctie bij een handmatige re-run vanuit de CRM.
        result = run_erfscan(lead_id, data.get("postcode"), data.get("huisnummer"))
        self._send(200 if result.get("ok") else 500, result)
