import Image from "next/image";
import {
  ERFSCAN_STATUS_STYLES,
  erfscanStatusLabel,
  CONCLUSIE_LABELS,
  CONCLUSIE_STYLES,
} from "@/lib/constants";
import type { Erfscan } from "@/lib/database.types";

type Dossier = {
  locatie?: { weergavenaam?: string; gemeente?: string; provincie?: string };
  perceel?: {
    kadastrale_aanduiding?: string;
    oppervlakte_m2?: number | string;
    status?: string;
  };
  bag?: { bouwjaar?: number | string; status_pand?: string };
  ruimtelijk?: {
    max_vergunningvrij_m2?: number | string;
    bebouwingsgebied_m2?: number | string;
    footprint_hoofdgebouw_m2?: number | string;
    achtererf_proxy_m2?: number | string;
    achtererf_bron?: string;
  };
  adres_invoer?: { postcode?: string; huisnummer?: string; toevoeging?: string };
  kansen?: string[];
  flags?: string[];
  advies?: string;
  bronnen?: Record<string, string>;
  gegenereerd?: string;
};

function Badge({ label, style }: { label: string; style: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {label}
    </span>
  );
}

function List({
  items,
  tone,
}: {
  items?: string[];
  tone: "kans" | "flag";
}) {
  if (!items?.length) return null;
  const dot = tone === "kans" ? "text-green-500" : "text-amber-500";
  return (
    <ul className="space-y-1.5">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-700">
          <span className={dot}>{tone === "kans" ? "✓" : "!"}</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function num(v: number | string | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Uitgelicht blok: max. vergunningvrije bebouwing + waar die op berekend is. */
function MaxBebouwing({ r }: { r: NonNullable<Dossier["ruimtelijk"]> }) {
  const achtererf = num(r.achtererf_proxy_m2);
  const footprint = num(r.footprint_hoofdgebouw_m2);
  const bebgebied = num(r.bebouwingsgebied_m2);
  const max = num(r.max_vergunningvrij_m2);
  const handmatig = r.achtererf_bron === "handmatig ingetekend";
  if (max == null) return null;

  return (
    <div className="mb-4 rounded-xl border border-erf/30 bg-erf/5 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-erf">
            Maximaal te bebouwen (vergunningvrij)
          </div>
          <div className="mt-0.5 text-3xl font-bold leading-none text-slate-900">
            ± {max.toLocaleString("nl-NL")} m²
          </div>
        </div>
        {handmatig && (
          <span className="shrink-0 rounded-full bg-erf/10 px-2 py-0.5 text-[11px] font-medium text-erf ring-1 ring-inset ring-erf/30">
            ✎ achtererf ingetekend
          </span>
        )}
      </div>

      {bebgebied != null && (
        <div className="mt-3 border-t border-erf/20 pt-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Berekend op basis van
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
            <span>
              Achtererf{" "}
              <strong className="text-slate-900">
                ± {(achtererf ?? 0).toLocaleString("nl-NL")} m²
              </strong>
            </span>
            <span className="text-slate-400">+</span>
            <span>
              hoofdgebouw{" "}
              <strong className="text-slate-900">
                ± {(footprint ?? 0).toLocaleString("nl-NL")} m²
              </strong>
            </span>
            <span className="text-slate-400">=</span>
            <span>
              bebouwingsgebied{" "}
              <strong className="text-slate-900">
                ± {bebgebied.toLocaleString("nl-NL")} m²
              </strong>
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {handmatig
              ? "De achtererf-oppervlakte komt uit de handmatige intekening op de kaart. Pas je de tekening aan, dan verandert de maximale bebouwing mee."
              : "De achtererf-oppervlakte is automatisch berekend. Teken het achtererf in op de kaart om dit te verfijnen."}
          </p>
        </div>
      )}
    </div>
  );
}

export function ErfscanPanel({
  erfscan,
  luchtfotoUrl,
}: {
  erfscan: Erfscan;
  luchtfotoUrl?: string | null;
}) {
  const d = (erfscan.dossier ?? {}) as Dossier;
  const conclusie = erfscan.conclusie ?? undefined;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Erfscan</h2>
        <div className="flex items-center gap-2">
          <Badge
            label={erfscanStatusLabel(erfscan.status)}
            style={
              ERFSCAN_STATUS_STYLES[erfscan.status] ??
              "bg-slate-100 text-slate-700 ring-slate-500/20"
            }
          />
          {conclusie && (
            <Badge
              label={CONCLUSIE_LABELS[conclusie] ?? conclusie}
              style={
                CONCLUSIE_STYLES[conclusie] ??
                "bg-slate-100 text-slate-700 ring-slate-500/20"
              }
            />
          )}
        </div>
      </div>

      {erfscan.status === "error" && erfscan.error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {erfscan.error}
        </p>
      )}

      {luchtfotoUrl && (
        <div className="mb-4 overflow-hidden rounded-lg border border-slate-200">
          <Image
            src={luchtfotoUrl}
            alt="Luchtfoto perceel"
            width={800}
            height={800}
            unoptimized
            className="h-auto w-full"
          />
        </div>
      )}

      {d.ruimtelijk && <MaxBebouwing r={d.ruimtelijk} />}

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Adres</dt>
          <dd className="mt-0.5 text-slate-900">
            {d.locatie?.weergavenaam || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">
            Gemeente
          </dt>
          <dd className="mt-0.5 text-slate-900">{d.locatie?.gemeente || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">
            Perceel
          </dt>
          <dd className="mt-0.5 text-slate-900">
            {d.perceel?.kadastrale_aanduiding || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">
            Oppervlakte
          </dt>
          <dd className="mt-0.5 text-slate-900">
            {d.perceel?.oppervlakte_m2 ? `${d.perceel.oppervlakte_m2} m²` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">
            Bouwjaar
          </dt>
          <dd className="mt-0.5 text-slate-900">{d.bag?.bouwjaar || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">
            Achtererf
          </dt>
          <dd className="mt-0.5 text-slate-900">
            {d.ruimtelijk?.achtererf_proxy_m2
              ? `± ${num(d.ruimtelijk.achtererf_proxy_m2)?.toLocaleString("nl-NL")} m²`
              : "—"}
          </dd>
        </div>
      </dl>

      {(d.kansen?.length || d.flags?.length) && (
        <div className="mt-5 space-y-4">
          {d.kansen?.length ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Kansen
              </h3>
              <List items={d.kansen} tone="kans" />
            </div>
          ) : null}
          {d.flags?.length ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Aandachtspunten (handmatig verifiëren)
              </h3>
              <List items={d.flags} tone="flag" />
            </div>
          ) : null}
        </div>
      )}

      {d.bronnen && Object.keys(d.bronnen).length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Bronnen / deeplinks (Tier 3)
          </h3>
          <ul className="flex flex-wrap gap-2">
            {Object.entries(d.bronnen).map(([k, url]) => (
              <li key={k}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  {k.replace(/_/g, " ")}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {erfscan.enriched_at && (
        <p className="mt-4 text-xs text-slate-400">
          Verrijkt op{" "}
          {new Date(erfscan.enriched_at).toLocaleString("nl-NL", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
