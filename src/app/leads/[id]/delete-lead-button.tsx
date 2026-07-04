"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLead } from "../actions";

export function DeleteLeadButton({
  leadId,
  leadNaam,
}: {
  leadId: string;
  leadNaam: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (
      !confirm(
        `Lead "${leadNaam}" definitief verwijderen? Dit verwijdert ook de erfscan, notities en eventuele deelrecords. Dit kan niet ongedaan worden gemaakt.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await deleteLead(leadId);
        router.push("/dashboard");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Verwijderen mislukt.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onDelete}
        disabled={isPending}
        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? "Verwijderen…" : "Lead verwijderen"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
