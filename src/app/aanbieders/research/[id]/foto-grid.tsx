"use client";

import { useState, useTransition } from "react";
import { toggleFoto } from "../../research-actions";

type Foto = { id: string; url: string | null; gekozen: boolean };

export function FotoGrid({ fotos }: { fotos: Foto[] }) {
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(fotos.map((f) => [f.id, f.gekozen])),
  );
  const [, startTransition] = useTransition();

  function toggle(id: string) {
    const next = !state[id];
    setState((p) => ({ ...p, [id]: next }));
    startTransition(async () => {
      const res = await toggleFoto(id, next);
      if (!res.ok) setState((p) => ({ ...p, [id]: !next })); // revert
    });
  }

  if (fotos.length === 0) {
    return <p className="text-xs text-slate-400">Geen kandidaatfoto&apos;s.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {fotos.map((f) => {
        const gekozen = state[f.id];
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => toggle(f.id)}
            title={gekozen ? "Gekozen — klik om te deselecteren" : "Klik om te kiezen"}
            className={`relative h-20 w-20 overflow-hidden rounded-lg border-2 transition ${
              gekozen ? "border-erf ring-2 ring-erf/40" : "border-slate-200 opacity-70 hover:opacity-100"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {f.url ? (
              <img src={f.url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                geen preview
              </span>
            )}
            {gekozen && (
              <span className="absolute right-0.5 top-0.5 rounded-full bg-erf px-1 text-[10px] font-bold text-white">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
