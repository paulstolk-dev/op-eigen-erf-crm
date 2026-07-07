"use client";

import { useState, useTransition } from "react";
import { refreshAanbieder } from "../research-actions";

export function HerscrapeKnop({ aanbiederId }: { aanbiederId: string }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function herscrape() {
    if (!confirm("Modellen opnieuw ophalen van de site van deze aanbieder? Nieuwe modellen/foto's verschijnen als concept onder Research."))
      return;
    setMsg(null);
    startTransition(async () => {
      const res = await refreshAanbieder(aanbiederId);
      setMsg(
        res.ok
          ? { ok: true, text: "Gestart — nieuwe concepten verschijnen zo onder Research." }
          : { ok: false, text: res.error ?? "Mislukt." },
      );
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={herscrape}
        disabled={isPending}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : "Modellen bijwerken via scrape"}
      </button>
      {msg && (
        <span className={`text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>
      )}
    </div>
  );
}
