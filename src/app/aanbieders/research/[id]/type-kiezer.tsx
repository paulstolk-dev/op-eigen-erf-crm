"use client";

import { useState, useTransition } from "react";
import { WONINGTYPES, WONINGTYPE_LABELS } from "@/lib/aanbieders-constants";
import { setWoningtypes } from "../../research-actions";

export function TypeKiezer({
  woningId,
  initial,
}: {
  woningId: string;
  initial: string[];
}) {
  const [types, setTypes] = useState<string[]>(initial ?? []);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState("");

  function toggle(t: string) {
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t];
    const prev = types;
    setTypes(next);
    setErr("");
    startTransition(async () => {
      const r = await setWoningtypes(woningId, next);
      if (!r.ok) {
        setTypes(prev); // terugdraaien bij fout
        setErr(r.error ?? "Opslaan mislukt");
      }
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-slate-400">Type:</span>
      {WONINGTYPES.map((t) => {
        const actief = types.includes(t);
        return (
          <button
            key={t}
            type="button"
            disabled={isPending}
            onClick={() => toggle(t)}
            aria-pressed={actief}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition disabled:opacity-60 ${
              actief
                ? "bg-erf/15 text-erf ring-erf/30"
                : "bg-white text-slate-500 ring-slate-300 hover:bg-slate-50"
            }`}
          >
            {actief ? "✓ " : ""}
            {WONINGTYPE_LABELS[t]}
          </button>
        );
      })}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
