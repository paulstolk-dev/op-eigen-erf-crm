"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProps } from "../actions";
import type { RegelgevingProps } from "@/lib/socials";

const LABEL = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";
const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy";

export function PropsEditor({ id, props }: { id: string; props: RegelgevingProps }) {
  const router = useRouter();
  const [kicker, setKicker] = useState(props.kicker ?? "");
  const [titel, setTitel] = useState(props.titel ?? "");
  const [scenes, setScenes] = useState(
    props.scenes?.length ? props.scenes : [{ kop: "", tekst: "" }],
  );
  const [nogNietDefinitief, setNogNiet] = useState(Boolean(props.nogNietDefinitief));
  const [bron, setBron] = useState(props.bron ?? "");
  const [laatstBijgewerkt, setLaatst] = useState(props.laatstBijgewerkt ?? "");
  const [cta, setCta] = useState(props.cta ?? "");
  const [msg, setMsg] = useState("");
  const [isPending, start] = useTransition();

  function setScene(i: number, patch: Partial<{ kop: string; tekst: string }>) {
    setScenes((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addScene() {
    setScenes((cur) => (cur.length >= 4 ? cur : [...cur, { kop: "", tekst: "" }]));
  }
  function removeScene(i: number) {
    setScenes((cur) => (cur.length <= 1 ? cur : cur.filter((_, idx) => idx !== i)));
  }

  function onSave() {
    setMsg("");
    start(async () => {
      const r = await saveProps(id, {
        kicker,
        titel,
        scenes: scenes.map((s) => ({ kop: s.kop.trim(), tekst: s.tekst.trim() })),
        nogNietDefinitief,
        bron,
        laatstBijgewerkt,
        cta,
      });
      if (!r.ok) setMsg(`Opslaan mislukt: ${r.error}`);
      else {
        setMsg("Opzet opgeslagen — status terug op 'concept'. Render opnieuw op /socials om de nieuwe video te maken.");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Video-opzet
        </span>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={nogNietDefinitief}
            onChange={(e) => setNogNiet(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300"
          />
          ⚠ nog niet definitief
        </label>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Kicker</label>
            <input value={kicker} onChange={(e) => setKicker(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Peil (bijv. jul 2026)</label>
            <input
              value={laatstBijgewerkt}
              onChange={(e) => setLaatst(e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        <div>
          <label className={LABEL}>Titel</label>
          <input value={titel} onChange={(e) => setTitel(e.target.value)} className={INPUT} />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className={LABEL + " mb-0"}>Scenes ({scenes.length}/4)</span>
            <button
              type="button"
              onClick={addScene}
              disabled={scenes.length >= 4}
              className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            >
              + Scene
            </button>
          </div>
          <div className="space-y-3">
            {scenes.map((s, i) => (
              <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-erf/15 text-xs font-bold text-erf">
                    {i + 1}
                  </span>
                  <input
                    value={s.kop}
                    onChange={(e) => setScene(i, { kop: e.target.value })}
                    placeholder="Scene-kop (2-4 woorden)"
                    className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-navy"
                  />
                  <button
                    type="button"
                    onClick={() => removeScene(i)}
                    disabled={scenes.length <= 1}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-30"
                    title="Scene verwijderen"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  value={s.tekst}
                  onChange={(e) => setScene(i, { tekst: e.target.value })}
                  rows={2}
                  placeholder="Feitelijke uitleg, ≤ 18 woorden"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-navy"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className={LABEL}>Bron (verplicht, concreet)</label>
          <input value={bron} onChange={(e) => setBron(e.target.value)} className={INPUT} />
        </div>

        <div>
          <label className={LABEL}>CTA</label>
          <input value={cta} onChange={(e) => setCta(e.target.value)} className={INPUT} />
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={onSave}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isPending ? "Opslaan…" : "Opzet opslaan"}
        </button>
        {msg && (
          <p className={`text-sm ${msg.includes("mislukt") ? "text-red-600" : "text-green-600"}`}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
