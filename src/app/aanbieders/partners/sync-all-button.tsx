"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncAllAanbiedersToHubspot } from "../partner-actions";

export function SyncAllButton() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  function run() {
    setMsg("");
    start(async () => {
      const r = await syncAllAanbiedersToHubspot();
      const delen = [`${r.synced} gesynct`];
      if (r.failed) delen.push(`${r.failed} mislukt`);
      if (r.skipped) delen.push(`${r.skipped} overgeslagen (HubSpot niet gekoppeld)`);
      setMsg(delen.join(" · ") + ".");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Synchroniseren…" : "Sync alle aanbieders naar HubSpot"}
      </button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}
