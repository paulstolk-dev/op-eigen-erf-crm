"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncAdsNow } from "./actions";

export function AdsSyncButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function sync() {
    setMsg(null);
    startTransition(async () => {
      const res = await syncAdsNow();
      if (res.ok) {
        setMsg({
          ok: true,
          text: `Bijgewerkt — ${res.dagen ?? 0} dagen, € ${res.totaal_eur ?? 0}`,
        });
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error ?? "Mislukt." });
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {msg && (
        <span className={`text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>
          {msg.text}
        </span>
      )}
      <button
        onClick={sync}
        disabled={isPending}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {isPending ? "Bijwerken…" : "Ads nu bijwerken"}
      </button>
    </div>
  );
}
