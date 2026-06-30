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
            Vergunningvrij (indicatie)
          </dt>
          <dd className="mt-0.5 text-slate-900">
            {d.ruimtelijk?.max_vergunningvrij_m2
              ? `± ${d.ruimtelijk.max_vergunningvrij_m2} m²`
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
