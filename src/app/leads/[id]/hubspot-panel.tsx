"use client";

import { useState, useTransition } from "react";
import { syncLeadHubspotNow } from "../actions";

type Sync = {
  contact_id: string | null;
  deal_id: string | null;
  synced_at: string | null;
  error: string | null;
} | null;

function when(iso: string | null): string {
  if (!iso) return "nog niet";
  return new Date(iso).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HubspotPanel({
  leadId,
  configured,
  sync,
}: {
  leadId: string;
  configured: boolean;
  sync: Sync;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function syncNow() {
    setResult(null);
    startTransition(async () => {
      const res = await syncLeadHubspotNow(leadId);
      setResult(
        res.ok
          ? { ok: true, text: res.skipped ? "HubSpot niet geconfigureerd." : "Gesynct met HubSpot." }
          : { ok: false, text: res.error ?? "Sync mislukt." },
      );
    });
  }

  return (
    <div>
      {!configured && (
        <p className="mb-2 text-xs text-amber-600">
          HubSpot-token niet ingesteld — sync staat uit.
        </p>
      )}
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-slate-400">Laatst gesynct</dt>
          <dd className="text-slate-700">{when(sync?.synced_at ?? null)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Contact</dt>
          <dd className="text-slate-700">{sync?.contact_id ? "✓ gekoppeld" : "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Deal</dt>
          <dd className="text-slate-700">{sync?.deal_id ? "✓ gekoppeld" : "—"}</dd>
        </div>
      </dl>
      {sync?.error && (
        <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
          {sync.error}
        </p>
      )}
      <button
        onClick={syncNow}
        disabled={isPending}
        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {isPending ? "Synchroniseren…" : "Sync naar HubSpot"}
      </button>
      {result && (
        <p className={`mt-2 text-xs ${result.ok ? "text-green-600" : "text-red-600"}`}>
          {result.text}
        </p>
      )}
    </div>
  );
}
