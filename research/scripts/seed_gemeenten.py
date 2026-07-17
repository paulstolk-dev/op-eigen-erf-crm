#!/usr/bin/env python3
"""
seed_gemeenten.py — vult public.gemeenten met alle huidige Nederlandse gemeenten
(bron: PDOK Locatieserver, incl. provincie) met research_status='monitoren'
(de poller bewaakt ze, nog niet publiek). Bestaande rijen blijven ongemoeid.

Draai: python --env-file=.env scripts/seed_gemeenten.py   (of laad .env in je shell)
"""
import json
import re
import unicodedata
import urllib.parse
import urllib.request
import os

try:
    import psycopg
except Exception:  # pragma: no cover
    raise SystemExit("psycopg ontbreekt: pip install 'psycopg[binary]'")

PDOK = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free"


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "gemeente"


def alle_gemeenten() -> dict[str, str]:
    """{gemeentenaam: provincienaam} voor alle huidige gemeenten (gepagineerd)."""
    out: dict[str, str] = {}
    for start in range(0, 400, 100):
        qs = urllib.parse.urlencode(
            {"q": "*", "fq": "type:gemeente", "rows": 100, "start": start,
             "fl": "gemeentenaam,provincienaam"}
        )
        req = urllib.request.Request(f"{PDOK}?{qs}", headers={"User-Agent": "OpEigenErf/1.0"})
        data = json.load(urllib.request.urlopen(req, timeout=30))
        docs = data["response"]["docs"]
        for x in docs:
            if x.get("gemeentenaam"):
                out[x["gemeentenaam"]] = x.get("provincienaam")
        if start + 100 >= data["response"]["numFound"]:
            break
    return out


def main() -> None:
    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        raise SystemExit("SUPABASE_DB_URL ontbreekt.")
    alle = alle_gemeenten()
    seen: set[str] = set()
    rows = []
    for naam, prov in alle.items():
        slug = slugify(naam)
        while slug in seen:
            slug += "-2"
        seen.add(slug)
        rows.append((slug, naam, prov))

    with psycopg.connect(dsn, autocommit=True) as conn, conn.cursor() as cur:
        cur.executemany(
            "insert into public.gemeenten (slug, naam, provincie, research_status) "
            "values (%s,%s,%s,'monitoren') on conflict (slug) do nothing",
            rows,
        )
        cur.execute("select count(*) from public.gemeenten")
        print(f"Klaar. {len(rows)} gemeenten verwerkt; totaal in DB: {cur.fetchone()[0]}")


if __name__ == "__main__":
    main()
