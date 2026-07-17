"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkAfwijzenIndicatie } from "./actions";

export function BulkRejectIndicatie({ aantal }: { aantal: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [isPending, start] = useTransition();

  if (aantal === 0) return null;

  function onClick() {
    if (!confirm(`${aantal} 'indicatie'-signalen (lage zekerheid) afwijzen?`)) return;
    setMsg("");
    start(async () => {
      const r = await bulkAfwijzenIndicatie();
      if (!r.ok) setMsg(`Mislukt: ${r.error}`);
      else {
        setMsg(`${r.aantal} afgewezen.`);
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={onClick}
        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : `Wijs ${aantal} indicatie-signalen af`}
      </button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </span>
  );
}
