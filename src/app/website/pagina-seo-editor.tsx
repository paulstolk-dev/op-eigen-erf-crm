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
}: {
  pad: string;
  label: string;
  initialTitel: string;
  initialDesc: string;
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
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{label}</span>
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{pad}</code>
        </div>
        {heeftOverride && (
          <span className="rounded-full bg-erf/10 px-2 py-0.5 text-[11px] font-medium text-erf">
            override actief
          </span>
        )}
      </div>

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
  );
}

export function PaginaSeoEditor({ rows }: { rows: PaginaSeoRow[] }) {
  const byPad = new Map(rows.map((r) => [r.pad, r]));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">SEO per pagina</h2>
      <p className="mb-4 mt-0.5 text-xs text-slate-500">
        Titel + meta-description per pagina op de site. Leeg laten = de pagina
        gebruikt zijn eigen (hardcoded) waarde. Opslaan ververst de betreffende
        pagina op de site.
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
              <div className="space-y-3">
                {paginas.map((p) => {
                  const ov = byPad.get(p.pad);
                  return (
                    <PaginaRij
                      key={p.pad}
                      pad={p.pad}
                      label={p.label}
                      initialTitel={ov?.seo_titel ?? ""}
                      initialDesc={ov?.meta_description ?? ""}
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
