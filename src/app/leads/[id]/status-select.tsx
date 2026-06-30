"use client";

import { useState, useTransition } from "react";
import { LEAD_STATUSES, STATUS_LABELS } from "@/lib/constants";
import { updateLeadStatus } from "../actions";

export function StatusSelect({
  leadId,
  current,
}: {
  leadId: string;
  current: string;
}) {
  const [value, setValue] = useState(current);
  const [isPending, startTransition] = useTransition();

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    startTransition(async () => {
      try {
        await updateLeadStatus(leadId, next);
      } catch {
        setValue(prev); // revert on failure
      }
    });
  }

  return (
    <select
      value={value}
      disabled={isPending}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
    >
      {LEAD_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
