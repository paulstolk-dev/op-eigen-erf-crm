"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { triggerVideoRender } from "./actions";

export function RenderButton({ conceptCount }: { conceptCount: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [isPending, start] = useTransition();

  function onRender() {
    setMsg("");
    start(async () => {
      const r = await triggerVideoRender();
      if (!r.ok) setMsg(`Render starten mislukt: ${r.error}`);
      else {
        setMsg(
          "Render gestart op de renderserver. Dit duurt enkele minuten — ververs straks om de gerenderde video's te zien.",
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Renderen</h2>
          <p className="mt-1 text-xs text-slate-500">
            Rendert de concept-afleveringen op de renderserver (Railway) en zet ze
            op <em>gerenderd</em> met videopreview.
          </p>
        </div>
        <button
          type="button"
          disabled={isPending || conceptCount === 0}
          onClick={onRender}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isPending
            ? "Starten…"
            : conceptCount === 0
              ? "Geen concepten"
              : `Render ${conceptCount} concept${conceptCount === 1 ? "" : "en"}`}
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
