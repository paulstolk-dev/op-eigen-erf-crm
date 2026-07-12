"use client";

import { useState, useTransition } from "react";
import { reageerOpLead } from "../actions";
import type { PortalLead } from "@/lib/database.types";

const REACTIE_LABELS: Record<string, string> = {
  gedeeld: "Nieuw",
  geinteresseerd: "Geïnteresseerd",
  afgewezen: "Afgewezen",
};
const REACTIE_STYLES: Record<string, string> = {
  gedeeld: "bg-slate-100 text-slate-600 ring-slate-400/20",
  geinteresseerd: "bg-green-100 text-green-700 ring-green-600/20",
  afgewezen: "bg-red-100 text-red-700 ring-red-600/20",
};
const CONCL: Record<string, { woord: string; kleur: string }> = {
  groen: { woord: "Kansrijk", kleur: "#16a34a" },
  oranje: { woord: "Twijfelachtig", kleur: "#d97706" },
  rood: { woord: "Complex", kleur: "#dc2626" },
};

function datum(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function LeadCard({ lead }: { lead: PortalLead }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const naam = [lead.voornaam, lead.achternaam].filter(Boolean).join(" ") || lead.naam;

  function reageer(status: "geinteresseerd" | "afgewezen") {
    setError(null);
    startTransition(async () => {
      const res = await reageerOpLead(lead.lead_id, status);
      if (!res.ok) setError(res.error ?? "Er ging iets mis.");
    });
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900">
              {lead.audience || "Aanvraag"}
              {lead.regio_postcode && (
                <span className="font-normal text-slate-500">
                  {" "}
                  · regio {lead.regio_postcode}
                </span>
              )}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {lead.budget && <span>Budget: {lead.budget}</span>}
            {lead.planning && <span>Planning: {lead.planning}</span>}
            {lead.startdatum && <span>Start: {lead.startdatum}</span>}
            <span>Gedeeld: {datum(lead.gedeeld_at)}</span>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
            REACTIE_STYLES[lead.reactie_status] ?? REACTIE_STYLES.gedeeld
          }`}
        >
          {REACTIE_LABELS[lead.reactie_status] ?? lead.reactie_status}
        </span>
      </div>

      {/* Erf Check — alle gescande info wordt met de aanbieder gedeeld */}
      {(lead.erfcheck_conclusie ||
        lead.perceel_m2 != null ||
        lead.report_token) && (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Erf Check
            </span>
            {lead.erfcheck_conclusie && (
              <span
                className="rounded-md px-2 py-0.5 text-xs font-bold text-white"
                style={{ backgroundColor: CONCL[lead.erfcheck_conclusie]?.kleur ?? "#64748b" }}
              >
                {CONCL[lead.erfcheck_conclusie]?.woord ?? lead.erfcheck_conclusie}
              </span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[11px] text-slate-400">Perceel</div>
              <div className="text-sm font-semibold text-slate-800">
                {lead.perceel_m2 != null ? `± ${lead.perceel_m2} m²` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Achtererf</div>
              <div className="text-sm font-semibold text-slate-800">
                {lead.achtererf_m2 != null ? `± ${lead.achtererf_m2} m²` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Vergunningvrij</div>
              <div className="text-sm font-semibold text-slate-800">
                {lead.max_vergunningvrij_m2 != null ? `± ${lead.max_vergunningvrij_m2} m²` : "—"}
              </div>
            </div>
          </div>
          {lead.report_token && (
            <a
              href={`/r/${lead.report_token}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs font-medium text-navy hover:underline"
            >
              Bekijk de volledige Erf Check »
            </a>
          )}
        </div>
      )}

      {/* Contactgegevens: alleen zichtbaar na vrijgave door opeigenerf */}
      {lead.contact_vrijgegeven ? (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Contactgegevens
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-800">
            {naam && <span className="col-span-2 font-medium">{naam}</span>}
            {lead.email && <span>{lead.email}</span>}
            {lead.telefoon && <span>{lead.telefoon}</span>}
            {(lead.postcode || lead.huisnummer) && (
              <span className="col-span-2">
                {[lead.postcode, lead.huisnummer, lead.toevoeging]
                  .filter(Boolean)
                  .join(" ")}
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400">
          Contactgegevens worden vrijgegeven door opeigenerf zodra er een match is.
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => reageer("afgewezen")}
          disabled={isPending || lead.reactie_status === "afgewezen"}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Niet passend
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </li>
  );
}
