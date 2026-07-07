#!/usr/bin/env python3
"""
aanbieder_research.py — OpEigenErf aanbieder-/modellen-research-pipeline.

Wat het doet
------------
1.  Leest bestaande aanbieders uit Supabase en bouwt een dedup-index op domein.
2.  Ontdekt NIEUWE aanbieders online (Claude API + web_search), filtert bekende eruit.
3.  Haalt per nieuwe aanbieder de site op (home + modellen/prijzen/contact),
    oogst tekst én afbeelding-URL's, en laat Claude er gestructureerde JSON van maken
    (aanbieder + modellen), met bron-URL en prijspeil. Onbekend = null, nooit gokken.
4.  Downloadt kandidaatfoto's naar een PRIVÉ Supabase-bucket (staging), met dedupe.
5.  Schrijft aanbieders + modellen als concept (actief=false, bron='scrape') en
    koppelt de foto's in public.scrape_afbeeldingen — klaar voor jouw review.

De schrijver is SCHEMA-BEWUST: hij leest bij het draaien de echte kolommen en
enum-waarden uit je database en schrijft alleen bestaande velden. Zo blijft de
tool kloppen als je schema licht afwijkt.

Standaard draait alles in DRY-RUN (schrijft naar ./out/*.json). Gebruik --commit
om echt naar Supabase te schrijven.

Vereisten
---------
    pip install anthropic httpx beautifulsoup4 "psycopg[binary]" python-slugify tldextract Pillow

Env (.env of shell)
-------------------
    ANTHROPIC_API_KEY   = sk-ant-...
    SUPABASE_DB_URL     = postgresql://postgres:...@aws-0-...pooler.supabase.com:5432/postgres
    SUPABASE_URL        = https://<ref>.supabase.co
    SUPABASE_SERVICE_KEY= <service_role key>          # voor Storage-upload

Gebruik
-------
    python aanbieder_research.py --discover --limit 5           # ontdek + verrijk 5 nieuwe (dry-run)
    python aanbieder_research.py --seed sites.txt --commit      # verrijk URL's uit bestand, schrijf weg
    python aanbieder_research.py --discover --limit 3 --commit   # ontdek + wegschrijven
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.robotparser
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx
import tldextract
from bs4 import BeautifulSoup
from slugify import slugify

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    psycopg = None

try:
    from PIL import Image
except ImportError:
    Image = None

import anthropic

# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
# Sonnet 5 = goede prijs/kwaliteit voor bulk-extractie en ondersteunt de nieuwe
# web_search-tool. Overschrijfbaar via env; kies een model dat web_search_20260209
# ondersteunt (Sonnet 5 / Opus 4.6+).
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5")
BUCKET = "aanbieder-scrape"
USER_AGENT = "OpEigenErfResearchBot/1.0 (+https://opeigenerf.nl; onderzoek naar aanbieders)"
PAGE_HINTS = ("model", "woning", "prijs", "aanbod", "type", "chalet", "mantelzorg", "over", "contact")
MAX_PAGES_PER_SITE = 6
REQUEST_TIMEOUT = 25
POLITE_DELAY = 1.0                     # seconden tussen requests naar dezelfde host
MIN_IMG_BYTES = 15_000                 # negeer iconen/sprites
MIN_IMG_SIDE = 350                     # negeer thumbnails
OUT_DIR = Path("out")

client = anthropic.Anthropic()         # leest ANTHROPIC_API_KEY uit env

# Verzamelt DB-schrijffouten van de laatste run (voor diagnose via de server).
LAST_ERRORS: list[str] = []
# Telt waarom kandidaatfoto's afvallen (voor diagnose).
PHOTO_STATS: dict[str, int] = {}


def _pstat(reason: str) -> None:
    PHOTO_STATS[reason] = PHOTO_STATS.get(reason, 0) + 1


# --------------------------------------------------------------------------- #
# Kleine helpers
# --------------------------------------------------------------------------- #
def registrable_domain(url: str) -> str:
    """example: https://www.starlinehome.nl/modellen -> starlinehome.nl"""
    if not url:
        return ""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    ext = tldextract.extract(url)
    return f"{ext.domain}.{ext.suffix}".lower() if ext.suffix else ext.domain.lower()


def norm_url(url: str) -> str:
    if url and not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def log(msg: str) -> None:
    print(msg, flush=True)


# --------------------------------------------------------------------------- #
# Database: schema-introspectie + dedup + writes
# --------------------------------------------------------------------------- #
class DB:
    def __init__(self, dsn: str):
        if psycopg is None:
            raise SystemExit("psycopg ontbreekt: pip install 'psycopg[binary]'")
        self.conn = psycopg.connect(dsn, row_factory=dict_row, autocommit=False)

    def columns(self, table: str) -> set[str]:
        with self.conn.cursor() as cur:
            cur.execute(
                """select column_name, is_generated
                     from information_schema.columns
                    where table_schema = 'public' and table_name = %s""",
                (table,),
            )
            # sluit GENERATED-kolommen uit (bijv. prijs_per_m2)
            return {r["column_name"] for r in cur.fetchall() if r["is_generated"] == "NEVER"}

    def enum_values(self, table: str) -> dict[str, set[str]]:
        """Geeft per kolom met een enum-type de toegestane waarden."""
        out: dict[str, set[str]] = {}
        with self.conn.cursor() as cur:
            cur.execute(
                """
                select c.column_name, e.enumlabel
                  from information_schema.columns c
                  join pg_type t      on t.typname = c.udt_name
                  join pg_enum e      on e.enumtypid = t.oid
                 where c.table_schema = 'public' and c.table_name = %s
                """,
                (table,),
            )
            for r in cur.fetchall():
                out.setdefault(r["column_name"], set()).add(r["enumlabel"])
        return out

    def existing_domains(self) -> set[str]:
        with self.conn.cursor() as cur:
            cur.execute("select website_url from public.aanbieders")
            return {registrable_domain(r["website_url"]) for r in cur.fetchall() if r["website_url"]}

    def existing_slugs(self) -> set[str]:
        with self.conn.cursor() as cur:
            cur.execute("select slug from public.aanbieders")
            return {r["slug"] for r in cur.fetchall()}

    def get_aanbieder(self, aanbieder_id: str) -> dict | None:
        with self.conn.cursor() as cur:
            cur.execute(
                "select id, naam, website_url, slug from public.aanbieders where id = %s",
                (aanbieder_id,),
            )
            return cur.fetchone()

    def woning_slugs_for(self, aanbieder_id: str) -> set[str]:
        """Bestaande model-slugs onder een aanbieder — voor dedupe bij her-scrape."""
        with self.conn.cursor() as cur:
            cur.execute(
                "select slug from public.woningen where aanbieder_id = %s",
                (aanbieder_id,),
            )
            return {r["slug"] for r in cur.fetchall() if r["slug"]}

    def insert_aanbieder(self, payload: dict) -> str | None:
        cols = list(payload.keys())
        ph = ", ".join(["%s"] * len(cols))
        sql = (
            f"insert into public.aanbieders ({', '.join(cols)}) values ({ph}) "
            f"on conflict (slug) do nothing returning id"
        )
        with self.conn.cursor() as cur:
            cur.execute(sql, [payload[c] for c in cols])
            row = cur.fetchone()
            if row:
                return row["id"]
            cur.execute("select id from public.aanbieders where slug = %s", (payload["slug"],))
            got = cur.fetchone()
            return got["id"] if got else None

    def insert_woning(self, payload: dict) -> str | None:
        cols = list(payload.keys())
        ph = ", ".join(["%s"] * len(cols))
        sql = (
            f"insert into public.woningen ({', '.join(cols)}) values ({ph}) "
            f"on conflict (slug) do nothing returning id"
        )
        with self.conn.cursor() as cur:
            cur.execute(sql, [payload[c] for c in cols])
            row = cur.fetchone()
            if row:
                return row["id"]
            cur.execute("select id from public.woningen where slug = %s", (payload["slug"],))
            got = cur.fetchone()
            return got["id"] if got else None

    def insert_foto(self, payload: dict) -> None:
        cols = list(payload.keys())
        ph = ", ".join(["%s"] * len(cols))
        sql = (
            f"insert into public.scrape_afbeeldingen ({', '.join(cols)}) values ({ph}) "
            f"on conflict (sha256) do nothing"
        )
        with self.conn.cursor() as cur:
            cur.execute(sql, [payload[c] for c in cols])

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()


# --------------------------------------------------------------------------- #
# HTTP: polite fetching met robots.txt
# --------------------------------------------------------------------------- #
class Fetcher:
    def __init__(self):
        self.http = httpx.Client(
            headers={"User-Agent": USER_AGENT, "Accept-Language": "nl,en;q=0.8"},
            follow_redirects=True,
            timeout=REQUEST_TIMEOUT,
        )
        self._robots: dict[str, urllib.robotparser.RobotFileParser] = {}
        self._last_hit: dict[str, float] = {}

    def _allowed(self, url: str) -> bool:
        host = urlparse(url).netloc
        rp = self._robots.get(host)
        if rp is None:
            rp = urllib.robotparser.RobotFileParser()
            try:
                r = self.http.get(f"https://{host}/robots.txt")
                rp.parse(r.text.splitlines() if r.status_code == 200 else [])
            except Exception:
                rp.parse([])
            self._robots[host] = rp
        try:
            return rp.can_fetch(USER_AGENT, url)
        except Exception:
            return True

    def _throttle(self, url: str):
        host = urlparse(url).netloc
        wait = POLITE_DELAY - (time.time() - self._last_hit.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        self._last_hit[host] = time.time()

    def get(self, url: str) -> httpx.Response | None:
        if not self._allowed(url):
            log(f"    robots.txt weigert: {url}")
            return None
        self._throttle(url)
        try:
            r = self.http.get(url)
            return r if r.status_code == 200 else None
        except Exception as e:
            log(f"    fetch-fout {url}: {e}")
            return None


# --------------------------------------------------------------------------- #
# Site oogsten: relevante pagina's kiezen, tekst + afbeeldingen verzamelen
# --------------------------------------------------------------------------- #
@dataclass
class Harvest:
    pages: list[str] = field(default_factory=list)
    text: str = ""
    images: list[dict] = field(default_factory=list)   # {url, alt, context, page}


def discover_subpages(base_url: str, home_html: str) -> list[str]:
    soup = BeautifulSoup(home_html, "html.parser")
    base_dom = registrable_domain(base_url)
    found: list[str] = [base_url]
    for a in soup.find_all("a", href=True):
        href = urljoin(base_url, a["href"].split("#")[0])
        if registrable_domain(href) != base_dom:
            continue
        low = href.lower()
        if any(h in low for h in PAGE_HINTS) and href not in found:
            found.append(href)
    # home eerst, dan hint-pagina's; begrens
    return found[:MAX_PAGES_PER_SITE]


# Attributen waar (lazy-loaded) afbeeldingen in staan.
LAZY_IMG_ATTRS = (
    "src", "data-src", "data-lazy-src", "data-original", "data-lazy",
    "data-image", "data-echo", "data-fallback-src",
)
_BG_URL_RE = re.compile(
    r"background(?:-image)?\s*:\s*url\((['\"]?)([^)'\"]+)\1\)", re.I
)


def _srcset_best(value: str) -> str | None:
    """Kies de grootste URL uit een srcset ('url 320w, url 1024w' / 'url 2x')."""
    best_url, best_w = None, -1
    for part in value.split(","):
        toks = part.strip().split()
        if not toks:
            continue
        w = 0
        if len(toks) > 1:
            d = toks[1].lower()
            try:
                if d.endswith("w"):
                    w = int(d[:-1])
                elif d.endswith("x"):
                    w = int(float(d[:-1]) * 1000)
            except ValueError:
                w = 0
        if w >= best_w:
            best_url, best_w = toks[0], w
    return best_url


def _tag_image_urls(tag) -> list[str]:
    """Alle kandidaat-afbeelding-URL's uit een <img>/<source>-tag."""
    urls: list[str] = []
    for attr in LAZY_IMG_ATTRS:
        v = tag.get(attr)
        if isinstance(v, str) and v and not v.startswith("data:"):
            urls.append(v)
    for attr in ("srcset", "data-srcset"):
        v = tag.get(attr)
        if isinstance(v, str) and v:
            best = _srcset_best(v)
            if best and not best.startswith("data:"):
                urls.append(best)
    return urls


def _collect_images(soup, page: str, seen_img: set[str], out: list[dict]) -> None:
    """Oogst afbeeldingen uit img/source/srcset + CSS background-images."""
    raw: list[tuple[str, str, object]] = []  # (url, alt, tag)
    for tag in soup.find_all(["img", "source"]):
        alt = (tag.get("alt") or "").strip()
        for u in _tag_image_urls(tag):
            raw.append((u, alt, tag))
    for el in soup.find_all(style=True):
        for m in _BG_URL_RE.finditer(el.get("style") or ""):
            if not m.group(2).startswith("data:"):
                raw.append((m.group(2), "", el))
    for el in soup.find_all(attrs={"data-bg": True}):
        v = el.get("data-bg")
        if isinstance(v, str) and v and not v.startswith("data:"):
            raw.append((v, "", el))

    skip = ("logo", "icon", "sprite", "favicon", "placeholder", "spacer", "blank", "loader")
    for url, alt, tag in raw:
        full = urljoin(page, url.split("?")[0])
        low = full.lower()
        if not low.startswith("http"):
            continue
        if any(x in low for x in skip):
            continue
        if full in seen_img:
            continue
        seen_img.add(full)
        parent = tag.find_parent()
        out.append({
            "url": full,
            "alt": alt[:120],
            "context": (parent.get_text(" ").strip()[:120] if parent else ""),
            "page": page,
        })


def harvest_site(fetcher: Fetcher, base_url: str) -> Harvest:
    h = Harvest()
    home = fetcher.get(base_url)
    if not home:
        return h
    pages = discover_subpages(base_url, home.text)
    texts: list[str] = []
    seen_img: set[str] = set()

    for page in pages:
        resp = home if page == base_url else fetcher.get(page)
        if not resp:
            continue
        h.pages.append(page)
        soup = BeautifulSoup(resp.text, "html.parser")
        # Eerst afbeeldingen oogsten uit de VOLLEDIGE HTML (incl. lazy/srcset/
        # noscript/background), dan pas scripts strippen voor de tekst.
        _collect_images(soup, page, seen_img, h.images)
        for tag in soup(["script", "style", "noscript", "svg"]):
            tag.decompose()
        page_text = re.sub(r"\s+", " ", soup.get_text(" ")).strip()
        texts.append(f"\n\n===== PAGINA: {page} =====\n{page_text[:6000]}")

    h.text = "".join(texts)[:45000]
    return h


# --------------------------------------------------------------------------- #
# Claude: discovery + gestructureerde extractie
# --------------------------------------------------------------------------- #
def discover_new_aanbieders(known_domains: set[str], want: int) -> list[dict]:
    """Gebruikt de web_search-tool om NL-aanbieders te vinden."""
    prompt = (
        "Zoek Nederlandse fabrikanten/leveranciers van mantelzorgwoningen, "
        "familiewoningen, prefab- of modulaire (tuin)woningen met een eigen modellenlijn. "
        "Focus op partijen met concrete, benoemde modellen op hun site. "
        f"Geef er minstens {want + 8}. Antwoord UITSLUITEND met JSON: "
        '{"aanbieders":[{"naam":"...","website_url":"https://..."}]} '
        "Geen tekst eromheen, geen markdown."
    )
    resp = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2000,
        thinking={"type": "disabled"},
        tools=[{"type": "web_search_20260209", "name": "web_search"}],
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
    data = _loads_json(text)
    out, seen = [], set()
    for a in (data or {}).get("aanbieders", []):
        dom = registrable_domain(a.get("website_url", ""))
        if not dom or dom in known_domains or dom in seen:
            continue
        seen.add(dom)
        out.append({"naam": a.get("naam", "").strip(), "website_url": norm_url(a["website_url"])})
        if len(out) >= want:
            break
    return out


EXTRACT_SYSTEM = (
    "Je bent een nauwkeurige data-extractie-assistent voor een Nederlands "
    "vastgoedplatform. Je haalt feiten uit websitetekst. Regels: "
    "verzin NIETS; onbekend veld = null; prijzen als heel getal in euro's "
    "(geen punten/komma's); btw_basis_bron = 'incl' of 'ex' afhankelijk van wat de "
    "site vermeldt; afbeelding_urls kies je UITSLUITEND uit de meegeleverde "
    "kandidatenlijst (exacte URL's, nooit verzonnen). Antwoord alleen met JSON."
)


def extract_structured(aanbieder_seed: dict, harvest: Harvest,
                       aanbieder_enums: dict, woning_enums: dict) -> dict | None:
    img_list = "\n".join(f"[{i}] {im['url']}  (alt: {im['alt']}; ctx: {im['context']})"
                         for i, im in enumerate(harvest.images[:60]))
    schema_hint = {
        "aanbieder": {
            "naam": "str", "website_url": "str", "beschrijving": "str|null",
            "vestigingsplaats": "str|null", "servicegebied": "str|null",
            "bouwmethode": "str|null", "levertijd_indicatie": "str|null",
            "vergunningsbegeleiding": sorted(aanbieder_enums.get("vergunningsbegeleiding", {"ja", "nee", "niet_vermeld"})),
            "koop": "bool|null", "huur": "bool|null", "tweedehands": "bool|null",
            "prijsklasse": sorted(aanbieder_enums.get("prijsklasse", {"budget", "standaard", "luxe"})),
            "vanaf_prijs_incl_btw": "int|null", "prijs_per_m2_indicatie": "int|null",
            "afwerkingsniveaus": "list[str]|null", "in_vanaf_prijs": "str|null",
            "prijspeil": "str|null (bijv. '1-4-2026' of 'mei 2026')",
        },
        "modellen": [{
            "naam": "str", "oppervlakte_m2": "int|null", "oppervlakte_max_m2": "int|null",
            "slaapkamers": "int|null", "prijs_incl_btw": "int|null",
            "btw_basis_bron": sorted(woning_enums.get("btw_basis_bron", {"incl", "ex"})),
            "is_vanaf_prijs": "bool|null",
            "afwerkingsniveau": sorted(woning_enums.get("afwerkingsniveau", {"casco", "instapklaar", "luxe"})),
            "aanbod_type": sorted(woning_enums.get("aanbod_type", {"koop", "huur", "tweedehands"})),
            "in_prijs_inbegrepen": "str|null", "beschrijving": "str|null",
            "gelijkvloers": "bool|null", "energieneutraal_beng": "bool|null",
            "prijspeil": "str|null", "bron_url": "str (pagina waar dit model staat)",
            "afbeelding_indexen": "list[int] (indexen uit de kandidatenlijst die bij dit model horen)",
        }],
    }
    user = (
        f"Aanbieder (voorlopig): {aanbieder_seed['naam']} — {aanbieder_seed['website_url']}\n\n"
        f"Gewenst JSON-formaat (waarden zijn typehints/toegestane enums):\n"
        f"{json.dumps(schema_hint, ensure_ascii=False, indent=2)}\n\n"
        f"KANDIDAAT-AFBEELDINGEN (kies per model de bijpassende indexen):\n{img_list}\n\n"
        f"WEBSITE-INHOUD:\n{harvest.text}"
    )
    resp = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=8000,
        thinking={"type": "disabled"},
        system=EXTRACT_SYSTEM,
        messages=[{"role": "user", "content": user}],
    )
    text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
    data = _loads_json(text)
    if not data:
        return None
    # zet afbeelding_indexen om naar echte URL's
    for m in data.get("modellen", []):
        urls = []
        for idx in (m.pop("afbeelding_indexen", None) or []):
            if isinstance(idx, int) and 0 <= idx < len(harvest.images):
                urls.append(harvest.images[idx])
        m["_afbeeldingen"] = urls
    return data


def _loads_json(text: str) -> dict | None:
    text = text.strip()
    text = re.sub(r"^```(json)?|```$", "", text, flags=re.MULTILINE).strip()
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


# --------------------------------------------------------------------------- #
# Foto's: downloaden, valideren, naar privé-bucket
# --------------------------------------------------------------------------- #
class Storage:
    def __init__(self, supabase_url: str, service_key: str):
        self.base = supabase_url.rstrip("/")
        self.key = service_key
        self.http = httpx.Client(timeout=REQUEST_TIMEOUT)

    def upload(self, path: str, content: bytes, content_type: str) -> bool:
        url = f"{self.base}/storage/v1/object/{BUCKET}/{path}"
        r = self.http.post(
            url, content=content,
            headers={
                "Authorization": f"Bearer {self.key}",
                "apikey": self.key,
                "Content-Type": content_type,
                "x-upsert": "true",
            },
        )
        return r.status_code in (200, 201)


def process_images(fetcher: Fetcher, images: list[dict], slug: str, model_slug: str,
                   storage: Storage | None, seen_hashes: set[str]) -> list[dict]:
    out = []
    for i, im in enumerate(images):
        try:
            if not fetcher._allowed(im["url"]):
                _pstat("robots")
                continue
            fetcher._throttle(im["url"])
            # Verse client per download: de langlevende Fetcher-client geeft na de
            # trage Claude-call soms DNS-fouten (idle keepalive); een fresh get niet.
            r = httpx.get(
                im["url"],
                headers={"User-Agent": USER_AGENT, "Referer": im["page"]},
                timeout=REQUEST_TIMEOUT,
                follow_redirects=True,
            )
            ct = r.headers.get("content-type", "")
            if r.status_code != 200 or not ct.startswith("image"):
                _pstat(f"http_{r.status_code}" if r.status_code != 200 else "geen_image")
                continue
            content = r.content
            if len(content) < MIN_IMG_BYTES:
                _pstat("klein_bytes")
                continue
            sha = hashlib.sha256(content).hexdigest()
            if sha in seen_hashes:
                _pstat("dedup")
                continue
            w = h = None
            if Image is not None:
                try:
                    img = Image.open(io.BytesIO(content))
                    w, h = img.size
                    if max(w, h) < MIN_IMG_SIDE:
                        _pstat("klein_pixels")
                        continue
                except Exception:
                    pass
            seen_hashes.add(sha)
            ext = (im["url"].rsplit(".", 1)[-1].split("?")[0][:4] or "jpg").lower()
            if ext not in ("jpg", "jpeg", "png", "webp", "avif"):
                ext = "jpg"
            path = f"{slug}/{model_slug}/{sha[:16]}.{ext}"
            stored = False
            if storage is not None:
                stored = storage.upload(path, content, r.headers["content-type"])
            _pstat("ok" if stored else "upload_fail")
            out.append({
                "bron_url": im["url"], "bron_pagina": im["page"],
                "storage_path": path if stored else None,
                "sha256": sha, "breedte": w, "hoogte": h, "bytes": len(content),
            })
        except Exception as e:
            _pstat(f"exc_{type(e).__name__}")
            if len([x for x in LAST_ERRORS if x.startswith("foto ")]) < 3:
                LAST_ERRORS.append(f"foto {im.get('url','')[:90]}: {type(e).__name__}: {e}")
            log(f"      foto-fout: {e}")
    return out


# --------------------------------------------------------------------------- #
# Payload-bouw: coerce naar schema (alleen bestaande kolommen + geldige enums)
# --------------------------------------------------------------------------- #
def coerce(payload: dict, allowed_cols: set[str], enums: dict[str, set[str]]) -> dict:
    out = {}
    for k, v in payload.items():
        if k not in allowed_cols:
            continue
        if v == "":
            v = None
        if k in enums and v is not None:
            # Enum-kolom: alleen een geldige string toestaan. Een lijst/dict (soms
            # geeft de LLM ["koop","huur"]) is ongeldig → weglaten (DB-default).
            if not isinstance(v, str) or v not in enums[k]:
                v = None
        # None-waarden (incl. ongeldige enums) WEGLATEN uit de insert, zodat de
        # kolom-default aanslaat (bv. koop/huur/tweedehands, btw_basis_bron,
        # is_vanaf_prijs, aanbod_type zijn NOT NULL met een default). Expliciet
        # null insereren zou die NOT-NULL-constraints breken.
        if v is None:
            continue
        out[k] = v
    return out


def build_aanbieder_payload(seed, extracted, cols, enums) -> dict:
    a = extracted.get("aanbieder", {})
    slug = slugify(a.get("naam") or seed["naam"])
    raw = {
        "slug": slug,
        "naam": a.get("naam") or seed["naam"],
        "website_url": a.get("website_url") or seed["website_url"],
        "beschrijving": a.get("beschrijving"),
        "vestigingsplaats": a.get("vestigingsplaats"),
        "servicegebied": a.get("servicegebied"),
        "bouwmethode": a.get("bouwmethode"),
        "levertijd_indicatie": a.get("levertijd_indicatie"),
        "vergunningsbegeleiding": a.get("vergunningsbegeleiding"),
        "koop": a.get("koop"), "huur": a.get("huur"), "tweedehands": a.get("tweedehands"),
        "prijsklasse": a.get("prijsklasse"),
        "vanaf_prijs_incl_btw": a.get("vanaf_prijs_incl_btw"),
        "prijs_per_m2_indicatie": a.get("prijs_per_m2_indicatie"),
        "afwerkingsniveaus": a.get("afwerkingsniveaus"),
        "in_vanaf_prijs": a.get("in_vanaf_prijs"),
        "prijspeil": a.get("prijspeil"),
        "bron_url": seed["website_url"],
        "laatst_gecontroleerd": date.today().isoformat(),
        "is_partner": False,
        "actief": False,
        "bron": "scrape",
        "review_status": "nieuw",
    }
    return coerce(raw, cols, enums), slug


def build_woning_payload(m, aanbieder_id, aanbieder_slug, cols, enums) -> tuple[dict, str]:
    mslug = slugify(f"{aanbieder_slug}-{m.get('naam','model')}")
    raw = {
        "aanbieder_id": aanbieder_id,
        "slug": mslug,
        "naam": m.get("naam"),
        "oppervlakte_m2": m.get("oppervlakte_m2"),
        "oppervlakte_max_m2": m.get("oppervlakte_max_m2"),
        "slaapkamers": m.get("slaapkamers"),
        "prijs_incl_btw": m.get("prijs_incl_btw"),
        "btw_basis_bron": m.get("btw_basis_bron"),
        "is_vanaf_prijs": m.get("is_vanaf_prijs"),
        "afwerkingsniveau": m.get("afwerkingsniveau"),
        "aanbod_type": m.get("aanbod_type"),
        "in_prijs_inbegrepen": m.get("in_prijs_inbegrepen"),
        "beschrijving": m.get("beschrijving"),
        "gelijkvloers": m.get("gelijkvloers"),
        "energieneutraal_beng": m.get("energieneutraal_beng"),
        "afbeeldingen": [],                       # publiek leeg tot review
        "bron_url": m.get("bron_url"),
        "prijspeil": m.get("prijspeil"),
        "laatst_gecontroleerd": date.today().isoformat(),
        "actief": False,
        "uitgelicht": False,
        "bron": "scrape",
        "review_status": "nieuw",
    }
    return coerce(raw, cols, enums), mslug


# --------------------------------------------------------------------------- #
# Orkestratie
# --------------------------------------------------------------------------- #
def run(seeds: list[dict], commit: bool):
    OUT_DIR.mkdir(exist_ok=True)
    fetcher = Fetcher()

    db = None
    a_cols = w_cols = set()
    a_enums = w_enums = {}
    storage = None
    if commit:
        dsn = os.environ["SUPABASE_DB_URL"]
        db = DB(dsn)
        a_cols, w_cols = db.columns("aanbieders"), db.columns("woningen")
        a_enums, w_enums = db.enum_values("aanbieders"), db.enum_values("woningen")
        sup_url, sup_key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
        if sup_url and sup_key:
            storage = Storage(sup_url, sup_key)
        else:
            log("  ! SUPABASE_URL/SERVICE_KEY ontbreken — foto's worden niet geüpload.")
    else:
        # dry-run: gebruik verwachte enums zodat coerce iets zinnigs doet
        a_enums = {"vergunningsbegeleiding": {"ja", "nee", "niet_vermeld"},
                   "prijsklasse": {"budget", "standaard", "luxe"}}
        w_enums = {"btw_basis_bron": {"incl", "ex"},
                   "afwerkingsniveau": {"casco", "instapklaar", "luxe"},
                   "aanbod_type": {"koop", "huur", "tweedehands"}}

    seen_hashes: set[str] = set()
    results = []
    LAST_ERRORS.clear()
    PHOTO_STATS.clear()

    for seed in seeds:
        log(f"\n▶ {seed['naam']} — {seed['website_url']}")
        harvest = harvest_site(fetcher, seed["website_url"])
        if not harvest.text:
            log("  geen bruikbare inhoud, overslaan.")
            continue
        log(f"  {len(harvest.pages)} pagina's, {len(harvest.images)} kandidaatfoto's.")

        extracted = extract_structured(seed, harvest, a_enums, w_enums)
        if not extracted:
            log("  extractie mislukt, overslaan.")
            continue
        n_models = len(extracted.get("modellen", []))
        log(f"  → {n_models} modellen geëxtraheerd.")

        toegewezen = sum(
            len(m.get("_afbeeldingen", [])) for m in extracted.get("modellen", [])
        )
        record = {
            "seed": seed,
            "extracted": extracted,
            "images": len(harvest.images),   # geoogste kandidaatfoto's
            "toegewezen": toegewezen,        # door LLM aan modellen gekoppeld
            "fotos": 0,                      # daadwerkelijk geüpload (na writes)
        }
        results.append(record)

        if not commit:
            continue

        # --- wegschrijven ---
        try:
            # Her-scrape van een BESTAANDE aanbieder: gebruik diens id, laat de
            # aanbieder-rij ongemoeid en stage alleen nieuwe (nog niet bestaande)
            # modellen + foto's ter review. Anders: nieuwe concept-aanbieder.
            refresh_id = seed.get("aanbieder_id")
            if refresh_id:
                bestaand = db.get_aanbieder(refresh_id)
                if not bestaand:
                    log("  ! aanbieder-id niet gevonden, overslaan.")
                    continue
                aanbieder_id = refresh_id
                a_slug = bestaand.get("slug") or slugify(bestaand["naam"])
                bestaande_slugs = db.woning_slugs_for(aanbieder_id)
            else:
                a_payload, a_slug = build_aanbieder_payload(seed, extracted, a_cols, a_enums)
                aanbieder_id = db.insert_aanbieder(a_payload)
                if not aanbieder_id:
                    log("  ! geen aanbieder_id, rollback deze aanbieder.")
                    db.rollback()
                    continue
                bestaande_slugs = set()

            nieuw = 0
            for m in extracted.get("modellen", []):
                w_payload, m_slug = build_woning_payload(m, aanbieder_id, a_slug, w_cols, w_enums)
                if refresh_id and m_slug in bestaande_slugs:
                    continue  # model bestaat al onder deze aanbieder — geen duplicaat
                woning_id = db.insert_woning(w_payload)
                fotos = process_images(fetcher, m.get("_afbeeldingen", []), a_slug, m_slug, storage, seen_hashes)
                for f in fotos:
                    db.insert_foto({**f, "aanbieder_id": aanbieder_id, "woning_id": woning_id})
                record["fotos"] += len(fotos)
                nieuw += 1
                log(f"    · {m.get('naam','?')}: {len(fotos)} foto's")

            db.commit()
            if refresh_id:
                log(f"  ✔ her-scrape: {nieuw} nieuwe concept-modellen gestaged.")
            else:
                log(f"  ✔ opgeslagen als concept (actief=false).")
        except Exception as e:
            db.rollback()
            msg = f"{seed.get('website_url')}: {type(e).__name__}: {e}"
            LAST_ERRORS.append(msg)
            log(f"  ! DB-fout, teruggedraaid: {msg}")

    # dry-run output
    stamp = time.strftime("%Y%m%d-%H%M%S")
    (OUT_DIR / f"research-{stamp}.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2, default=str)
    )
    log(f"\nKlaar. {len(results)} aanbieders verwerkt. JSON: out/research-{stamp}.json")
    if not commit:
        log("Dry-run — er is niets naar Supabase geschreven. Gebruik --commit om weg te schrijven.")
    if db:
        db.conn.close()
    return results


def load_seeds_from_file(path: str) -> list[dict]:
    seeds = []
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split(",", 1)]
        if len(parts) == 2:
            seeds.append({"naam": parts[0], "website_url": norm_url(parts[1])})
        else:
            seeds.append({"naam": registrable_domain(line), "website_url": norm_url(line)})
    return seeds


def main():
    ap = argparse.ArgumentParser(description="OpEigenErf aanbieder-research-pipeline")
    ap.add_argument("--discover", action="store_true", help="zoek nieuwe aanbieders online")
    ap.add_argument("--seed", metavar="FILE", help="bestand met 'naam, url' per regel")
    ap.add_argument("--limit", type=int, default=5, help="max. nieuwe aanbieders (bij --discover)")
    ap.add_argument("--commit", action="store_true", help="schrijf naar Supabase (anders dry-run)")
    args = ap.parse_args()

    if not args.discover and not args.seed:
        ap.error("geef --discover en/of --seed op")

    seeds: list[dict] = []
    if args.seed:
        seeds += load_seeds_from_file(args.seed)

    if args.discover:
        known: set[str] = set()
        if args.commit:
            db = DB(os.environ["SUPABASE_DB_URL"])
            known = db.existing_domains()
            db.conn.close()
            log(f"{len(known)} bestaande aanbieders in Supabase (dedup op domein).")
        else:
            log("Dry-run discovery: geen DB-dedup (draai met --commit voor echte dedup).")
        found = discover_new_aanbieders(known, args.limit)
        log(f"{len(found)} nieuwe kandidaten gevonden.")
        seeds += found

    if not seeds:
        log("Geen aanbieders om te verwerken.")
        return
    run(seeds, commit=args.commit)


if __name__ == "__main__":
    main()
