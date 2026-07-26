"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePaginaSeo, deletePaginaSeo } from "./actions";

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
    <span className={`text-[11px] ${n > max ? "text-red-600" : "text-slate-400"}`}>
      {n}/{max}
    </span>
  );
}

function RijEditor({
  initialPad,
  initialTitel,
  initialDesc,
  isNew,
  onDone,
}: {
  initialPad: string;
  initialTitel: string;
  initialDesc: string;
  isNew: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pad, setPad] = useState(initialPad);
  const [titel, setTitel] = useState(initialTitel);
  const [desc, setDesc] = useState(initialDesc);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  function opslaan() {
    setMsg("");
    start(async () => {
      const r = await savePaginaSeo(pad, titel, desc);
      if (!r.ok) {
        setMsg(r.error ?? "Opslaan mislukt.");
        return;
      }
      if (isNew) {
        setPad("");
        setTitel("");
        setDesc("");
      }
      router.refresh();
      onDone();
    });
  }

  function verwijderen() {
    setMsg("");
    start(async () => {
      const r = await deletePaginaSeo(initialPad);
      if (!r.ok) {
        setMsg(r.error ?? "Verwijderen mislukt.");
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid gap-3">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Pad
          </span>
          <input
            value={pad}
            onChange={(e) => setPad(e.target.value)}
            readOnly={!isNew}
            placeholder="/aanbieders"
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-slate-900 ${
              isNew ? "border-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          />
        </label>
        <label className="block">
          <span className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              SEO-titel
            </span>
            <Teller n={titel.length} max={TITEL_MAX} />
          </span>
          <input
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder="Laat leeg om de hardcoded titel te gebruiken"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <label className="block">
          <span className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Meta-description
            </span>
            <Teller n={desc.length} max={DESC_MAX} />
          </span>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            placeholder="Laat leeg om de hardcoded description te gebruiken"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={opslaan}
          className="rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {pending ? "Opslaan…" : isNew ? "Toevoegen" : "Opslaan"}
        </button>
        {!isNew && (
          <button
            type="button"
            disabled={pending}
            onClick={verwijderen}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            Verwijderen
          </button>
        )}
        {msg && <span className="text-sm text-red-600">{msg}</span>}
      </div>
    </div>
  );
}

export function PaginaSeoEditor({ rows }: { rows: PaginaSeoRow[] }) {
  const [nonce, setNonce] = useState(0);
  const done = () => setNonce((n) => n + 1);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">SEO per pagina</h2>
      <p className="mb-4 mt-0.5 text-xs text-slate-500">
        Per-pagina overrides voor de <strong>titel</strong> en{" "}
        <strong>meta-description</strong> op de site. Leeg laten of geen rij =
        de site gebruikt de hardcoded waarde. Het pad is de URL na het domein
        (bijv. <code>/aanbieders</code>, <code>/mantelzorgwoning/40m2</code>).
      </p>

      <div className="mb-4">
        <RijEditor
          key={`new-${nonce}`}
          initialPad=""
          initialTitel=""
          initialDesc=""
          isNew
          onDone={done}
        />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">
          Nog geen overrides. Voeg er hierboven een toe.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <RijEditor
              key={r.pad}
              initialPad={r.pad}
              initialTitel={r.seo_titel ?? ""}
              initialDesc={r.meta_description ?? ""}
              isNew={false}
              onDone={done}
            />
          ))}
        </div>
      )}
    </section>
  );
}
