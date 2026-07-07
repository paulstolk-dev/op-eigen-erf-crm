import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CONCLUSIE,
  SCAN_PUNTEN,
  buildScanUrl,
} from "@/lib/erfcheck-report";
import { TrackView } from "./track-view";
import { AfspraakForm } from "./afspraak-form";
import type { Lead, Erfscan } from "@/lib/database.types";

export const dynamic = "force-dynamic";

function datumNL(iso?: string | null): string {
  return new Date(iso ?? Date.now()).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function ErfcheckPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("*")
    .eq("report_token", token)
    .maybeSingle<Lead>();
  if (!lead) notFound();

  const { data: erfscan } = await admin
    .from("erfscans")
    .select("*")
    .eq("lead_id", lead.id)
    .maybeSingle<Erfscan>();
  if (!erfscan) notFound();

  const d = (erfscan.dossier ?? {}) as Record<string, any>;
  const adres = (d.locatie?.weergavenaam as string) || "Jouw erf";
  const opp = d.perceel?.oppervlakte_m2 as number | undefined;
  const maxvv = d.ruimtelijk?.max_vergunningvrij_m2 as number | undefined;
  const con = erfscan.conclusie ?? "oranje";
  const c = CONCLUSIE[con] ?? CONCLUSIE.oranje;
  const scanUrl = buildScanUrl(lead);

  let luchtfotoUrl: string | null = null;
  if (erfscan.luchtfoto_path) {
    const { data: signed } = await admin.storage
      .from("erfscans")
      .createSignedUrl(erfscan.luchtfoto_path, 3600);
    luchtfotoUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="min-h-screen bg-[#f6f7f4] py-8 text-slate-800">
      <TrackView token={token} />
      <main className="mx-auto max-w-2xl px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="opeigenerf.nl" className="h-10 w-auto" />
          <span className="text-right text-xs text-slate-500">
            Onafhankelijk — we bouwen zelf niet.
          </span>
        </div>

        <p className="text-[11px] font-bold uppercase tracking-wider text-erf">
          Gratis Erfcheck
        </p>
        <h1 className="mt-0.5 text-2xl font-bold leading-tight text-navy">{adres}</h1>
        <p className="mt-1 text-sm text-slate-500">Opgesteld {datumNL(erfscan.enriched_at)}</p>

        <h2 className="mt-6 text-lg font-bold text-navy">
          Wat lijkt er mogelijk op jouw erf?
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Een eerste, geautomatiseerde indicatie op basis van je kadastrale perceel.
        </p>

        {/* Perceelgegevens links + vierkante luchtfoto rechts */}
        <div className="mt-4 grid items-stretch gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Perceeloppervlakte
            </p>
            <p className="mt-0.5 text-2xl font-bold text-navy">
              {opp ? `± ${opp} m²` : "n.b."}
            </p>
            <p className="text-[11px] text-slate-400">Bron: Kadaster (BRK)</p>
            {maxvv != null && (
              <>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Max. vergunningvrij (indicatie)
                </p>
                <p className="mt-0.5 text-2xl font-bold text-navy">± {maxvv} m²</p>
                <p className="text-[11px] text-slate-400">
                  Bijbehorend bouwwerk in achtererfgebied
                </p>
              </>
            )}
          </div>
          {luchtfotoUrl && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={luchtfotoUrl}
                alt="Luchtfoto van het perceel"
                className="aspect-square w-full rounded-xl object-cover"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Luchtfoto · bron: PDOK (Beeldmateriaal Nederland)
              </p>
            </div>
          )}
        </div>

        {/* Oordeel */}
        <div className="mt-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <span
            className="inline-block rounded-md px-2.5 py-1 text-sm font-bold text-white"
            style={{ backgroundColor: c.kleur }}
          >
            {c.woord}
          </span>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.uitleg}</p>
        </div>

        {/* Regelgeving */}
        <h3 className="mt-7 text-xs font-bold uppercase tracking-wide text-erf">
          Welke regelgeving speelt
        </h3>
        <div className="mt-2 space-y-3">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <div className="sm:w-40 sm:shrink-0">
              <p className="font-bold text-navy">Mantelzorgwoning</p>
              <p className="text-[11px] font-bold text-erf">kan nú</p>
            </div>
            <p className="text-sm text-slate-600">
              Onder voorwaarden vergunningvrij mogelijk onder geldend recht (mits een
              aantoonbare zorgrelatie).
            </p>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <div className="sm:w-40 sm:shrink-0">
              <p className="font-bold text-navy">Familiewoning</p>
              <p className="text-[11px] font-bold text-erf">aankomend</p>
            </div>
            <p className="text-sm text-slate-600">
              Zelfstandige woning zonder vergunning — via de Wet versterking regie
              volkshuisvesting, nog niet definitief in werking.
            </p>
          </div>
        </div>

        {/* Scan CTA */}
        <a
          href={scanUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 block rounded-xl bg-erf/10 p-5 ring-1 ring-inset ring-erf/30 transition hover:bg-erf/15"
        >
          <p className="font-bold text-navy">
            In de uitgebreide scan (€99) kijken we verder »
          </p>
          <ul className="mt-2 space-y-1">
            {SCAN_PUNTEN.map((punt, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700">
                <span className="text-erf">•</span>
                <span>{punt}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-bold text-erf">
            Start de Haalbaarheidsscan » opeigenerf.nl/haalbaarheidsscan
          </p>
        </a>

        {/* Terugbel/afspraak */}
        <div className="mt-4">
          <AfspraakForm token={token} telefoon={lead.telefoon} />
        </div>

        <p className="mt-6 text-[11px] leading-relaxed text-slate-400">
          Deze gratis Erf Check is een geautomatiseerde, indicatieve eerste beoordeling op
          basis van open data (Kadaster/BRK, PDOK) en landelijke regels. Géén juridisch
          advies, vergunning of definitieve maatvoering. De exacte bouwruimte en lokale
          regels worden bepaald in de{" "}
          <a href={scanUrl} target="_blank" rel="noreferrer" className="text-erf underline">
            Haalbaarheidsscan
          </a>
          . © opeigenerf.nl
        </p>
      </main>
    </div>
  );
}
