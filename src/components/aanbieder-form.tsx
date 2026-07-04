"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  VERGUNNINGSBEGELEIDING,
  VERGUNNINGSBEGELEIDING_LABELS,
  PRIJSKLASSE,
  PRIJSKLASSE_LABELS,
  AFWERKINGSNIVEAUS,
  AFWERKINGSNIVEAU_LABELS,
  slugify,
} from "@/lib/aanbieders-constants";
import {
  saveAanbieder,
  deleteAanbieder,
  uploadAanbiedersFile,
  type AanbiederInput,
} from "@/app/aanbieders/actions";
import type { Aanbieder } from "@/lib/database.types";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";
const label = "block text-xs font-medium text-slate-600 mb-1";

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

export function AanbiederForm({
  initial,
  variant = "crm",
}: {
  initial?: Aanbieder;
  variant?: "crm" | "portal";
}) {
  const isCrm = variant === "crm";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [f, setF] = useState({
    naam: str(initial?.naam),
    slug: str(initial?.slug),
    website_url: str(initial?.website_url),
    logo_url: str(initial?.logo_url),
    beschrijving: str(initial?.beschrijving),
    vestigingsplaats: str(initial?.vestigingsplaats),
    servicegebied: str(initial?.servicegebied),
    bouwmethode: str(initial?.bouwmethode),
    levertijd_indicatie: str(initial?.levertijd_indicatie),
    vergunningsbegeleiding: initial?.vergunningsbegeleiding ?? "niet_vermeld",
    koop: initial?.koop ?? true,
    huur: initial?.huur ?? false,
    tweedehands: initial?.tweedehands ?? false,
    prijsklasse: str(initial?.prijsklasse),
    vanaf_prijs_incl_btw: str(initial?.vanaf_prijs_incl_btw),
    prijs_per_m2_indicatie: str(initial?.prijs_per_m2_indicatie),
    afwerkingsniveaus: initial?.afwerkingsniveaus ?? [],
    in_vanaf_prijs: str(initial?.in_vanaf_prijs),
    prijspeil: str(initial?.prijspeil),
    bron_url: str(initial?.bron_url),
    laatst_gecontroleerd: str(initial?.laatst_gecontroleerd),
    is_partner: initial?.is_partner ?? false,
    actief: initial?.actief ?? true,
    sortering: str(initial?.sortering ?? 0),
  });
  // Slug volgt de naam automatisch tot de gebruiker de slug handmatig aanpast.
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

  function toggleAfw(niveau: (typeof AFWERKINGSNIVEAUS)[number]) {
    setF((prev) => ({
      ...prev,
      afwerkingsniveaus: prev.afwerkingsniveaus.includes(niveau)
        ? prev.afwerkingsniveaus.filter((n) => n !== niveau)
        : [...prev.afwerkingsniveaus, niveau],
    }));
  }

  async function onLogo(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("prefix", "logos");
    const res = await uploadAanbiedersFile(fd);
    setUploading(false);
    if (!res.ok || !res.url) {
      setError(res.error ?? "Upload mislukt.");
      return;
    }
    set("logo_url", res.url);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      ...f,
      prijsklasse: f.prijsklasse || null,
    } as unknown as AanbiederInput;
    startTransition(async () => {
      const res = await saveAanbieder(payload, initial?.id);
      if (!res.ok) {
        setError(res.error ?? "Opslaan mislukt.");
        return;
      }
      if (initial?.id) router.refresh();
      else router.push(`/aanbieders/${res.id}`);
    });
  }

  function onDelete() {
    if (!initial?.id) return;
    if (!confirm(`Aanbieder "${f.naam}" definitief verwijderen?`)) return;
    startTransition(async () => {
      const res = await deleteAanbieder(initial.id);
      if (!res.ok) {
        setError(res.error ?? "Verwijderen mislukt.");
        return;
      }
      router.push("/aanbieders");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Basis */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Naam *</label>
          <input
            className={input}
            value={f.naam}
            onChange={(e) => onNaam(e.target.value)}
            required
          />
        </div>
        {isCrm && (
          <div>
            <label className={label}>Slug</label>
            <input
              className={input}
              value={f.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value);
              }}
              placeholder="wordt automatisch afgeleid van de naam"
            />
          </div>
        )}
        <div>
          <label className={label}>Website</label>
          <input
            className={input}
            value={f.website_url}
            onChange={(e) => set("website_url", e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div>
          <label className={label}>Vestigingsplaats</label>
          <input
            className={input}
            value={f.vestigingsplaats}
            onChange={(e) => set("vestigingsplaats", e.target.value)}
          />
        </div>
      </section>

      {/* Logo */}
      <section>
        <label className={label}>Logo</label>
        <div className="flex items-center gap-4">
          {f.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={f.logo_url}
              alt="logo"
              className="h-14 w-14 rounded-lg border border-slate-200 object-contain p-1"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
              geen
            </div>
          )}
          <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            {uploading ? "Uploaden…" : "Logo uploaden"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onLogo(file);
              }}
            />
          </label>
          {f.logo_url && (
            <button
              type="button"
              onClick={() => set("logo_url", "")}
              className="text-sm text-slate-400 hover:text-red-600"
            >
              Verwijderen
            </button>
          )}
        </div>
      </section>

      {/* Beschrijving */}
      <div>
        <label className={label}>Beschrijving</label>
        <textarea
          rows={3}
          className={input}
          value={f.beschrijving}
          onChange={(e) => set("beschrijving", e.target.value)}
        />
      </div>

      {/* Aanbod */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Servicegebied</label>
          <input
            className={input}
            value={f.servicegebied}
            onChange={(e) => set("servicegebied", e.target.value)}
            placeholder="bv. Heel NL"
          />
        </div>
        <div>
          <label className={label}>Bouwmethode</label>
          <input
            className={input}
            value={f.bouwmethode}
            onChange={(e) => set("bouwmethode", e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Levertijd (indicatie)</label>
          <input
            className={input}
            value={f.levertijd_indicatie}
            onChange={(e) => set("levertijd_indicatie", e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Vergunningsbegeleiding</label>
          <select
            className={input}
            value={f.vergunningsbegeleiding}
            onChange={(e) =>
              set(
                "vergunningsbegeleiding",
                e.target.value as (typeof VERGUNNINGSBEGELEIDING)[number],
              )
            }
          >
            {VERGUNNINGSBEGELEIDING.map((v) => (
              <option key={v} value={v}>
                {VERGUNNINGSBEGELEIDING_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="flex flex-wrap gap-5">
        {(["koop", "huur", "tweedehands"] as const).map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={f[k]}
              onChange={(e) => set(k, e.target.checked)}
            />
            {k === "koop" ? "Koop" : k === "huur" ? "Huur" : "Tweedehands"}
          </label>
        ))}
      </section>

      {/* Prijs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>Prijsklasse</label>
          <select
            className={input}
            value={f.prijsklasse}
            onChange={(e) => set("prijsklasse", e.target.value)}
          >
            <option value="">— niet vermeld —</option>
            {PRIJSKLASSE.map((p) => (
              <option key={p} value={p}>
                {PRIJSKLASSE_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Vanaf-prijs (incl. btw, €)</label>
          <input
            className={input}
            type="number"
            min={0}
            step={1}
            value={f.vanaf_prijs_incl_btw}
            onChange={(e) => set("vanaf_prijs_incl_btw", e.target.value)}
            placeholder="leeg = op aanvraag"
          />
        </div>
        <div>
          <label className={label}>Prijs per m² (indicatie, €)</label>
          <input
            className={input}
            type="number"
            min={0}
            step={1}
            value={f.prijs_per_m2_indicatie}
            onChange={(e) => set("prijs_per_m2_indicatie", e.target.value)}
          />
        </div>
      </section>

      <div>
        <label className={label}>Afwerkingsniveaus</label>
        <div className="flex flex-wrap gap-4">
          {AFWERKINGSNIVEAUS.map((n) => (
            <label key={n} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={f.afwerkingsniveaus.includes(n)}
                onChange={() => toggleAfw(n)}
              />
              {AFWERKINGSNIVEAU_LABELS[n]}
            </label>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>In de vanaf-prijs inbegrepen</label>
          <input
            className={input}
            value={f.in_vanaf_prijs}
            onChange={(e) => set("in_vanaf_prijs", e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Prijspeil</label>
          <input
            className={input}
            value={f.prijspeil}
            onChange={(e) => set("prijspeil", e.target.value)}
            placeholder="bv. 2024"
          />
        </div>
        <div>
          <label className={label}>Bron (URL)</label>
          <input
            className={input}
            value={f.bron_url}
            onChange={(e) => set("bron_url", e.target.value)}
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
      </section>

      {/* Status — alleen CRM-beheer */}
      {isCrm && (
      <section className="flex flex-wrap items-center gap-6 border-t border-slate-100 pt-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={f.actief}
            onChange={(e) => set("actief", e.target.checked)}
          />
          Actief (zichtbaar op de site)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={f.is_partner}
            onChange={(e) => set("is_partner", e.target.checked)}
          />
          Partner
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
      </section>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <button
          type="submit"
          disabled={isPending || uploading}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isPending ? "Opslaan…" : initial ? "Wijzigingen opslaan" : "Aanbieder aanmaken"}
        </button>
        {initial && isCrm && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isPending}
            className="text-sm font-medium text-red-600 transition hover:text-red-700 disabled:opacity-50"
          >
            Verwijderen
          </button>
        )}
      </div>
    </form>
  );
}
