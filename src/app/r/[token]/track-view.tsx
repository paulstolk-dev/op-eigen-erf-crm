"use client";

import { useEffect, useRef } from "react";
import { trackView } from "./actions";

// Stempelt het paginabezoek client-side (na render), zodat RSC-prefetch en bots
// niet meetellen. Eén keer per gemounte pagina.
export function TrackView({ token }: { token: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    trackView(token).catch(() => {});
  }, [token]);
  return null;
}
