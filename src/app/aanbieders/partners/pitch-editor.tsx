"use client";

import { useState, useTransition } from "react";
import { savePartnerSequence } from "../partner-actions";

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";
const label = "block text-xs font-medium text-slate-600 mb-1";

type Step = { subject: string; body: string; ctaLabel: string; ctaUrl: string };

function StepFields({
  n,
  title,
  step,
  onChange,
}: {
  n: number;
  title: string;
  step: Step;
  onChange: (s: Step) => void;
}) {
  const set = <K extends keyof Step>(k: K, v: string) => onChange({ ...step, [k]: v });
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 text-sm font-semibold text-slate-900">
        Mail {n} <span className="font-normal text-slate-400">— {title}</span>
      </div>
      <div className="space-y-3">
        <div>
          <label className={label}>Onderwerp</label>
          <input className={inp} value={step.subject} onChange={(e) => set("subject", e.target.value)} />
        </div>
        <div>
          <label className={label}>Body</label>
          <textarea
            rows={12}
            className={`${inp} font-mono text-xs leading-relaxed`}
            value={step.body}
            onChange={(e) => set("body", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Knop — tekst (leeg = geen knop)</label>
            <input className={inp} value={step.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} />
          </div>
          <div>
            <label className={label}>Knop — URL</label>
            <input className={inp} value={step.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PitchEditor({
  step1,
  step2,
  step3,
  delay2,
  delay3,
}: {
  step1: Step;
  step2: Step;
  step3: Step;
  delay2: number;
  delay3: number;
}) {
  const [s1, setS1] = useState(step1);
  const [s2, setS2] = useState(step2);
  const [s3, setS3] = useState(step3);
  const [d2, setD2] = useState(String(delay2));
  const [d3, setD3] = useState(String(delay3));
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await savePartnerSequence({
        step1: s1,
        step2: s2,
        step3: s3,
        delay2: d2,
        delay3: d3,
      });
      setMsg(res.ok ? { ok: true, text: "Opgeslagen." } : { ok: false, text: res.error ?? "Mislukt." });
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Mail 1 stuur je handmatig per aanbieder (knop &quot;Pitch sturen&quot;). Mail 2 en 3 gaan
        daarna automatisch — mits de aanbieder nog op status <strong>Benaderd</strong> staat. Zodra
        je iemand op Geïnteresseerd, Partner of Afgewezen zet, stopt de reeks.
      </p>

      <StepFields n={1} title="eerste pitch (handmatig)" step={s1} onChange={setS1} />

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <label className={label}>Wachttijd vóór mail 2 — dagen na mail 1</label>
        <input
          type="number"
          min={0}
          className={`${inp} w-32 bg-white`}
          value={d2}
          onChange={(e) => setD2(e.target.value)}
        />
      </div>

      <StepFields n={2} title="update + nogmaals beeldmateriaal" step={s2} onChange={setS2} />

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <label className={label}>Wachttijd vóór mail 3 — dagen na mail 2</label>
        <input
          type="number"
          min={0}
          className={`${inp} w-32 bg-white`}
          value={d3}
          onChange={(e) => setD3(e.target.value)}
        />
      </div>

      <StepFields n={3} title="kennismaking preferred partners" step={s3} onChange={setS3} />

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isPending ? "Opslaan…" : "Sequence opslaan"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>
        )}
      </div>
      <p className="text-xs text-slate-400">
        Merge-velden: <code className="text-slate-600">{"{{aanbieder_naam}}"}</code>{" "}
        <code className="text-slate-600">{"{{contact_naam}}"}</code>
      </p>
    </div>
  );
}
