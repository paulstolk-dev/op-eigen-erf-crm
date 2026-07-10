"use client";

import dynamic from "next/dynamic";

// Leaflet raakt `window` aan bij import → alleen client-side laden.
const ErfKaartInner = dynamic(() => import("./erf-kaart-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Kaart laden…
    </div>
  ),
});

export function ErfKaart(props: {
  leadId: string;
  lat: number;
  lon: number;
  initial: unknown;
}) {
  return <ErfKaartInner {...props} initial={props.initial} />;
}
