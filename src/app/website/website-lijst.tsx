"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePaginaSeo, saveArtikelSeo } from "./actions";
import { ArtikelAfbeelding } from "./artikel-afbeelding";
import { ArtikelContent } from "./artikel-content";
import { SITE_PAGINAS, SITE_PAGINA_GROEPEN } from "@/lib/site-paginas";

export type PaginaSeoRow = {
  pad: string;
  seo_titel: string | null;
  meta_description: string | null;
  updated_at: string;
};

export type ArtikelRow = {
  id: string;
  titel: string;
  slug: string | null;
  seo_titel: string | null;
  beschrijving: string | null;
  categorie: string | null;
  status: string;
  publicatiedatum: string | null;
  afbeelding_url: string | null;
  content_processed: boolean;
  afleveringId: string | null;
};

type Result = { ok: boolean; error?: string };

const TITEL_MAX = 60;
const DESC_MAX = 155;

const STATUS_STYLE: Record<string, string> = {
  gepubliceerd: "bg-green-100 text-green-800 ring-green-600/20",
  concept: "bg-slate-100 text-slate-600 ring-slate-400/20",
  gearchiveerd: "bg-amber-100 text-amber-800 ring-amber-600/20",
};

function datumNL(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Teller({ n, max }: { n: number; max: number }) {
  return (
    <span className={`text-[11px] tabular-nums ${n > max ? "text-red-600" : "text-slate-400"}`}>
      {n}/{max}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** SEO-velden + opslaan. Gedeeld door sitepagina's en artikelen. */
function SeoVelden({
  initialTitel,
  initialDesc,
  onSave,
}: {
  initialTitel: string;
  initialDesc: string;
  onSave: (titel: string, desc: string) => Promise<Result>;
}) {
  const router = useRouter();
  const [titel, setTitel] = useState(initialTitel);
  const [desc, setDesc] = useState(initialDesc);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const gewijzigd = titel !== initialTitel || desc !== initialDesc;

  function opslaan() {
    setMsg("");
    start(async () => {
      const r = await onSave(titel, desc);
      setMsg(r.ok ? "Opgeslagen." : (r.error ?? "Opslaan mislukt."));
      if (r.ok) router.refresh();
    });
  }

  return (
    <div>
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
          placeholder="Leeg = standaardtitel"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
      </label>

      <label className="mt-2 block">
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
          placeholder="Leeg = standaard-description"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
      </label>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={pending || !gewijzigd}
          onClick={opslaan}
          className="rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-40"
        >
          {pending ? "Opslaan…" : "Opslaan"}
        </button>
        {msg && (
          <span className={`text-xs ${msg.includes("mislukt") ? "text-red-600" : "text-green-600"}`}>
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}

/** Sitepagina: alleen SEO (geen afbeelding/social content). */
function PaginaRij({
  pad,
  label,
  seo,
  open,
  onToggle,
}: {
  pad: string;
  label: string;
  seo: PaginaSeoRow | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const heeftSeo = Boolean(seo?.seo_titel || seo?.meta_description);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-900">{label}</span>
          <code className="hidden shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 sm:inline">
            {pad}
          </code>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {heeftSeo && (
            <span className="rounded-full bg-erf/10 px-2 py-0.5 text-[11px] font-medium text-erf">
              SEO
            </span>
          )}
          <Chevron open={open} />
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4">
          <SeoVelden
            initialTitel={seo?.seo_titel ?? ""}
            initialDesc={seo?.meta_description ?? ""}
            onSave={(t, d) => savePaginaSeo(pad, t, d)}
          />
        </div>
      )}
    </div>
  );
}

/** Artikel: afbeelding + SEO + social content, alles onder één rij. */
function ArtikelRij({
  a,
  open,
  onToggle,
}: {
  a: ArtikelRow;
  open: boolean;
  onToggle: () => void;
}) {
  const heeftSeo = Boolean(a.seo_titel || a.beschrijving);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        {/* Thumbnail als snelle indicatie of er al een afbeelding is. */}
        <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
          {a.afbeelding_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.afbeelding_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-slate-400">geen</span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">{a.titel}</span>
          <span className="mt-0.5 block truncate text-xs text-slate-400">
            {a.categorie ?? "—"} · {datumNL(a.publicatiedatum)}
            {a.slug ? ` · /${a.slug}` : ""}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {heeftSeo && (
            <span className="hidden rounded-full bg-erf/10 px-2 py-0.5 text-[11px] font-medium text-erf sm:inline">
              SEO
            </span>
          )}
          <span
            className={`hidden rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset sm:inline ${
              a.content_processed
                ? "bg-green-100 text-green-800 ring-green-600/20"
                : "bg-slate-100 text-slate-500 ring-slate-400/20"
            }`}
          >
            {a.content_processed ? "✓ verwerkt" : "niet verwerkt"}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
              STATUS_STYLE[a.status] ?? STATUS_STYLE.concept
            }`}
          >
            {a.status}
          </span>
          <Chevron open={open} />
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 p-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Uitgelichte afbeelding
            </p>
            <ArtikelAfbeelding artikelId={a.id} url={a.afbeelding_url} />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <SeoVelden
              initialTitel={a.seo_titel ?? ""}
              initialDesc={a.beschrijving ?? ""}
              onSave={(t, d) => saveArtikelSeo(a.id, t, d)}
            />
          </div>

          <ArtikelContent artikelId={a.id} afleveringId={a.afleveringId} />
        </div>
      )}
    </div>
  );
}

export function WebsiteLijst({
  seoRows,
  artikelen,
}: {
  seoRows: PaginaSeoRow[];
  artikelen: ArtikelRow[];
}) {
  const byPad = new Map(seoRows.map((r) => [r.pad, r]));
  const [openKey, setOpenKey] = useState<string | null>(null);
  const toggle = (k: string) => setOpenKey((cur) => (cur === k ? null : k));

  return (
    <div className="space-y-8">
      {/* Sitepagina's */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Sitepagina&apos;s</h2>
        <p className="mb-4 mt-0.5 text-xs text-slate-500">
          Klik een pagina open om de SEO-titel + meta-description in te voeren.
          Leeg laten = de standaardwaarde van de pagina.
        </p>

        <div className="space-y-6">
          {SITE_PAGINA_GROEPEN.map((groep) => {
            const paginas = SITE_PAGINAS.filter((p) => p.groep === groep);
            if (paginas.length === 0) return null;
            return (
              <div key={groep}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {groep}
                </h3>
                <div className="space-y-2">
                  {paginas.map((p) => (
                    <PaginaRij
                      key={p.pad}
                      pad={p.pad}
                      label={p.label}
                      seo={byPad.get(p.pad)}
                      open={openKey === p.pad}
                      onToggle={() => toggle(p.pad)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Kennisbank-artikelen */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Kennisbank-artikelen</h2>
        <p className="mb-4 mt-0.5 text-xs text-slate-500">
          Per artikel: uitgelichte afbeelding, SEO-titel + meta-description en de
          social content.
        </p>

        {artikelen.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">
            Nog geen artikelen.
          </p>
        ) : (
          <div className="space-y-2">
            {artikelen.map((a) => (
              <ArtikelRij
                key={a.id}
                a={a}
                open={openKey === `art-${a.id}`}
                onToggle={() => toggle(`art-${a.id}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
