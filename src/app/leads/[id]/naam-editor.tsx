"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLeadNaam } from "../actions";

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";
const label = "text-xs uppercase tracking-wide text-slate-400";

export function NaamEditor({
  leadId,
  voornaam,
  achternaam,
}: {
  leadId: string;
  voornaam: string | null;
  achternaam: string | null;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [vn, setVn] = useState(voornaam ?? "");
  const [an, setAn] = useState(achternaam ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function opslaan() {
    setError(null);
    startTransition(async () => {
      const res = await updateLeadNaam(leadId, vn, an);
      if (res.ok) {
        setEdit(false);
        router.refresh();
      } else {
        setError(res.error ?? "Opslaan mislukt.");
      }
    });
  }

  function annuleer() {
    setVn(voornaam ?? "");
    setAn(achternaam ?? "");
    setError(null);
    setEdit(false);
  }

  if (!edit) {
    return (
      <div className="col-span-2 flex items-start justify-between gap-4">
        <div className="grid flex-1 grid-cols-2 gap-4">
          <div>
            <dt className={label}>Voornaam</dt>
            <dd className="mt-0.5 text-sm text-slate-900">{voornaam || "—"}</dd>
          </div>
          <div>
            <dt className={label}>Achternaam</dt>
            <dd className="mt-0.5 text-sm text-slate-900">{achternaam || "—"}</dd>
          </div>
        </div>
        <button
          onClick={() => setEdit(true)}
          className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Naam bewerken
        </button>
      </div>
    );
  }

  return (
    <div className="col-span-2 grid grid-cols-2 gap-4">
      <div>
        <label className={label}>Voornaam</label>
        <input
          className={`${inp} mt-0.5`}
          value={vn}
          onChange={(e) => setVn(e.target.value)}
          placeholder="Voornaam"
          autoFocus
        />
      </div>
      <div>
        <label className={label}>Achternaam</label>
        <input
          className={`${inp} mt-0.5`}
          value={an}
          onChange={(e) => setAn(e.target.value)}
          placeholder="Achternaam"
        />
      </div>
      <div className="col-span-2 flex items-center gap-2">
        <button
          onClick={opslaan}
          disabled={isPending}
          className="rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isPending ? "Opslaan…" : "Opslaan"}
        </button>
        <button
          onClick={annuleer}
          disabled={isPending}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Annuleren
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
