"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AFWERKINGSNIVEAUS,
  AFWERKINGSNIVEAU_LABELS,
  AANBOD_TYPE,
  AANBOD_TYPE_LABELS,
  BTW_BASIS,
  BTW_BASIS_LABELS,
  euro,
  slugify,
} from "@/lib/aanbieders-constants";
import {
  saveWoning,
  deleteWoning,
  setWoningActief,
  uploadAanbiedersFile,
  type WoningInput,
} from "@/app/aanbieders/actions";
import type { Woning } from "@/lib/database.types";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";
const label = "block text-xs font-medium text-slate-600 mb-1";

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}
function triStr(v: boolean | null | undefined): string {
  return v === true ? "ja" : v === false ? "nee" : "";
}
function triVal(v: string): boolean | null {
  return v === "ja" ? true : v === "nee" ? false : null;
}

function WoningForm({
  aanbiederId,
  initial,
  onDone,
}: {
  aanbiederId: string;
  initial?: Woning;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [f, setF] = useState({
    naam: str(initial?.naam),
    slug: str(initial?.slug),
    oppervlakte_m2: str(initial?.oppervlakte_m2),
    oppervlakte_max_m2: str(initial?.oppervlakte_max_m2),
    slaapkamers: str(initial?.slaapkamers),
    prijs_incl_btw: str(initial?.prijs_incl_btw),
    btw_basis_bron: initial?.btw_basis_bron ?? "incl",
    is_vanaf_prijs: initial?.is_vanaf_prijs ?? true,
    afwerkingsniveau: str(initial?.afwerkingsniveau),
    aanbod_type: initial?.aanbod_type ?? "koop",
    in_prijs_inbegrepen: str(initial?.in_prijs_inbegrepen),
    beschrijving: str(initial?.beschrijving),
    gelijkvloers: triStr(initial?.gelijkvloers),
    energieneutraal_beng: triStr(initial?.energieneutraal_beng),
    afbeeldingen: initial?.afbeeldingen ?? [],
    bron_url: str(initial?.bron_url),
    prijspeil: str(initial?.prijspeil),
    laatst_gecontroleerd: str(initial?.laatst_gecontroleerd),
    actief: initial?.actief ?? true,
    uitgelicht: initial?.uitgelicht ?? false,
    sortering: str(initial?.sortering ?? 0),
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));

  function set<K extends keyof typeof f>(key: K, value: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }
  function onNaam(value: string) {
    setF((prev) => ({
      ...prev,
      naam: value,
      slug: slugTouched ? prev.slug : slugify(value),
    }));
  }

  // Live indicatie van prijs/m² (server berekent de definitieve waarde).
  const opp = Number(f.oppervlakte_m2);
  const prijs = Number(f.prijs_incl_btw);
  const perM2 =
    f.oppervlakte_m2 && f.prijs_incl_btw && opp > 0
      ? Math.floor(prijs / opp)
      : null;

  async function onPhotos(files: FileList) {
    setUploading(true);
    setError(null);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("prefix", `woningen/${aanbiederId}`);
      const res = await uploadAanbiedersFile(fd);
      if (!res.ok || !res.url) {
        setError(res.error ?? "Upload mislukt.");
        setUploading(false);
        return;
      }
      urls.push(res.url);
    }
    setF((prev) => ({ ...prev, afbeeldingen: [...prev.afbeeldingen, ...urls] }));
    setUploading(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      ...f,
      aanbieder_id: aanbiederId,
      afwerkingsniveau: f.afwerkingsniveau || null,
      gelijkvloers: triVal(f.gelijkvloers),
      energieneutraal_beng: triVal(f.energieneutraal_beng),
    } as unknown as WoningInput;
    startTransition(async () => {
      const res = await saveWoning(payload, initial?.id);
      if (!res.ok) {
        setError(res.error ?? "Opslaan mislukt.");
        return;
      }
      router.refresh();
      onDone();
    });
  }

  function onDelete() {
    if (!initial?.id) return;
    if (!confirm(`Woning "${f.naam}" verwijderen?`)) return;
    startTransition(async () => {
      const res = await deleteWoning(initial.id, aanbiederId);
      if (!res.ok) {
        setError(res.error ?? "Verwijderen mislukt.");
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Naam *</label>
          <input className={input} value={f.naam} onChange={(e) => onNaam(e.target.value)} required />
        </div>
        <div>
          <label className={label}>Slug</label>
          <input
            className={input}
            value={f.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value);
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={label}>Oppervlakte m² *</label>
          <input
            className={input}
            type="number"
            min={1}
            value={f.oppervlakte_m2}
            onChange={(e) => set("oppervlakte_m2", e.target.value)}
            required
          />
        </div>
        <div>
          <label className={label}>Opp. max m²</label>
          <input
            className={input}
            type="number"
            min={0}
            value={f.oppervlakte_max_m2}
            onChange={(e) => set("oppervlakte_max_m2", e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Slaapkamers</label>
          <input
            className={input}
            type="number"
            min={0}
            value={f.slaapkamers}
            onChange={(e) => set("slaapkamers", e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Prijs (€)</label>
          <input
            className={input}
            type="number"
            min={0}
            value={f.prijs_incl_btw}
            onChange={(e) => set("prijs_incl_btw", e.target.value)}
            placeholder="leeg = op aanvraag"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={label}>Btw-basis</label>
          <select
            className={input}
            value={f.btw_basis_bron}
            onChange={(e) =>
              set("btw_basis_bron", e.target.value as (typeof BTW_BASIS)[number])
            }
          >
            {BTW_BASIS.map((b) => (
              <option key={b} value={b}>
                {BTW_BASIS_LABELS[b]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Aanbod-type</label>
          <select
            className={input}
            value={f.aanbod_type}
            onChange={(e) =>
              set("aanbod_type", e.target.value as (typeof AANBOD_TYPE)[number])
            }
          >
            {AANBOD_TYPE.map((a) => (
              <option key={a} value={a}>
                {AANBOD_TYPE_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Afwerkingsniveau</label>
          <select
            className={input}
            value={f.afwerkingsniveau}
            onChange={(e) => set("afwerkingsniveau", e.target.value)}
          >
            <option value="">— n.v.t. —</option>
            {AFWERKINGSNIVEAUS.map((n) => (
              <option key={n} value={n}>
                {AFWERKINGSNIVEAU_LABELS[n]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Prijs / m² (auto)</label>
          <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500">
            {initial?.prijs_per_m2 != null
              ? euro(initial.prijs_per_m2)
              : perM2 != null
                ? `${euro(perM2)} (indicatie)`
                : "—"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={f.is_vanaf_prijs}
            onChange={(e) => set("is_vanaf_prijs", e.target.checked)}
          />
          Vanaf-prijs
        </label>
        <div>
          <label className={label}>Gelijkvloers</label>
          <select
            className={input}
            value={f.gelijkvloers}
            onChange={(e) => set("gelijkvloers", e.target.value)}
          >
            <option value="">Onbekend</option>
            <option value="ja">Ja</option>
            <option value="nee">Nee</option>
          </select>
        </div>
        <div>
          <label className={label}>Energieneutraal (BENG)</label>
          <select
            className={input}
            value={f.energieneutraal_beng}
            onChange={(e) => set("energieneutraal_beng", e.target.value)}
          >
            <option value="">Onbekend</option>
            <option value="ja">Ja</option>
            <option value="nee">Nee</option>
          </select>
        </div>
      </div>

      <div>
        <label className={label}>In de prijs inbegrepen</label>
        <input
          className={input}
          value={f.in_prijs_inbegrepen}
          onChange={(e) => set("in_prijs_inbegrepen", e.target.value)}
        />
      </div>
      <div>
        <label className={label}>Beschrijving</label>
        <textarea
          rows={2}
          className={input}
          value={f.beschrijving}
          onChange={(e) => set("beschrijving", e.target.value)}
        />
      </div>

      {/* Foto's */}
      <div>
        <label className={label}>Foto&apos;s</label>
        {f.afbeeldingen.length > 0 && (
          <>
            <p className="mb-1 text-xs text-slate-400">
              Eerste foto = coverfoto op de site. Klik ★ om een andere als cover te zetten.
            </p>
            <div className="mb-2 flex flex-wrap gap-2">
              {f.afbeeldingen.map((url, i) => (
                <div key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className={`h-16 w-16 rounded-lg border object-cover ${
                      i === 0 ? "border-erf ring-2 ring-erf/30" : "border-slate-200"
                    }`}
                  />
                  {i === 0 ? (
                    <span className="absolute -left-1.5 -top-1.5 rounded-full bg-erf px-1 text-[10px] font-bold text-white">
                      cover
                    </span>
                  ) : (
                    <button
                      type="button"
                      title="Als coverfoto instellen"
                      onClick={() =>
                        set("afbeeldingen", [
                          url,
                          ...f.afbeeldingen.filter((u) => u !== url),
                        ])
                      }
                      className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] text-white"
                      aria-label="Als cover instellen"
                    >
                      ★
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "afbeeldingen",
                        f.afbeeldingen.filter((u) => u !== url),
                      )
                    }
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                    aria-label="Verwijderen"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        <label className="inline-block cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
          {uploading ? "Uploaden…" : "Foto's toevoegen"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              if (e.target.files?.length) onPhotos(e.target.files);
            }}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={label}>Bron (URL)</label>
          <input
            className={input}
            value={f.bron_url}
            onChange={(e) => set("bron_url", e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Prijspeil</label>
          <input
            className={input}
            value={f.prijspeil}
            onChange={(e) => set("prijspeil", e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Laatst gecontroleerd</label>
          <input
            className={input}
            type="date"
            value={f.laatst_gecontroleerd}
            onChange={(e) => set("laatst_gecontroleerd", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={f.actief}
            onChange={(e) => set("actief", e.target.checked)}
          />
          Actief
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={f.uitgelicht}
            onChange={(e) => set("uitgelicht", e.target.checked)}
          />
          Uitgelicht
        </label>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Sortering</label>
          <input
            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
            type="number"
            value={f.sortering}
            onChange={(e) => set("sortering", e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-slate-200 pt-3">
        <button
          type="submit"
          disabled={isPending || uploading}
          className="rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isPending ? "Opslaan…" : initial ? "Opslaan" : "Woning toevoegen"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Annuleren
        </button>
        {initial && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isPending}
            className="ml-auto text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Verwijderen
          </button>
        )}
      </div>
    </form>
  );
}

function ActiefToggle({
  woningId,
  aanbiederId,
  actief,
}: {
  woningId: string;
  aanbiederId: string;
  actief: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = await setWoningActief(woningId, !actief, aanbiederId);
      if (res.ok) router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      title={actief ? "Op inactief zetten" : "Activeren"}
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition disabled:opacity-50 ${
        actief
          ? "bg-green-100 text-green-700 ring-green-600/20 hover:bg-green-200"
          : "bg-slate-100 text-slate-500 ring-slate-400/20 hover:bg-slate-200"
      }`}
    >
      {isPending ? "…" : actief ? "Actief" : "Inactief"}
    </button>
  );
}

export function WoningenSection({
  aanbiederId,
  woningen,
}: {
  aanbiederId: string;
  woningen: Woning[];
}) {
  const [open, setOpen] = useState<string | "new" | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          Woningen{" "}
          <span className="text-sm font-normal text-slate-400">
            ({woningen.length})
          </span>
        </h2>
        {open !== "new" && (
          <button
            onClick={() => setOpen("new")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Nieuwe woning
          </button>
        )}
      </div>

      {open === "new" && (
        <WoningForm aanbiederId={aanbiederId} onDone={() => setOpen(null)} />
      )}

      <ul className="space-y-2">
        {woningen.length === 0 && open !== "new" && (
          <li className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
            Nog geen woningen. Voeg de eerste toe.
          </li>
        )}
        {woningen.map((w) =>
          open === w.id ? (
            <li key={w.id}>
              <WoningForm
                aanbiederId={aanbiederId}
                initial={w}
                onDone={() => setOpen(null)}
              />
            </li>
          ) : (
            <li
              key={w.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <button
                onClick={() => setOpen(w.id)}
                className="flex-1 text-left"
              >
                <div className="font-medium text-slate-900">
                  {w.naam}
                  {!w.actief && (
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      (inactief)
                    </span>
                  )}
                  {w.uitgelicht && (
                    <span className="ml-2 rounded bg-erf/10 px-1.5 py-0.5 text-xs font-medium text-erf">
                      Uitgelicht
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500">
                  {w.oppervlakte_m2 ? `${w.oppervlakte_m2} m²` : "—"}
                  {" · "}
                  {euro(w.prijs_incl_btw)}
                  {w.prijs_per_m2 != null && ` · ${euro(w.prijs_per_m2)}/m²`}
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-3">
                <ActiefToggle
                  woningId={w.id}
                  aanbiederId={aanbiederId}
                  actief={w.actief}
                />
                <button
                  onClick={() => setOpen(w.id)}
                  className="text-sm text-slate-400 transition hover:text-slate-700"
                >
                  Bewerken →
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
