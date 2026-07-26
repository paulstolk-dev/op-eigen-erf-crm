"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePaginaSeo } from "./actions";
import { SITE_PAGINAS, SITE_PAGINA_GROEPEN } from "@/lib/site-paginas";

export type PaginaSeoRow = {
  pad: string;
  seo_titel: string | null;
  meta_description: string | null;
  updated_at: string;
};

// Aanbevolen lengtes (Google kapt ongeveer hier af).
const TITEL_MAX = 60;
const DESC_MAX = 155;

function Teller({ n, max }: { n: number; max: number }) {
  return (
    <span className={`text-[11px] tabular-nums ${n > max ? "text-red-600" : "text-slate-400"}`}>
      {n}/{max}
    </span>
  );
}

function PaginaRij({
  pad,
  label,
  initialTitel,
  initialDesc,
  open,
  onToggle,
}: {
  pad: string;
  label: string;
  initialTitel: string;
  initialDesc: string;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [titel, setTitel] = useState(initialTitel);
  const [desc, setDesc] = useState(initialDesc);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const gewijzigd = titel !== initialTitel || desc !== initialDesc;
  const heeftOverride = Boolean(initialTitel || initialDesc);

  function opslaan() {
    setMsg("");
    start(async () => {
      const r = await savePaginaSeo(pad, titel, desc);
      setMsg(r.ok ? "Opgeslagen." : (r.error ?? "Opslaan mislukt."));
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Kop: altijd zichtbaar, klikbaar om uit te klappen. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-900">{label}</span>
          <code className="hidden shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 sm:inline">
            {pad}
          </code>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {heeftOverride && (
            <span className="rounded-full bg-erf/10 px-2 py-0.5 text-[11px] font-medium text-erf">
              ingevuld
            </span>
          )}
          <svg
            viewBox="0 0 20 20"
            className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {/* Uitklap: de invoer. Blijft gemount (state behouden), alleen verborgen. */}
      {open && (
        <div className="border-t border-slate-100 p-4">
          <label className="block">
            <span className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">SEO-titel</span>
              <Teller n={titel.length} max={TITEL_MAX} />
            </span>
            <input
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Leeg = hardcoded titel van de pagina"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </label>

          <label className="mt-2 block">
            <span className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Meta-description</span>
              <Teller n={desc.length} max={DESC_MAX} />
            </span>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="Leeg = hardcoded description van de pagina"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </label>

          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              disabled={pending || !gewijzigd}
              onClick={opslaan}
              className="rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-40"
            >
              {pending ? "Opslaan…" : "Opslaan"}
            </button>
            {msg && (
              <span className={`text-xs ${msg.includes("mislukt") ? "text-red-600" : "text-green-600"}`}>
                {msg}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PaginaSeoEditor({ rows }: { rows: PaginaSeoRow[] }) {
  const byPad = new Map(rows.map((r) => [r.pad, r]));
  const [openPad, setOpenPad] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">SEO per pagina</h2>
      <p className="mb-4 mt-0.5 text-xs text-slate-500">
        Klik een pagina open om de titel + meta-description in te voeren. Leeg
        laten = de pagina gebruikt zijn eigen (hardcoded) waarde. Opslaan ververst
        de betreffende pagina op de site.
      </p>

      <div className="space-y-6">
        {SITE_PAGINA_GROEPEN.map((groep) => {
          const paginas = SITE_PAGINAS.filter((p) => p.groep === groep);
          if (paginas.length === 0) return null;
          return (
            <div key={groep}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {groep}
              </h3>
              <div className="space-y-2">
                {paginas.map((p) => {
                  const ov = byPad.get(p.pad);
                  return (
                    <PaginaRij
                      key={p.pad}
                      pad={p.pad}
                      label={p.label}
                      initialTitel={ov?.seo_titel ?? ""}
                      initialDesc={ov?.meta_description ?? ""}
                      open={openPad === p.pad}
                      onToggle={() => setOpenPad((cur) => (cur === p.pad ? null : p.pad))}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
