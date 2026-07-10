"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scrapeUrl } from "../research-actions";

export function ScrapeUrl() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [naam, setNaam] = useState("");
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function go() {
    setMsg(null);
    startTransition(async () => {
      const res = await scrapeUrl(url, naam);
      if (res.ok) {
        setMsg({
          ok: true,
          text: res.started
            ? "Gestart — de website wordt gescrapet. Het resultaat verschijnt zo in de lijst (ververs de pagina)."
            : "Gestart, maar er viel niets te verwerken.",
        });
        setUrl("");
        setNaam("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error ?? "Mislukt." });
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[16rem] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Website-URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://voorbeeld.nl"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy"
          />
        </div>
        <div className="w-44">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Naam (optioneel)
          </label>
          <input
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="Aanbiedernaam"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy"
          />
        </div>
        <button
          onClick={go}
          disabled={isPending}
          className="rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isPending ? "Scrapen…" : "Scrape deze website"}
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
      )}
    </div>
  );
}
