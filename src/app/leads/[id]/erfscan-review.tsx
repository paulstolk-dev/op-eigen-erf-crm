"use client";

import { useState, useTransition } from "react";
import { CONCLUSIE_LABELS, CONCLUSIE_STYLES } from "@/lib/constants";
import { saveTier3, setConclusie, rerunErfscan } from "./erfscan-actions";

type Tier3 = {
  bebouwde_kom?: string;
  beschermd_dorpsgezicht?: string;
  zorgvraag?: string;
  vergunningcheck?: string;
  welstand_principeverzoek?: string;
  notitie?: string;
};

const CHECKLIST: {
  key: keyof Tier3;
  label: string;
  options: { value: string; label: string }[];
}[] = [
  {
    key: "bebouwde_kom",
    label: "Bebouwde kom",
    options: [
      { value: "", label: "—" },
      { value: "binnen", label: "Binnen de kom" },
      { value: "buiten", label: "Buiten de kom (max. 100 m²)" },
    ],
  },
  {
    key: "zorgvraag",
    label: "Zorgvraag aanwezig (mantelzorgroute)",
    options: [
      { value: "", label: "—" },
      { value: "ja", label: "Ja" },
      { value: "nee", label: "Nee" },
      { value: "onbekend", label: "Onbekend" },
    ],
  },
  {
    key: "beschermd_dorpsgezicht",
    label: "Beschermd dorpsgezicht / monument",
    options: [
      { value: "", label: "—" },
      { value: "ja", label: "Ja" },
      { value: "nee", label: "Nee" },
      { value: "onbekend", label: "Onbekend" },
    ],
  },
  {
    key: "vergunningcheck",
    label: "Vergunningcheck (Omgevingsloket)",
    options: [
      { value: "", label: "—" },
      { value: "vergunningvrij", label: "Vergunningvrij" },
      { value: "melding", label: "Melding nodig" },
      { value: "vergunning_nodig", label: "Vergunning nodig" },
      { value: "onbekend", label: "Nog niet gedaan" },
    ],
  },
  {
    key: "welstand_principeverzoek",
    label: "Welstand / principeverzoek nodig",
    options: [
      { value: "", label: "—" },
      { value: "ja", label: "Ja" },
      { value: "nee", label: "Nee" },
      { value: "onbekend", label: "Onbekend" },
    ],
  },
];

const CONCLUSIES = ["groen", "oranje", "rood"] as const;

export function ErfscanReview({
  leadId,
  initialTier3,
  initialConclusie,
  leadPostcode,
  leadHuisnummer,
}: {
  leadId: string;
  initialTier3: Record<string, string>;
  initialConclusie: string | null;
  leadPostcode: string;
  leadHuisnummer: string;
}) {
  const [tier3, setTier3] = useState<Tier3>(initialTier3 ?? {});
  const [conclusie, setConcl] = useState<string | null>(initialConclusie);
  const [postcode, setPostcode] = useState(leadPostcode);
  const [huisnummer, setHuisnummer] = useState(leadHuisnummer);
  const [savedMsg, setSavedMsg] = useState("");
  const [rerunMsg, setRerunMsg] = useState("");
  const [isSaving, startSave] = useTransition();
  const [isRerunning, startRerun] = useTransition();

  function update<K extends keyof Tier3>(key: K, value: string) {
    setTier3((t) => ({ ...t, [key]: value }));
  }

  function onSave() {
    setSavedMsg("");
    startSave(async () => {
      await saveTier3(leadId, tier3);
      setSavedMsg("Opgeslagen");
      setTimeout(() => setSavedMsg(""), 2500);
    });
  }

  function onConclusie(c: string) {
    setConcl(c);
    startSave(async () => {
      await setConclusie(leadId, c);
    });
  }

  function onRerun() {
    setRerunMsg("");
    startRerun(async () => {
      const r = await rerunErfscan(leadId, postcode, huisnummer);
      setRerunMsg(
        r.ok
          ? `Erfscan opnieuw gedraaid${r.conclusie ? ` — ${r.conclusie}` : ""}.`
          : `Mislukt: ${r.error}`,
      );
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">
        Beoordeling (mens-in-de-lus)
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        De engine levert Tier 1/2-data; deze punten bepaal jij. Zij wegen mee in
        het eindoordeel en het rapport.
      </p>

      {/* Conclusie */}
      <div className="mb-5">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Eindoordeel
        </span>
        <div className="flex gap-2">
          {CONCLUSIES.map((c) => {
            const active = conclusie === c;
            return (
              <button
                key={c}
                type="button"
                disabled={isSaving}
                onClick={() => onConclusie(c)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition disabled:opacity-50 ${
                  active
                    ? CONCLUSIE_STYLES[c]
                    : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
                }`}
              >
                {CONCLUSIE_LABELS[c]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tier-3 checklist */}
      <div className="space-y-3">
        {CHECKLIST.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-3">
            <label className="text-sm text-slate-700">{f.label}</label>
            <select
              value={tier3[f.key] ?? ""}
              onChange={(e) => update(f.key, e.target.value)}
              className="min-w-[180px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div>
          <label className="mb-1 block text-sm text-slate-700">Notitie</label>
          <textarea
            value={tier3.notitie ?? ""}
            onChange={(e) => update("notitie", e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={isSaving}
          onClick={onSave}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {isSaving ? "Opslaan…" : "Checklist opslaan"}
        </button>
        {savedMsg && <span className="text-sm text-green-600">{savedMsg}</span>}
      </div>

      {/* Opnieuw draaien met adres-correctie */}
      <div className="mt-6 border-t border-slate-100 pt-4">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Erfscan opnieuw draaien
        </span>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Postcode</label>
            <input
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Huisnr.</label>
            <input
              value={huisnummer}
              onChange={(e) => setHuisnummer(e.target.value)}
              className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={isRerunning}
            onClick={onRerun}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {isRerunning ? "Bezig…" : "Opnieuw draaien"}
          </button>
        </div>
        {rerunMsg && (
          <p
            className={`mt-2 text-sm ${
              rerunMsg.startsWith("Mislukt") ? "text-red-600" : "text-green-600"
            }`}
          >
            {rerunMsg}
          </p>
        )}
        <p className="mt-1 text-xs text-slate-400">
          Adres afwijkend van de lead? Corrigeer hierboven en draai opnieuw — de
          lead zelf blijft ongewijzigd.
        </p>
      </div>
    </div>
  );
}
