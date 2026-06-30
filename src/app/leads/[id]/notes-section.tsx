"use client";

import { useRef, useState, useTransition } from "react";
import { addNote, deleteNote } from "../actions";
import type { LeadNote } from "@/lib/database.types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotesSection({
  leadId,
  notes,
}: {
  leadId: string;
  notes: LeadNote[];
}) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      await addNote(leadId, body);
      setBody("");
    });
  }

  return (
    <div>
      <form ref={formRef} onSubmit={submit} className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Notitie toevoegen…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending ? "Opslaan…" : "Notitie opslaan"}
        </button>
      </form>

      <ul className="mt-5 space-y-3">
        {notes.length === 0 && (
          <li className="text-sm text-slate-400">Nog geen notities.</li>
        )}
        {notes.map((n) => (
          <li
            key={n.id}
            className="rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <p className="whitespace-pre-wrap text-sm text-slate-800">
              {n.body}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>
                {n.author_email ? `${n.author_email} · ` : ""}
                {formatDate(n.created_at)}
              </span>
              <button
                onClick={() =>
                  startTransition(() => deleteNote(n.id, leadId))
                }
                className="text-slate-400 hover:text-red-600"
              >
                Verwijderen
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
