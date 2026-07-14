"use client";

import { useState, useTransition } from "react";
import { saveArtikelPrompt } from "./actions";

export function PromptEditor({ initial }: { initial: string }) {
  const [prompt, setPrompt] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveArtikelPrompt(prompt);
      setMsg(res.ok ? { ok: true, text: "Opgeslagen." } : { ok: false, text: res.error ?? "Mislukt." });
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        De master-prompt (systeemprompt) waarmee Claude per artikel de video maakt:
        tekstlaag, de 3 Veo-beeldprompts en de captions. Het JSON-schema wordt apart
        afgedwongen — schrijf hier alleen de instructies/regels.
      </p>
      <textarea
        rows={20}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-navy"
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
          setMsg(null);
        }}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isPending ? "Opslaan…" : "Prompt opslaan"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}
