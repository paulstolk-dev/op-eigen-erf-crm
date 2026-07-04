"use client";

import { useState, useTransition } from "react";
import {
  shareLeadMetAanbieder,
  setContactVrijgave,
  removeShare,
} from "../actions";

type Share = {
  id: string;
  aanbieder_id: string;
  status: string;
  contact_vrijgegeven: boolean;
  aanbiederNaam: string;
};

const STATUS_LABELS: Record<string, string> = {
  gedeeld: "Gedeeld",
  geinteresseerd: "Geïnteresseerd",
  afgewezen: "Afgewezen",
};

export function DeelPaneel({
  leadId,
  shares,
  aanbieders,
}: {
  leadId: string;
  shares: Share[];
  aanbieders: { id: string; naam: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [keuze, setKeuze] = useState("");

  const gedeeldIds = new Set(shares.map((s) => s.aanbieder_id));
  const beschikbaar = aanbieders.filter((a) => !gedeeldIds.has(a.id));

  function deel() {
    if (!keuze) return;
    setError(null);
    startTransition(async () => {
      const res = await shareLeadMetAanbieder(leadId, keuze);
      if (!res.ok) setError(res.error ?? "Delen mislukt.");
      else setKeuze("");
    });
  }

  function toggleVrijgave(share: Share) {
    setError(null);
    startTransition(async () => {
      const res = await setContactVrijgave(
        share.id,
        leadId,
        !share.contact_vrijgegeven,
      );
      if (!res.ok) setError(res.error ?? "Mislukt.");
    });
  }

  function verwijder(share: Share) {
    if (!confirm(`Delen met ${share.aanbiederNaam} intrekken?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await removeShare(share.id, leadId);
      if (!res.ok) setError(res.error ?? "Mislukt.");
    });
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <ul className="space-y-2">
        {shares.length === 0 && (
          <li className="text-sm text-slate-400">Nog niet gedeeld.</li>
        )}
        {shares.map((s) => (
          <li
            key={s.id}
            className="rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-900">
                {s.aanbiederNaam}
              </span>
              <span className="text-xs text-slate-500">
                {STATUS_LABELS[s.status] ?? s.status}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={s.contact_vrijgegeven}
                  disabled={isPending}
                  onChange={() => toggleVrijgave(s)}
                />
                Contactgegevens vrijgeven
              </label>
              <button
                onClick={() => verwijder(s)}
                disabled={isPending}
                className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50"
              >
                Intrekken
              </button>
            </div>
          </li>
        ))}
      </ul>

      {beschikbaar.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <select
            value={keuze}
            onChange={(e) => setKeuze(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">— kies aanbieder —</option>
            {beschikbaar.map((a) => (
              <option key={a.id} value={a.id}>
                {a.naam}
              </option>
            ))}
          </select>
          <button
            onClick={deel}
            disabled={isPending || !keuze}
            className="rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
          >
            Delen
          </button>
        </div>
      )}
    </div>
  );
}
