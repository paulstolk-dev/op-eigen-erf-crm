"use client";

import { useState } from "react";

export type DayPoint = { date: string; leads: number; cost: number };

const W = 760;
const H = 260;
const PAD = { top: 18, right: 46, bottom: 26, left: 34 };
const x0 = PAD.left;
const x1 = W - PAD.right;
const y0 = PAD.top;
const y1 = H - PAD.bottom;
const plotW = x1 - x0;
const plotH = y1 - y0;

function euro(n: number): string {
  return n.toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function dayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

export function DashboardChart({ data }: { data: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const n = Math.max(1, data.length);
  const slot = plotW / n;
  const barW = Math.max(2, slot * 0.55);

  const leadsMax = Math.max(1, ...data.map((d) => d.leads));
  const costMax = Math.max(1, ...data.map((d) => d.cost));

  const xCenter = (i: number) => x0 + slot * i + slot / 2;
  const leadsY = (v: number) => y1 - (v / leadsMax) * plotH;
  const costY = (v: number) => y1 - (v / costMax) * plotH;

  const linePts = data
    .map((d, i) => `${xCenter(i).toFixed(1)},${costY(d.cost).toFixed(1)}`)
    .join(" ");

  // Toon elke ~5e datum als x-label.
  const step = Math.ceil(n / 6);

  const totLeads = data.reduce((s, d) => s + d.leads, 0);
  const totCost = data.reduce((s, d) => s + d.cost, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Leads &amp; advertentiekosten per dag{" "}
          <span className="font-normal text-slate-400">(laatste 30 dagen)</span>
        </h2>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-navy" />
            Leads · {totLeads}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded bg-erf" />
            Ad-spend · {euro(totCost)}
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: "auto" }}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHover(null)}
      >
        {/* horizontale gridlijnen + leads-as (links) */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = y1 - t * plotH;
          return (
            <g key={t}>
              <line x1={x0} x2={x1} y1={y} y2={y} className="stroke-slate-100" />
              <text
                x={x0 - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400"
                style={{ fontSize: 9 }}
              >
                {Math.round(t * leadsMax)}
              </text>
              <text
                x={x1 + 6}
                y={y + 3}
                textAnchor="start"
                className="fill-erf"
                style={{ fontSize: 9 }}
              >
                {euro(t * costMax)}
              </text>
            </g>
          );
        })}

        {/* bars: leads */}
        {data.map((d, i) => (
          <rect
            key={i}
            x={xCenter(i) - barW / 2}
            y={leadsY(d.leads)}
            width={barW}
            height={Math.max(0, y1 - leadsY(d.leads))}
            rx={1.5}
            className={hover === i ? "fill-navy" : "fill-navy/70"}
          />
        ))}

        {/* lijn: ads-kosten */}
        <polyline
          points={linePts}
          fill="none"
          className="stroke-erf"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xCenter(i)}
            cy={costY(d.cost)}
            r={hover === i ? 3.5 : 2}
            className="fill-erf"
          />
        ))}

        {/* x-labels */}
        {data.map((d, i) =>
          i % step === 0 ? (
            <text
              key={i}
              x={xCenter(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-slate-400"
              style={{ fontSize: 9 }}
            >
              {dayLabel(d.date)}
            </text>
          ) : null,
        )}

        {/* hover-guide + tooltip */}
        {hover !== null && (
          <g>
            <line
              x1={xCenter(hover)}
              x2={xCenter(hover)}
              y1={y0}
              y2={y1}
              className="stroke-slate-300"
              strokeDasharray="3 3"
            />
            {(() => {
              const d = data[hover];
              const tw = 118;
              const tx = Math.min(Math.max(xCenter(hover) - tw / 2, x0), x1 - tw);
              return (
                <g transform={`translate(${tx}, ${y0})`}>
                  <rect
                    width={tw}
                    height={44}
                    rx={6}
                    className="fill-slate-900"
                    opacity={0.92}
                  />
                  <text x={8} y={15} className="fill-white" style={{ fontSize: 10, fontWeight: 600 }}>
                    {dayLabel(d.date)}
                  </text>
                  <text x={8} y={29} className="fill-slate-200" style={{ fontSize: 10 }}>
                    Leads: {d.leads}
                  </text>
                  <text x={8} y={40} className="fill-slate-200" style={{ fontSize: 10 }}>
                    Ad-spend: {euro(d.cost)}
                  </text>
                </g>
              );
            })()}
          </g>
        )}

        {/* transparante hover-zones */}
        {data.map((d, i) => (
          <rect
            key={i}
            x={x0 + slot * i}
            y={y0}
            width={slot}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
    </div>
  );
}
