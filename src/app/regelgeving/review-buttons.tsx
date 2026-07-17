"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setWijzigingStatus } from "./actions";

const STATUS_STYLE: Record<string, string> = {
  nieuw: "bg-amber-100 text-amber-800 ring-amber-600/20",
  verwerkt: "bg-green-100 text-green-800 ring-green-600/20",
  afgewezen: "bg-slate-100 text-slate-500 ring-slate-400/20",
};
const STATUS_LABEL: Record<string, string> = {
  nieuw: "Nieuw",
  verwerkt: "Verwerkt",
  afgewezen: "Afgewezen",
};

export function ReviewButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [huidig, setHuidig] = useState(status);
  const [isPending, start] = useTransition();

  function zet(next: string) {
    start(async () => {
      const r = await setWijzigingStatus(id, next);
      if (r.ok) {
        setHuidig(next);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[huidig] ?? STATUS_STYLE.nieuw}`}
      >
        {STATUS_LABEL[huidig] ?? huidig}
      </span>
      {huidig !== "verwerkt" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => zet("verwerkt")}
          className="rounded-md border border-green-300 px-2 py-0.5 text-xs font-medium text-green-700 transition hover:bg-green-50 disabled:opacity-50"
        >
          Verwerkt
        </button>
      )}
      {huidig !== "afgewezen" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => zet("afgewezen")}
          className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Afwijzen
        </button>
      )}
    </div>
  );
}
