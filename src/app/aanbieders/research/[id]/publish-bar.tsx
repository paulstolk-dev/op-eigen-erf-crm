"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishScrapedAanbieder, setScrapeReviewStatus } from "../../research-actions";

export function PublishBar({ aanbiederId }: { aanbiederId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function publiceer() {
    if (!confirm("Publiceren? Gekozen foto's worden openbaar en de modellen gaan live op de site."))
      return;
    setMsg(null);
    startTransition(async () => {
      const res = await publishScrapedAanbieder(aanbiederId);
      setMsg(res.ok ? { ok: true, text: "Gepubliceerd." } : { ok: false, text: res.error ?? "Mislukt." });
      if (res.ok) router.refresh();
    });
  }

  function afwijzen() {
    if (!confirm("Aanbieder afwijzen? Blijft verborgen op de site.")) return;
    setMsg(null);
    startTransition(async () => {
      const res = await setScrapeReviewStatus(aanbiederId, "afgewezen");
      setMsg(res.ok ? { ok: true, text: "Afgewezen." } : { ok: false, text: res.error ?? "Mislukt." });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={publiceer}
        disabled={isPending}
        className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : "Publiceren"}
      </button>
      <button
        onClick={afwijzen}
        disabled={isPending}
        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
      >
        Afwijzen
      </button>
      {msg && (
        <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>
      )}
    </div>
  );
}
