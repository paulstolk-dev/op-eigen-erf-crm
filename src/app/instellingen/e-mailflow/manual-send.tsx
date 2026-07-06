"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verstuurNurtureNu } from "./actions";

export function ManualSend() {
  const router = useRouter();
  const [force, setForce] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function verstuur() {
    const bevestiging = force
      ? "De eerstvolgende opvolgstap NU naar alle in-aanmerking-komende leads sturen (wachttijd genegeerd)?"
      : "De opvolgmails versturen die nu aan de beurt zijn (volgens de ingestelde dagen)?";
    if (!confirm(bevestiging)) return;
    setMsg(null);
    startTransition(async () => {
      const res = await verstuurNurtureNu(force);
      setMsg(
        res.ok
          ? { ok: true, text: `${res.verstuurd ?? 0} mail(s) verstuurd.` }
          : { ok: false, text: res.error ?? "Mislukt." },
      );
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">Handmatig versturen</h2>
      <p className="mt-1 text-sm text-slate-500">
        Verstuur de opvolgmails nu, zonder te wachten op de dagelijkse cron. Er gaat
        per lead maximaal één stap uit; al verzonden stappen worden overgeslagen.
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
        Negeer de wachttijd (stuur de eerstvolgende stap direct)
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={verstuur}
          disabled={isPending}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isPending ? "Versturen…" : "Verstuur opvolgmails nu"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
