"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setGemeenteVhpStatus, analyseerVhpWijziging } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  onbekend: "Onbekend",
  niet_vastgesteld: "Niet vastgesteld",
  in_voorbereiding: "In voorbereiding",
  vastgesteld: "Vastgesteld",
};

type Analyse = {
  vastgesteld: string;
  vaststelling_datum?: string;
  noemt_mantelzorg_familie: boolean;
  mantelzorg_familie_samenvatting: string;
  lokale_bijzonderheden: string;
  welstand_beschermd: string;
  citaten?: string[];
};

/**
 * Paneel per VHP-signaal: (1) zet de readinessstatus van de gemeente en (2) analyseer
 * de publicatie met AI (is het vastgesteld + staan er afwijkende zaken in). Beide
 * redactioneel/mens-gestuurd; de analyse is een concept.
 */
export function VhpPanel({
  gemeenteSlug,
  current,
  datum,
  bronUrl,
  wijzigingId,
  initialAnalyse,
}: {
  gemeenteSlug: string;
  current: string;
  datum?: string | null;
  bronUrl?: string | null;
  wijzigingId: string;
  initialAnalyse: Analyse | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(current || "onbekend");
  const [analyse, setAnalyse] = useState<Analyse | null>(initialAnalyse);
  const [isStatus, startStatus] = useTransition();
  const [isAnalyse, startAnalyse] = useTransition();
  const [msg, setMsg] = useState("");

  function apply(next: string) {
    setStatus(next);
    setMsg("");
    startStatus(async () => {
      const r = await setGemeenteVhpStatus(gemeenteSlug, next, {
        vastgesteldOp: datum ?? null,
        bronUrl: bronUrl ?? null,
        wijzigingId,
      });
      if (r.ok) {
        setMsg("✓ status gezet");
        router.refresh();
      } else {
        setMsg(r.error ?? "mislukt");
        setStatus(current || "onbekend");
      }
    });
  }

  function analyseer() {
    setMsg("");
    startAnalyse(async () => {
      const r = await analyseerVhpWijziging(wijzigingId);
      if (r.ok && r.analyse) {
        setAnalyse(r.analyse);
        router.refresh();
      } else {
        setMsg(`Analyse mislukt: ${r.error}`);
      }
    });
  }

  return (
    <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-400">VHP-status van gemeente:</span>
        <select
          value={status}
          disabled={isStatus}
          onChange={(e) => apply(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 font-medium text-slate-700 outline-none focus:border-navy disabled:opacity-50"
        >
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {!analyse && (
          <button
            type="button"
            disabled={isAnalyse}
            onClick={analyseer}
            className="rounded-md bg-navy px-2.5 py-1 font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
          >
            {isAnalyse ? "Claude leest het VHP…" : "✨ Analyseer VHP"}
          </button>
        )}
        {msg && (
          <span className={msg.startsWith("✓") ? "text-green-600" : "text-red-600"}>{msg}</span>
        )}
      </div>

      {analyse && (
        <div className="space-y-1.5 rounded-lg bg-slate-50 p-3 text-slate-700">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 font-semibold ${
                analyse.vastgesteld === "ja"
                  ? "bg-green-100 text-green-800"
                  : analyse.vastgesteld === "nee"
                    ? "bg-violet-100 text-violet-800"
                    : "bg-slate-200 text-slate-600"
              }`}
            >
              Vastgesteld: {analyse.vastgesteld}
            </span>
            {analyse.vaststelling_datum && (
              <span className="text-slate-500">datum: {analyse.vaststelling_datum}</span>
            )}
            <button
              type="button"
              disabled={isAnalyse}
              onClick={analyseer}
              className="ml-auto text-[11px] font-medium text-slate-400 hover:text-navy disabled:opacity-50"
            >
              {isAnalyse ? "Bezig…" : "opnieuw"}
            </button>
          </div>
          <p>
            <span className="font-semibold text-slate-500">Mantelzorg/familie:</span>{" "}
            {analyse.mantelzorg_familie_samenvatting}
          </p>
          <p>
            <span className="font-semibold text-slate-500">Lokale bijzonderheden:</span>{" "}
            {analyse.lokale_bijzonderheden}
          </p>
          <p>
            <span className="font-semibold text-slate-500">Welstand/beschermd:</span>{" "}
            {analyse.welstand_beschermd}
          </p>
          {analyse.citaten && analyse.citaten.length > 0 && (
            <details className="text-[11px] text-slate-500">
              <summary className="cursor-pointer font-medium">
                Citaten uit de bron ({analyse.citaten.length})
              </summary>
              <ul className="mt-1 space-y-1">
                {analyse.citaten.map((c, i) => (
                  <li key={i} className="border-l-2 border-slate-200 pl-2 italic">
                    “{c}”
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="text-[11px] text-slate-400">
            Concept-analyse — beoordeel zelf en zet hierboven de VHP-status.
          </p>
        </div>
      )}
    </div>
  );
}
