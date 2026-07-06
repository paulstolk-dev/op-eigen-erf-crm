"use client";

import { useRouter, usePathname } from "next/navigation";

const PRESETS = [
  { label: "7 dagen", days: 7 },
  { label: "30 dagen", days: 30 },
  { label: "90 dagen", days: 90 },
  { label: "1 jaar", days: 365 },
];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function DashboardFilter({
  from,
  to,
  activeDays,
}: {
  from: string;
  to: string;
  activeDays: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams();
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function applyPreset(days: number) {
    const today = new Date();
    apply(iso(new Date(today.getTime() - (days - 1) * 86400000)), iso(today));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => applyPreset(p.days)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              activeDays === p.days
                ? "bg-navy text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => apply(e.target.value, to)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700"
        />
        <span className="text-slate-400">t/m</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => apply(from, e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700"
        />
      </div>
    </div>
  );
}
