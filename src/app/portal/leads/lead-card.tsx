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
          onClick={() => reageer("geinteresseerd")}
          disabled={isPending || lead.reactie_status === "geinteresseerd"}
          className="rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          Geïnteresseerd
        </button>
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
