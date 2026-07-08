"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateSocials } from "./actions";

export function GenerateForm() {
  const router = useRouter();
  const [aantal, setAantal] = useState(3);
  const [thema, setThema] = useState("");
  const [msg, setMsg] = useState("");
  const [isPending, start] = useTransition();

  function onGenerate() {
    setMsg("");
    start(async () => {
      const r = await generateSocials(aantal, thema);
      if (!r.ok) setMsg(`Genereren mislukt: ${r.error}`);
      else {
        setMsg(`${aantal} concept-aflevering(en) toegevoegd.`);
        setThema("");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">Nieuwe afleveringen genereren</h2>
      <p className="mt-1 text-xs text-slate-500">
        Claude schrijft merkvaste regelgeving-shorts (met verplichte bron + &quot;nog niet
        definitief&quot;-markering). Ze komen als <em>concept</em> in de wachtrij.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Aantal
          </label>
          <input
            type="number"
            min={1}
            max={5}
            value={aantal}
            onChange={(e) => setAantal(Number(e.target.value))}
            className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy"
          />
        </div>
        <div className="min-w-[16rem] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Thema (optioneel)
          </label>
          <input
            value={thema}
            onChange={(e) => setThema(e.target.value)}
            placeholder="Bijv. 'vergunningvrij op het achtererf' — leeg = Claude kiest"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy"
          />
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={onGenerate}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isPending ? "Claude schrijft…" : "Genereer"}
        </button>
      </div>
      {msg && (
        <p className={`mt-3 text-sm ${msg.includes("mislukt") ? "text-red-600" : "text-green-600"}`}>
          {msg}
        </p>
      )}
    </div>
  );
}
