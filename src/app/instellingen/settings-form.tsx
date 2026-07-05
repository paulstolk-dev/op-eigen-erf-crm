"use client";

import { useState, useTransition } from "react";
import { saveEmailPrompt } from "./actions";

export function EmailPromptForm({
  initial,
  defaultPrompt,
}: {
  initial: string;
  defaultPrompt: string;
}) {
  const [value, setValue] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveEmailPrompt(value);
      setMsg(
        res.ok
          ? { ok: true, text: "Opgeslagen." }
          : { ok: false, text: res.error ?? "Mislukt." },
      );
    });
  }

  return (
    <div className="space-y-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={16}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-slate-900"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isPending ? "Opslaan…" : "Opslaan"}
        </button>
        <button
          type="button"
          onClick={() => setValue(defaultPrompt)}
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Standaard terugzetten
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
