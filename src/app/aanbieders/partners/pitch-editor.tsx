"use client";

import { useState, useTransition } from "react";
import { savePitch } from "../partner-actions";

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";
const label = "block text-xs font-medium text-slate-600 mb-1";

export function PitchEditor({
  subject,
  body,
  ctaLabel,
  ctaUrl,
}: {
  subject: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}) {
  const [f, setF] = useState({ subject, body, ctaLabel, ctaUrl });
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await savePitch(f.subject, f.body, f.ctaLabel, f.ctaUrl);
      setMsg(res.ok ? { ok: true, text: "Opgeslagen." } : { ok: false, text: res.error ?? "Mislukt." });
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={label}>Onderwerp</label>
        <input className={inp} value={f.subject} onChange={(e) => set("subject", e.target.value)} />
      </div>
      <div>
        <label className={label}>Body</label>
        <textarea
          rows={14}
          className={`${inp} font-mono text-xs leading-relaxed`}
          value={f.body}
          onChange={(e) => set("body", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Knop — tekst</label>
          <input className={inp} value={f.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} />
        </div>
        <div>
          <label className={label}>Knop — URL</label>
          <input className={inp} value={f.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isPending ? "Opslaan…" : "Pitch opslaan"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>
            {msg.text}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400">
        Merge-velden: <code className="text-slate-600">{"{{aanbieder_naam}}"}</code>{" "}
        <code className="text-slate-600">{"{{contact_naam}}"}</code>
      </p>
    </div>
  );
}
