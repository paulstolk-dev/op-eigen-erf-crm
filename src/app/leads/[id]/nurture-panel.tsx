"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verstuurNurtureVoorLead } from "../actions";

export function NurturePanel({
  leadId,
  nextStep,
  delivered,
  uitFlow,
}: {
  leadId: string;
  nextStep: string | null; // bv. "E1"; null = afgerond
  delivered: boolean; // rapport verstuurd?
  uitFlow: boolean; // gewonnen/verloren
}) {
  const router = useRouter();
  const [force, setForce] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function verstuur() {
    if (
      !confirm(
        force
          ? `De volgende opvolgmail (${nextStep}) nu naar deze lead sturen, ongeacht de wachttijd?`
          : `De volgende opvolgmail (${nextStep}) versturen als die volgens de dagen aan de beurt is?`,
      )
    )
      return;
    setMsg(null);
    startTransition(async () => {
      const res = await verstuurNurtureVoorLead(leadId, force);
      setMsg(
        res.ok
          ? {
              ok: true,
              text: res.verstuurd
                ? "Verstuurd."
                : "Niets verstuurd (nog niet aan de beurt of al gehad).",
            }
          : { ok: false, text: res.error ?? "Mislukt." },
      );
      if (res.ok && res.verstuurd) router.refresh();
    });
  }

  if (!delivered) {
    return (
      <p className="text-sm text-slate-500">
        De opvolg-reeks start zodra je het rapport naar deze lead verstuurt.
      </p>
    );
  }
  if (uitFlow) {
    return (
      <p className="text-sm text-slate-500">
        Lead is uit de flow (status gewonnen of verloren).
      </p>
    );
  }
  if (!nextStep) {
    return <p className="text-sm text-green-600">Alle opvolgmails zijn verstuurd.</p>;
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-700">
        Volgende stap:{" "}
        <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-medium text-navy">
          {nextStep}
        </span>
      </p>
      <label className="mb-3 flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
        Negeer de wachttijd (verstuur direct)
      </label>
      <button
        onClick={verstuur}
        disabled={isPending}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {isPending ? "Versturen…" : "Verstuur volgende stap"}
      </button>
      {msg && (
        <p className={`mt-2 text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
