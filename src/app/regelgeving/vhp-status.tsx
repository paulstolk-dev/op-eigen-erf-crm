"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setGemeenteVhpStatus } from "./actions";

const LABEL: Record<string, string> = {
  onbekend: "Onbekend",
  niet_vastgesteld: "Niet vastgesteld",
  in_voorbereiding: "In voorbereiding",
  vastgesteld: "Vastgesteld",
};

/**
 * Zet de VHP-readinessstatus van de gemeente vanuit een signaalrij. Bij 'vastgesteld'
 * geven we datum + bron uit het signaal mee; het signaal gaat dan naar 'verwerkt'.
 */
export function VhpStatusControl({
  gemeenteSlug,
  current,
  datum,
  bronUrl,
  wijzigingId,
}: {
  gemeenteSlug: string;
  current: string;
  datum?: string | null;
  bronUrl?: string | null;
  wijzigingId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(current || "onbekend");
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState<string>("");

  function apply(next: string) {
    setStatus(next);
    setMsg("");
    start(async () => {
      const r = await setGemeenteVhpStatus(gemeenteSlug, next, {
        vastgesteldOp: datum ?? null,
        bronUrl: bronUrl ?? null,
        wijzigingId,
      });
      if (r.ok) {
        setMsg("✓ gezet");
        router.refresh();
      } else {
        setMsg(r.error ?? "mislukt");
        setStatus(current || "onbekend");
      }
    });
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 text-xs">
      <span className="text-slate-400">VHP-status van gemeente:</span>
      <select
        value={status}
        disabled={isPending}
        onChange={(e) => apply(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-navy disabled:opacity-50"
      >
        {Object.entries(LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {msg && (
        <span className={msg.startsWith("✓") ? "text-green-600" : "text-red-600"}>{msg}</span>
      )}
    </div>
  );
}
