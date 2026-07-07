"use client";

import { useState, useTransition } from "react";
import { submitContact } from "./actions";
import { KENNISMAKING_URL } from "@/lib/erfcheck-report";

export function AfspraakForm({
  token,
  telefoon,
}: {
  token: string;
  telefoon: string | null;
}) {
  const [tel, setTel] = useState(telefoon ?? "");
  const [notitie, setNotitie] = useState("");
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function verstuur() {
    setError(null);
    startTransition(async () => {
      const res = await submitContact(token, tel, notitie);
      if (res.ok) setDone(true);
      else setError(res.error ?? "Er ging iets mis.");
    });
  }

  if (done) {
    return (
      <div className="rounded-xl bg-erf/10 p-5 text-center ring-1 ring-inset ring-erf/30">
        <p className="text-lg font-semibold text-navy">Bedankt — we bellen je snel!</p>
        <p className="mt-1 text-sm text-slate-600">
          Je verzoek is doorgestuurd naar het team van opeigenerf.nl.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-navy">
        Zullen we je erf samen doornemen?
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Laat je nummer achter — we bellen je voor een gratis, vrijblijvend gesprek over
        wat er op jóuw erf kan.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Telefoonnummer
          </label>
          <input
            type="tel"
            inputMode="tel"
            value={tel}
            onChange={(e) => setTel(e.target.value)}
            placeholder="06 12345678"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-navy"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Voorkeursmoment of vraag (optioneel)
          </label>
          <textarea
            value={notitie}
            onChange={(e) => setNotitie(e.target.value)}
            rows={2}
            placeholder="Bijv. 'liefst 's avonds' of een korte vraag"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy"
          />
        </div>
        <button
          onClick={verstuur}
          disabled={isPending}
          className="w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isPending ? "Versturen…" : "Bel mij terug"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-center text-xs text-slate-400">
          Liever zelf een moment kiezen?{" "}
          <a href={KENNISMAKING_URL} target="_blank" rel="noreferrer" className="text-erf underline">
            Plan een kennismaking »
          </a>
        </p>
      </div>
    </div>
  );
}
