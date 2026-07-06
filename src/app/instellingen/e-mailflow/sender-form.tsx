"use client";

import { useState, useTransition } from "react";
import { saveSender } from "./actions";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";
const label = "block text-xs font-medium text-slate-600 mb-1";

export function SenderForm({
  from,
  replyTo,
  bcc,
}: {
  from: string;
  replyTo: string;
  bcc: string;
}) {
  const [f, setF] = useState({ from, replyTo, bcc });
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveSender(f.from, f.replyTo, f.bcc);
      setMsg(res.ok ? { ok: true, text: "Opgeslagen." } : { ok: false, text: res.error ?? "Mislukt." });
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={label}>Afzender</label>
        <input
          className={input}
          value={f.from}
          onChange={(e) => setF((p) => ({ ...p, from: e.target.value }))}
          placeholder="Paul van OpEigenErf <paul@opeigenerf.nl>"
        />
        <p className="mt-1 text-xs text-slate-400">
          Formaat: <code>Naam &lt;adres@opeigenerf.nl&gt;</code>. Gebruik een
          geverifieerd domein (opeigenerf.nl), geen noreply@.
        </p>
      </div>
      <div>
        <label className={label}>Reply-to (antwoorden komen hier binnen)</label>
        <input
          className={input}
          value={f.replyTo}
          onChange={(e) => setF((p) => ({ ...p, replyTo: e.target.value }))}
          placeholder="info@opeigenerf.nl"
        />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>BCC (kopie van elke opvolgmail)</label>
        <input
          className={input}
          value={f.bcc}
          onChange={(e) => setF((p) => ({ ...p, bcc: e.target.value }))}
          placeholder="info@opeigenerf.nl"
        />
        <p className="mt-1 text-xs text-slate-400">
          Laat leeg om geen BCC mee te sturen.
        </p>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isPending ? "Opslaan…" : "Afzender opslaan"}
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
