"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateReport, saveDraft, sendReport } from "./report-actions";

export function ReportPanel({
  leadId,
  status,
  draftSubject,
  draftBody,
  pdfUrl,
  leadEmail,
}: {
  leadId: string;
  status: string;
  draftSubject: string;
  draftBody: string;
  pdfUrl: string | null;
  leadEmail: string | null;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(draftSubject);
  const [body, setBody] = useState(draftBody);
  const [msg, setMsg] = useState("");
  const [isGen, startGen] = useTransition();
  const [isSave, startSave] = useTransition();
  const [isSend, startSend] = useTransition();

  const hasReport = status === "rendered" || status === "sent";

  function onGenerate() {
    setMsg("");
    startGen(async () => {
      const r = await generateReport(leadId);
      if (!r.ok) setMsg(`Genereren mislukt: ${r.error}`);
      else {
        setMsg("Rapport gegenereerd.");
        router.refresh();
      }
    });
  }

  function onSave() {
    setMsg("");
    startSave(async () => {
      await saveDraft(leadId, subject, body);
      setMsg("Concept opgeslagen.");
    });
  }

  function onSend() {
    setMsg("");
    startSend(async () => {
      const r = await sendReport(leadId);
      if (!r.ok) setMsg(`Versturen mislukt: ${r.error}`);
      else {
        setMsg("Rapport verstuurd naar de lead.");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Rapport &amp; mail</h2>
        {status === "sent" && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 ring-1 ring-inset ring-green-600/20">
            Verstuurd
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isGen}
          onClick={onGenerate}
          className="rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isGen
            ? "Claude schrijft…"
            : hasReport
              ? "Opnieuw genereren"
              : "Genereer rapport (Claude)"}
        </button>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            PDF bekijken
          </a>
        )}
      </div>

      {hasReport && (
        <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Onderwerp
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Concept-mail aan de lead
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSave}
              onClick={onSave}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {isSave ? "Opslaan…" : "Concept opslaan"}
            </button>
            <button
              type="button"
              disabled={isSend || !leadEmail}
              onClick={onSend}
              title={leadEmail ? "" : "Lead heeft geen e-mailadres"}
              className="rounded-lg bg-erf px-3 py-2 text-sm font-medium text-white transition hover:bg-erf-700 disabled:opacity-50"
            >
              {isSend ? "Versturen…" : `Verstuur naar lead${leadEmail ? "" : " (geen e-mail)"}`}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p
          className={`mt-3 text-sm ${
            msg.includes("mislukt") ? "text-red-600" : "text-green-600"
          }`}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
