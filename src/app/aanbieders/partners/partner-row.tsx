"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setPartnerStatus,
  saveContact,
  verstuurPitch,
  saveLeadafspraak,
} from "../partner-actions";
import {
  PARTNER_STATUS,
  PARTNER_STATUS_LABELS,
  PARTNER_STATUS_STYLES,
} from "@/lib/aanbieders-constants";

type Row = {
  id: string;
  naam: string;
  contact_naam: string | null;
  contact_email: string | null;
  partner_status: string;
  partner_benaderd_at: string | null;
  partner_pitch_step: number | null;
  leads_afspraak_getekend_at: string | null;
  lead_prijs_eur: number | null;
};

const inp =
  "w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-900";

export function PartnerRow({ row }: { row: Row }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [naam, setNaam] = useState(row.contact_naam ?? "");
  const [email, setEmail] = useState(row.contact_email ?? "");
  const [status, setStatus] = useState(row.partner_status);
  const [msg, setMsg] = useState<string | null>(null);

  // Afnameafspraak: datum als YYYY-MM-DD voor <input type="date">.
  const afspraakInit = (row.leads_afspraak_getekend_at ?? "").slice(0, 10);
  const prijsInit = row.lead_prijs_eur != null ? String(row.lead_prijs_eur) : "";
  const [afspraak, setAfspraak] = useState(afspraakInit);
  const [prijs, setPrijs] = useState(prijsInit);
  const afspraakDirty = afspraak !== afspraakInit || prijs !== prijsInit;

  function opslaanAfspraak() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveLeadafspraak(row.id, afspraak, prijs);
      if (res.ok) router.refresh();
      else setMsg(res.error ?? "Mislukt");
    });
  }

  const dirty = naam !== (row.contact_naam ?? "") || email !== (row.contact_email ?? "");
  const savedEmail = (row.contact_email ?? "").trim();

  function opslaan() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveContact(row.id, naam, email);
      if (res.ok) router.refresh();
      else setMsg(res.error ?? "Mislukt");
    });
  }

  function wijzigStatus(next: string) {
    setStatus(next);
    startTransition(async () => {
      await setPartnerStatus(row.id, next);
      router.refresh();
    });
  }

  function pitch() {
    if (!confirm(`Wervingsmail sturen naar ${savedEmail}?`)) return;
    setMsg(null);
    startTransition(async () => {
      const res = await verstuurPitch(row.id);
      if (res.ok) {
        setMsg("Pitch verstuurd.");
        router.refresh();
      } else setMsg(res.error ?? "Mislukt");
    });
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-3 py-3 font-medium text-slate-900">{row.naam}</td>
      <td className="px-3 py-3">
        <input
          className={inp}
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          placeholder="Contactpersoon (optioneel)"
        />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <input
            className={inp}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e-mail"
          />
          {dirty && (
            <button
              onClick={opslaan}
              disabled={isPending}
              className="shrink-0 rounded bg-navy px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              ✓
            </button>
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <select
          value={status}
          disabled={isPending}
          onChange={(e) => wijzigStatus(e.target.value)}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
            PARTNER_STATUS_STYLES[status] ?? PARTNER_STATUS_STYLES.prospect
          }`}
        >
          {PARTNER_STATUS.map((s) => (
            <option key={s} value={s}>
              {PARTNER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
      <td className="hidden px-3 py-3 text-xs text-slate-500 md:table-cell">
        {row.partner_benaderd_at
          ? new Date(row.partner_benaderd_at).toLocaleDateString("nl-NL", {
              day: "2-digit",
              month: "short",
            })
          : "—"}
        {row.partner_pitch_step && row.partner_pitch_step > 0 && (
          <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            mail {row.partner_pitch_step}/3
          </span>
        )}
      </td>
      {/* Afnameafspraak voor doorverwijzingen: bepaalt of deze aanbieder leads
          mag ontvangen. Staat los van partner_status/partner_tier, die alleen
          over de weergave op de site gaan. */}
      <td className="px-3 py-3 min-w-[15rem]">
        <div className="flex items-center gap-1">
          <input
            type="date"
            className={inp}
            value={afspraak}
            onChange={(e) => setAfspraak(e.target.value)}
            title="Datum waarop de afnameafspraak is getekend. Leeg = ontvangt geen leads."
          />
          <input
            className={`${inp.replace("w-full", "w-24")} shrink-0`}
            value={prijs}
            onChange={(e) => setPrijs(e.target.value)}
            placeholder="€/lead"
            title="Vaste prijs per doorverwijzing. Leeg = prijs volgens budget-band."
          />
          <button
            onClick={opslaanAfspraak}
            disabled={isPending}
            title="Leadafspraak opslaan"
            className={`shrink-0 rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${
              afspraakDirty
                ? "bg-navy text-white"
                : "border border-slate-300 text-slate-500 hover:bg-slate-50"
            }`}
          >
            ✓
          </button>
        </div>
        <div className="mt-1 text-[10px] font-medium uppercase tracking-wide">
          {afspraakInit ? (
            <span className="text-emerald-600">Ontvangt leads</span>
          ) : (
            <span className="text-slate-400">Ontvangt geen leads</span>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        <button
          onClick={pitch}
          disabled={isPending || !savedEmail || dirty}
          title={
            !savedEmail
              ? "Vul eerst een e-mail in en sla op"
              : dirty
                ? "Sla eerst de contactwijziging op"
                : ""
          }
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
        >
          Verstuur pitch
        </button>
        {msg && <div className="mt-1 text-xs text-slate-500">{msg}</div>}
      </td>
    </tr>
  );
}
