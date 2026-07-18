#!/usr/bin/env python3
"""
backfill_vhp.py — EENMALIG. Scant alle gemeenten via SRU (VHP-readiness) en schrijft
de gevonden signalen + checks + cursor-updates weg als idempotente SQL. Draait lokaal
(geen DB-toegang nodig); de SQL wordt daarna via de Supabase-tool toegepast.

    python backfill_vhp.py <gemeenten.json> <out.sql>
"""
import json
import sys
import time

import httpx

from vhp_poller import (
    USER_AGENT, TIMEOUT, VHP_SENTINEL,
    sru_vhp_search, vhp_relevance, classify_vhp_type,
)
from omgevingsplan_poller import besluit_id


def q(s: str) -> str:
    """SQL-string-literal (enkele quotes verdubbeld)."""
    return "'" + str(s).replace("'", "''") + "'"


def main() -> int:
    gem_path, out_path = sys.argv[1], sys.argv[2]
    gemeenten = json.load(open(gem_path, encoding="utf-8"))

    signal_rows: list[str] = []
    check_rows: list[str] = []
    ontwerp_slugs: list[str] = []
    tel = {"ok": 0, "geen": 0, "fout": 0, "signalen": 0, "vastgesteld": 0, "ontwerp": 0}

    headers = {"User-Agent": USER_AGENT, "Accept": "application/xml"}
    with httpx.Client(headers=headers, timeout=TIMEOUT, follow_redirects=True) as http:
        for i, (slug, naam) in enumerate(gemeenten, 1):
            try:
                total, records = sru_vhp_search(http, naam, "2024-01-01", 50)
                per_besluit: dict[str, dict] = {}
                for rec in records:
                    bid = besluit_id(rec)
                    if not bid:
                        continue
                    keep = per_besluit.get(bid)
                    if keep is None or (keep.get("mededeling_over") and not rec.get("mededeling_over")):
                        per_besluit[bid] = {**rec, "besluit_id": bid}

                relevant = 0
                saw_ontwerp = False
                for bid, rec in per_besluit.items():
                    titel, doctype = rec.get("titel", ""), rec.get("type", "")
                    is_rel, status, zek = vhp_relevance(titel, doctype)
                    if not is_rel:
                        continue
                    relevant += 1
                    tel["signalen"] += 1
                    if status == "ontwerp":
                        saw_ontwerp = True
                        tel["ontwerp"] += 1
                    elif status == "vastgesteld":
                        tel["vastgesteld"] += 1
                    wtype = classify_vhp_type(status)
                    delta = json.dumps({"titel": titel[:300], "doctype": doctype,
                                        "status": status, "zekerheid": zek,
                                        "datum": rec.get("datum")}, ensure_ascii=False)
                    bron = rec.get("bron_url") or f"https://zoek.officielebekendmakingen.nl/{bid}.html"
                    signal_rows.append(
                        f"({q(slug)},{q(VHP_SENTINEL)},{q(wtype)},{q(bid)},{q(delta)}::jsonb,{q(bron)})"
                    )
                if saw_ontwerp:
                    ontwerp_slugs.append(slug)
                resultaat = "ok" if relevant else "geen_treffers"
                tel["ok" if relevant else "geen"] += 1
                check_rows.append(f"({q(slug)},{q(resultaat)},{total},{relevant})")
                print(f"[{i}/{len(gemeenten)}] {slug}: {total} treffers, {relevant} relevant", file=sys.stderr)
            except Exception as e:  # noqa: BLE001
                tel["fout"] += 1
                check_rows.append(f"({q(slug)},'fout',0,0)")
                print(f"[{i}/{len(gemeenten)}] {slug}: FOUT {type(e).__name__}: {e}", file=sys.stderr)
            time.sleep(0.25)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("-- VHP-readiness backfill (gegenereerd door backfill_vhp.py)\n")
        if signal_rows:
            f.write("insert into public.gemeente_wijzigingen "
                    "(gemeente_slug, artikel, type, nieuwe_hash, delta, bron_url) values\n")
            f.write(",\n".join(signal_rows))
            f.write("\non conflict (gemeente_slug, artikel, nieuwe_hash) do nothing;\n\n")
        f.write("update public.gemeenten set dso_laatst_gepolld = now() "
                "where research_status <> 'niet_onderzocht';\n\n")
        if ontwerp_slugs:
            lst = ",".join(q(s) for s in ontwerp_slugs)
            f.write(f"update public.gemeenten set dso_ontwerp_aanwezig = true where slug in ({lst});\n\n")
        if check_rows:
            f.write("insert into public.gemeente_checks "
                    "(gemeente_slug, resultaat, aantal_treffers, aantal_relevant) values\n")
            f.write(",\n".join(check_rows))
            f.write(";\n")

    print(f"\nKLAAR: {tel} · {len(signal_rows)} signaalrijen → {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
