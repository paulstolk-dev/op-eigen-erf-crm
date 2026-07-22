"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLeadExcluded } from "../actions";

export function ExcludeLeadButton({
  leadId,
  excluded,
}: {
  leadId: string;
  excluded: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onToggle() {
    setError(null);
    startTransition(async () => {
      const res = await setLeadExcluded(leadId, !excluded);
      if (!res.ok) {
        setError(res.error ?? "Bijwerken mislukt.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onToggle}
        disabled={isPending}
        title={
          excluded
            ? "Deze lead telt niet mee in het dashboard. Klik om weer mee te tellen."
            : "Deze lead uitsluiten van de dashboard-telling (bijv. een test-lead)."
        }
        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
          excluded
            ? "border-amber-300 text-amber-700 hover:bg-amber-50"
            : "border-slate-300 text-slate-600 hover:bg-slate-50"
        }`}
      >
        {isPending
          ? "Opslaan…"
          : excluded
            ? "Weer meetellen in dashboard"
            : "Uitsluiten van dashboard"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
