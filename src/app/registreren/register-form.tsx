"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { registerAanbieder } from "./actions";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";

export function RegisterForm({
  aanbieders,
}: {
  aanbieders: { id: string; naam: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { needsConfirm: boolean }>(null);
  const [f, setF] = useState({
    email: "",
    password: "",
    aanbieder_id: "",
    bericht: "",
  });

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await registerAanbieder(f);
      if (!res.ok) {
        setError(res.error ?? "Er ging iets mis.");
        return;
      }
      setDone({ needsConfirm: Boolean(res.needsConfirm) });
    });
  }

  if (done) {
    return (
      <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <p className="font-medium">Aanvraag ontvangen ✅</p>
        <p className="mt-1">
          {done.needsConfirm
            ? "Bevestig eerst je e-mailadres via de link die we je mailden. "
            : ""}
          Zodra opeigenerf je account goedkeurt, kun je inloggen en je woningen
          beheren.
        </p>
        <Link href="/login" className="mt-3 inline-block font-medium text-navy hover:underline">
          → Naar inloggen
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Je bedrijf</label>
        <select
          className={input}
          value={f.aanbieder_id}
          onChange={(e) => set("aanbieder_id", e.target.value)}
          required
        >
          <option value="">— kies je bedrijf —</option>
          {aanbieders.map((a) => (
            <option key={a.id} value={a.id}>
              {a.naam}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">
          Staat je bedrijf er niet bij? Zet dat in het bericht hieronder.
        </p>
      </div>
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="jij@bedrijf.nl"
        className={input}
        value={f.email}
        onChange={(e) => set("email", e.target.value)}
      />
      <input
        type="password"
        required
        autoComplete="new-password"
        placeholder="Wachtwoord (min. 8 tekens)"
        className={input}
        value={f.password}
        onChange={(e) => set("password", e.target.value)}
      />
      <textarea
        rows={2}
        placeholder="Bericht (optioneel)"
        className={input}
        value={f.bericht}
        onChange={(e) => set("bericht", e.target.value)}
      />
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
      >
        {isPending ? "Versturen…" : "Toegang aanvragen"}
      </button>
      <p className="text-center text-sm text-slate-500">
        Al een account?{" "}
        <Link href="/login" className="font-medium text-navy hover:underline">
          Inloggen
        </Link>
      </p>
    </form>
  );
}
