"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startResearch } from "../research-actions";

export function ZoekKnop() {
  const router = useRouter();
  const [limit, setLimit] = useState(5);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function zoek() {
    setMsg(null);
    startTransition(async () => {
      const res = await startResearch(limit);
      if (res.ok) {
        setMsg({
          ok: true,
          text: res.started
            ? `Gestart — ${res.aantal ?? 0} kandidaten worden verwerkt. Resultaten verschijnen zo (ververs de pagina).`
            : "Gestart, maar geen nieuwe kandidaten gevonden.",
        });
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error ?? "Mislukt." });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-sm text-slate-500">Aantal</label>
      <input
        type="number"
        min={1}
        max={20}
        value={limit}
        onChange={(e) => setLimit(Number(e.target.value))}
        className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-sm"
      />
      <button
        onClick={zoek}
        disabled={isPending}
        className="rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
      >
        {isPending ? "Zoeken…" : "Zoek nieuwe aanbieders"}
      </button>
      {msg && (
        <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
