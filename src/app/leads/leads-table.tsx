"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/status-badge";
import {
  LEAD_STATUSES,
  LEAD_TYPES,
  STATUS_LABELS,
  TYPE_LABELS,
  typeLabel,
  ERFSCAN_STATUS_STYLES,
  erfscanStatusLabel,
} from "@/lib/constants";
import type { Lead } from "@/lib/database.types";

type ErfscanInfo = { status: string; conclusie: string | null };

const ERFSCAN_SHORT: Record<string, string> = {
  queued: "Wachtrij",
  enriching: "Bezig…",
  needs_review: "Klaar",
  rendered: "Rapport",
  sent: "Verstuurd",
  error: "Fout",
};

type DateFilter = "all" | "today" | "7d" | "30d";

function fullName(l: Lead): string {
  return (
    l.naam ||
    [l.voornaam, l.achternaam].filter(Boolean).join(" ") ||
    l.email ||
    "—"
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function withinRange(iso: string, filter: DateFilter): boolean {
  if (filter === "all") return true;
  const created = new Date(iso).getTime();
  const now = Date.now();
  const day = 86_400_000;
  if (filter === "today") return now - created < day;
  if (filter === "7d") return now - created < 7 * day;
  return now - created < 30 * day;
}

export function LeadsTable({
  initialLeads,
  erfscanByLead = {},
}: {
  initialLeads: Lead[];
  erfscanByLead?: Record<string, ErfscanInfo>;
}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [flash, setFlash] = useState<Set<string>>(new Set());

  // Realtime: keep the table in sync with inserts/updates/deletes.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const lead = payload.new as Lead;
            setLeads((prev) =>
              prev.some((l) => l.id === lead.id) ? prev : [lead, ...prev],
            );
            setFlash((prev) => new Set(prev).add(lead.id));
            setTimeout(
              () =>
                setFlash((prev) => {
                  const next = new Set(prev);
                  next.delete(lead.id);
                  return next;
                }),
              4000,
            );
          } else if (payload.eventType === "UPDATE") {
            const lead = payload.new as Lead;
            setLeads((prev) =>
              prev.map((l) => (l.id === lead.id ? lead : l)),
            );
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setLeads((prev) => prev.filter((l) => l.id !== old.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (type !== "all" && l.type !== type) return false;
      if (!withinRange(l.created_at, dateFilter)) return false;
      if (q) {
        const hay = [
          l.naam,
          l.voornaam,
          l.achternaam,
          l.email,
          l.telefoon,
          l.postcode,
          l.source,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, status, type, dateFilter]);

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Zoek op naam, e-mail, telefoon, postcode…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[240px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Alle types</option>
          {LEAD_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Alle statussen</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Alle datums</option>
          <option value="today">Vandaag</option>
          <option value="7d">Laatste 7 dagen</option>
          <option value="30d">Laatste 30 dagen</option>
        </select>
      </div>

      <p className="mb-2 text-xs text-slate-500">
        {filtered.length} van {leads.length} leads
      </p>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Naam</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Erfscan</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Contact
              </th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">
                Plaats
              </th>
              <th className="px-4 py-3 font-medium">Binnengekomen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  Geen leads gevonden.
                </td>
              </tr>
            )}
            {filtered.map((l) => (
              <tr
                key={l.id}
                className={`transition-colors hover:bg-slate-50 ${
                  flash.has(l.id) ? "bg-blue-50" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/leads/${l.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {fullName(l)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{typeLabel(l.type)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={l.status} />
                </td>
                <td className="px-4 py-3">
                  {erfscanByLead[l.id] ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        ERFSCAN_STATUS_STYLES[erfscanByLead[l.id].status] ??
                        "bg-slate-100 text-slate-700 ring-slate-500/20"
                      }`}
                      title={erfscanStatusLabel(erfscanByLead[l.id].status)}
                    >
                      {ERFSCAN_SHORT[erfscanByLead[l.id].status] ??
                        erfscanByLead[l.id].status}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                  {l.email || l.telefoon || "—"}
                </td>
                <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                  {[l.postcode, l.huisnummer].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {formatDate(l.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
