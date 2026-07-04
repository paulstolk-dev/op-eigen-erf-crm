"use client";

import { useState, useTransition } from "react";
import { setAanbiederUserStatus } from "../toegang-actions";

const STATUS_LABELS: Record<string, string> = {
  pending: "In behandeling",
  approved: "Goedgekeurd",
  geweigerd: "Afgewezen",
};
const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 ring-amber-600/20",
  approved: "bg-green-100 text-green-700 ring-green-600/20",
  geweigerd: "bg-red-100 text-red-700 ring-red-600/20",
};

export function AccessRow({
  userId,
  email,
  aanbiederNaam,
  bericht,
  status,
  aangevraagd,
}: {
  userId: string;
  email: string | null;
  aanbiederNaam: string;
  bericht: string | null;
  status: string;
  aangevraagd: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(status);

  function update(next: "approved" | "geweigerd" | "pending") {
    setError(null);
    startTransition(async () => {
      const res = await setAanbiederUserStatus(userId, next);
      if (!res.ok) {
        setError(res.error ?? "Er ging iets mis.");
        return;
      }
      setCurrent(next);
    });
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">{aanbiederNaam}</div>
        <div className="text-xs text-slate-500">{email}</div>
        {bericht && (
          <div className="mt-1 max-w-md text-xs italic text-slate-400">
            “{bericht}”
          </div>
        )}
      </td>
      <td className="hidden px-4 py-3 text-sm text-slate-500 sm:table-cell">
        {new Date(aangevraagd).toLocaleDateString("nl-NL", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
            STATUS_STYLES[current] ?? STATUS_STYLES.pending
          }`}
        >
          {STATUS_LABELS[current] ?? current}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {current !== "approved" && (
            <button
              onClick={() => update("approved")}
              disabled={isPending}
              className="rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
            >
              Goedkeuren
            </button>
          )}
          {current !== "geweigerd" && (
            <button
              onClick={() => update("geweigerd")}
              disabled={isPending}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              Afwijzen
            </button>
          )}
          {current !== "pending" && (
            <button
              onClick={() => update("pending")}
              disabled={isPending}
              className="text-sm text-slate-400 hover:text-slate-700 disabled:opacity-50"
            >
              Reset
            </button>
          )}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </td>
    </tr>
  );
}
