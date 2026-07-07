"use client";

import { useEffect, useRef } from "react";
import { trackView } from "./actions";

// Stempelt het paginabezoek client-side (na render), zodat RSC-prefetch en bots
// niet meetellen. Telt hoogstens één keer per browser per dag (localStorage), en
// slaat eigen (ingelogde CRM-)opens over — zodat de teller echte klantbezoeken
// weerspiegelt en niet oploopt door herladen of eigen previews.
export function TrackView({ token, skip = false }: { token: string; skip?: boolean }) {
  const done = useRef(false);
  useEffect(() => {
    if (skip || done.current) return;
    done.current = true;

    // Max. 1× per dag per browser.
    const vandaag = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `erfcheck-view:${token}`;
    try {
      if (localStorage.getItem(key) === vandaag) return;
      localStorage.setItem(key, vandaag);
    } catch {
      /* localStorage kan geblokkeerd zijn — dan gewoon tellen */
    }

    trackView(token).catch(() => {});
  }, [token, skip]);
  return null;
}
