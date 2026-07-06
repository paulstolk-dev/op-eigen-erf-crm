"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStep, addStep, deleteStep } from "./actions";
import type { EmailSequenceStep } from "@/lib/database.types";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";
const label = "block text-xs font-medium text-slate-600 mb-1";

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function StepCard({ step }: { step: EmailSequenceStep }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [f, setF] = useState({
    dag_na_start: str(step.dag_na_start),
    onderwerp: str(step.onderwerp),
    preview: str(step.preview),
    body: str(step.body),
    cta_primary_label: str(step.cta_primary_label),
    cta_primary_url: str(step.cta_primary_url),
    cta_secondary_label: str(step.cta_secondary_label),
    cta_secondary_url: str(step.cta_secondary_url),
    actief: step.actief,
  });

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveStep(step.id, f);
      setMsg(res.ok ? { ok: true, text: "Opgeslagen." } : { ok: false, text: res.error ?? "Mislukt." });
      if (res.ok) router.refresh();
    });
  }

  function verwijder() {
    if (!confirm(`Stap "${f.onderwerp}" verwijderen?`)) return;
    startTransition(async () => {
      const res = await deleteStep(step.id);
      if (res.ok) router.refresh();
      else setMsg({ ok: false, text: res.error ?? "Mislukt." });
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-500">
            {step.sleutel}
          </span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600">Dag</label>
            <input
              type="number"
              min={0}
              value={f.dag_na_start}
              onChange={(e) => set("dag_na_start", e.target.value)}
              className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm"
            />
            <span className="text-xs text-slate-400">na verzending rapport</span>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={f.actief}
            onChange={(e) => set("actief", e.target.checked)}
          />
          Actief
        </label>
      </div>

      <div className="space-y-3">
        <div>
          <label className={label}>Onderwerp</label>
          <input className={input} value={f.onderwerp} onChange={(e) => set("onderwerp", e.target.value)} />
        </div>
        <div>
          <label className={label}>Preview (preheader)</label>
          <input className={input} value={f.preview} onChange={(e) => set("preview", e.target.value)} />
        </div>
        <div>
          <label className={label}>Body</label>
          <textarea
            rows={10}
            className={`${input} font-mono text-xs leading-relaxed`}
            value={f.body}
            onChange={(e) => set("body", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Primaire knop — tekst</label>
            <input className={input} value={f.cta_primary_label} onChange={(e) => set("cta_primary_label", e.target.value)} />
          </div>
          <div>
            <label className={label}>Primaire knop — URL</label>
            <input className={input} value={f.cta_primary_url} onChange={(e) => set("cta_primary_url", e.target.value)} />
          </div>
          <div>
            <label className={label}>Secundaire link — tekst</label>
            <input className={input} value={f.cta_secondary_label} onChange={(e) => set("cta_secondary_label", e.target.value)} />
          </div>
          <div>
            <label className={label}>Secundaire link — URL</label>
            <input className={input} value={f.cta_secondary_url} onChange={(e) => set("cta_secondary_url", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
        <button
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isPending ? "Opslaan…" : "Opslaan"}
        </button>
        <button
          onClick={verwijder}
          disabled={isPending}
          className="ml-auto text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          Verwijderen
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

export function SequenceEditor({ steps }: { steps: EmailSequenceStep[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function nieuw() {
    startTransition(async () => {
      await addStep();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {steps.map((s) => (
        <StepCard key={s.id} step={s} />
      ))}
      <button
        onClick={nieuw}
        disabled={isPending}
        className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {isPending ? "Toevoegen…" : "+ Stap toevoegen"}
      </button>
    </div>
  );
}
