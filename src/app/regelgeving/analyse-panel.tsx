"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { analyseerWijziging, saveGemeenteVelden } from "./actions";

type Analyse = {
  omgevingsplan_status: string;
  afwijking_richting: string;
  afwijking_samenvatting: string;
  kernparameters?: { label: string; waarde: string }[];
  citaten?: string[];
};

const LABEL = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy";

export function AnalysePanel({
  id,
  gemeenteSlug,
  artikel,
  initial,
}: {
  id: string;
  gemeenteSlug: string;
  artikel: string;
  initial: Analyse | null;
}) {
  const router = useRouter();
  const [analyse, setAnalyse] = useState<Analyse | null>(initial);
  const [status, setStatus] = useState(initial?.omgevingsplan_status ?? "");
  const [richting, setRichting] = useState(initial?.afwijking_richting ?? "");
  const [samenvatting, setSamenvatting] = useState(initial?.afwijking_samenvatting ?? "");
  const [datum, setDatum] = useState("");
  const [msg, setMsg] = useState("");
  const [isAnalyse, startAnalyse] = useTransition();
  const [isSave, startSave] = useTransition();

  function onAnalyseer() {
    setMsg("");
    startAnalyse(async () => {
      const r = await analyseerWijziging(id);
      if (!r.ok || !r.analyse) {
        setMsg(`Analyse mislukt: ${r.error}`);
        return;
      }
      const a = r.analyse;
      setAnalyse(a);
      setStatus(a.omgevingsplan_status);
      setRichting(a.afwijking_richting);
      setSamenvatting(a.afwijking_samenvatting);
      router.refresh();
    });
  }

  function onOpslaan() {
    setMsg("");
    startSave(async () => {
      const r = await saveGemeenteVelden(gemeenteSlug, {
        omgevingsplan_status: status,
        afwijking_richting: richting,
        afwijking_samenvatting: samenvatting,
        omgevingsplan_wijziging_datum: datum || undefined,
      });
      setMsg(r.ok ? "Opgeslagen naar de gemeente + publieke site gerevalideerd." : `Opslaan mislukt: ${r.error}`);
      if (r.ok) router.refresh();
    });
  }

  if (!analyse) {
    return (
      <div className="mt-3 border-t border-slate-100 pt-3">
        <button
          type="button"
          disabled={isAnalyse}
          onClick={onAnalyseer}
          className="rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isAnalyse ? "Claude leest de regeltekst…" : "✨ Analyseer met AI"}
        </button>
        <p className="mt-1.5 text-xs text-slate-400">
          Haalt de échte artikeltekst op ({artikel}) en stelt de gemeente-inhoud voor.
        </p>
        {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={LABEL}>Omgevingsplan-status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={INPUT}>
            <option value="">—</option>
            <option value="ongewijzigd">Ongewijzigd (bruidsschat)</option>
            <option value="gewijzigd">Gewijzigd</option>
            <option value="verplaatst">Verplaatst</option>
            <option value="onbekend">Onbekend</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Afwijking-richting</label>
          <select value={richting} onChange={(e) => setRichting(e.target.value)} className={INPUT}>
            <option value="">—</option>
            <option value="soepeler">Soepeler</option>
            <option value="strenger">Strenger</option>
            <option value="gelijk">Gelijk</option>
            <option value="onbekend">Onbekend</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Wijzigingsdatum</label>
          <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className={INPUT} />
        </div>
      </div>

      <div>
        <label className={LABEL}>Samenvatting (publiek)</label>
        <textarea
          value={samenvatting}
          onChange={(e) => setSamenvatting(e.target.value)}
          rows={2}
          className={INPUT}
        />
      </div>

      {analyse.kernparameters && analyse.kernparameters.length > 0 && (
        <div className="rounded-lg bg-slate-50 p-3">
          <div className={LABEL}>Kernparameters (uit de tekst)</div>
          <ul className="space-y-0.5 text-sm text-slate-700">
            {analyse.kernparameters.map((p, i) => (
              <li key={i}>
                <span className="text-slate-500">{p.label}:</span> {p.waarde}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analyse.citaten && analyse.citaten.length > 0 && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-medium">Citaten uit de bron ({analyse.citaten.length})</summary>
          <ul className="mt-1 space-y-1">
            {analyse.citaten.map((c, i) => (
              <li key={i} className="border-l-2 border-slate-200 pl-2 italic">
                “{c}”
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isSave}
          onClick={onOpslaan}
          className="rounded-lg bg-erf px-3 py-1.5 text-sm font-medium text-white transition hover:bg-erf-700 disabled:opacity-50"
        >
          {isSave ? "Opslaan…" : "Opslaan naar gemeente"}
        </button>
        <button
          type="button"
          disabled={isAnalyse}
          onClick={onAnalyseer}
          className="text-xs font-medium text-slate-500 hover:text-navy disabled:opacity-50"
        >
          {isAnalyse ? "Bezig…" : "Opnieuw analyseren"}
        </button>
      </div>
      {msg && (
        <p className={`text-sm ${msg.includes("mislukt") ? "text-red-600" : "text-green-600"}`}>{msg}</p>
      )}
    </div>
  );
}
