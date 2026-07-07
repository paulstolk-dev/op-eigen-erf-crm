#!/usr/bin/env python3
"""
server.py — dunne HTTP-wrapper rond de aanbieder-research-pipeline, voor Railway.

Draait de crawl in een achtergrondthread en antwoordt direct 202 (een crawl duurt
minuten). Beveiligd met een gedeeld secret. Het CRM triggert dit met een knop.

Endpoints
---------
  GET  /              health check
  POST /run           start een run. Body:
      {"mode": "discover", "limit": 5}
      {"mode": "seed", "seeds": [{"naam": "...", "website_url": "https://..."}]}
      {"mode": "refresh", "aanbieder_id": "<uuid>"}
    Header: x-research-secret: <RESEARCH_TRIGGER_SECRET>  (of Authorization: Bearer)

Env: zie README. Start: uvicorn server:app --host 0.0.0.0 --port $PORT
"""

from __future__ import annotations

import os
import threading

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

import aanbieder_research as ar

app = FastAPI(title="opeigenerf aanbieder-research")

_running = threading.Lock()  # max één crawl tegelijk


class RunBody(BaseModel):
    mode: str
    limit: int | None = 5
    seeds: list[dict] | None = None
    aanbieder_id: str | None = None


def _check_secret(provided: str | None) -> None:
    secret = os.environ.get("RESEARCH_TRIGGER_SECRET")
    if not secret:
        raise HTTPException(500, "RESEARCH_TRIGGER_SECRET niet gezet op de server.")
    token = provided
    if token and token.lower().startswith("bearer "):
        token = token[7:]
    if token != secret:
        raise HTTPException(401, "Unauthorized")


def _seeds_for(body: RunBody) -> list[dict]:
    if body.mode == "seed":
        return [
            {"naam": (s.get("naam") or ar.registrable_domain(s.get("website_url", ""))),
             "website_url": ar.norm_url(s.get("website_url", ""))}
            for s in (body.seeds or [])
            if s.get("website_url")
        ]
    if body.mode == "discover":
        db = ar.DB(os.environ["SUPABASE_DB_URL"])
        try:
            known = db.existing_domains()
        finally:
            db.conn.close()
        return ar.discover_new_aanbieders(known, body.limit or 5)
    if body.mode == "refresh":
        if not body.aanbieder_id:
            raise HTTPException(422, "aanbieder_id ontbreekt voor mode=refresh")
        db = ar.DB(os.environ["SUPABASE_DB_URL"])
        try:
            a = db.get_aanbieder(body.aanbieder_id)
        finally:
            db.conn.close()
        if not a or not a.get("website_url"):
            raise HTTPException(404, "Aanbieder niet gevonden of zonder website_url.")
        return [{"naam": a["naam"], "website_url": ar.norm_url(a["website_url"]),
                 "aanbieder_id": a["id"]}]
    raise HTTPException(422, f"Onbekende mode: {body.mode}")


def _background(seeds: list[dict]) -> None:
    try:
        ar.run(seeds, commit=True)
    except Exception as e:  # noqa: BLE001 — log en geef de lock vrij
        ar.log(f"! run-fout: {e}")
    finally:
        _running.release()


@app.get("/")
def health() -> dict:
    return {"ok": True, "busy": _running.locked()}


@app.post("/run", status_code=202)
def run(
    body: RunBody,
    x_research_secret: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    _check_secret(x_research_secret or authorization)
    seeds = _seeds_for(body)
    if not seeds:
        return {"ok": True, "started": False, "reason": "geen aanbieders om te verwerken"}
    if not _running.acquire(blocking=False):
        raise HTTPException(409, "Er draait al een crawl.")
    threading.Thread(target=_background, args=(seeds,), daemon=True).start()
    return {"ok": True, "started": True, "aantal": len(seeds), "mode": body.mode}
