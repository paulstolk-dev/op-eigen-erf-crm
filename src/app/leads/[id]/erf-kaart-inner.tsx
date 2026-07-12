"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, WMSTileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import area from "@turf/area";
import type { Json } from "@/lib/database.types";

type SaveResult = { ok: boolean; error?: string };
export type ErfKaartProps = {
  leadId: string;
  lat: number;
  lon: number;
  initial: unknown;
  initialSnapshotUrl?: string | null;
  saveTekening: (leadId: string, tekening: Json | null) => Promise<SaveResult>;
  saveSnapshot: (formData: FormData) => Promise<SaveResult>;
};

type VlakType = "erf" | "bebouwbaar" | "overig";
const TYPE_META: Record<VlakType, { label: string; kleur: string }> = {
  erf: { label: "Erf / achtererf", kleur: "#16a34a" },
  bebouwbaar: { label: "Bebouwbaar", kleur: "#d97706" },
  overig: { label: "Overig", kleur: "#2563eb" },
};

type Vlak = { id: number; type: VlakType; m2: number };

// WGS84 lon/lat → EPSG:3857 (web mercator) meters.
const MERC_R = 6378137;
function toMerc(lon: number, lat: number): [number, number] {
  return [
    (MERC_R * lon * Math.PI) / 180,
    MERC_R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
  ];
}
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function wmsGetMap(base: string, layers: string, format: string, transparent: boolean, bbox: string, w: number, h: number): string {
  const p = new URLSearchParams({
    service: "WMS", request: "GetMap", version: "1.3.0", layers, styles: "",
    crs: "EPSG:3857", bbox, width: String(w), height: String(h), format,
    transparent: String(transparent),
  });
  return `${base}?${p.toString()}`;
}
function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

function styleLayer(layer: any, type: VlakType) {
  layer.options.erftype = type;
  const k = TYPE_META[type].kleur;
  layer.setStyle?.({ color: k, fillColor: k, fillOpacity: 0.25, weight: 3 });
}

// Zet geoman op, laadt bestaande tekening en meldt wijzigingen terug.
function Tekenlaag({
  initial,
  typeRef,
  onChange,
  onMap,
}: {
  initial: any;
  typeRef: React.MutableRefObject<VlakType>;
  onChange: (vlakken: Vlak[], group: L.FeatureGroup) => void;
  onMap: (map: L.Map) => void;
}) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
    const group = new L.FeatureGroup().addTo(map);
    (map as any).pm.setGlobalOptions({ layerGroup: group });
    (map as any).pm.addControls({
      position: "topleft",
      drawPolygon: true,
      drawRectangle: true,
      editMode: true,
      dragMode: true,
      removalMode: true,
      rotateMode: false,
      cutPolygon: false,
      drawMarker: false,
      drawCircle: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawText: false,
    });

    function recompute() {
      const vlakken: Vlak[] = [];
      group.eachLayer((layer: any) => {
        try {
          const m2 = Math.round(area(layer.toGeoJSON()));
          vlakken.push({ id: L.Util.stamp(layer), type: layer.options.erftype ?? "erf", m2 });
        } catch {
          /* skip */
        }
      });
      onChange(vlakken, group);
    }

    map.on("pm:create", (e: any) => {
      styleLayer(e.layer, typeRef.current);
      e.layer.on("pm:edit", recompute);
      recompute();
    });
    map.on("pm:remove", recompute);

    // Bestaande tekening laden.
    if (initial?.features?.length) {
      const gj = L.geoJSON(initial);
      gj.eachLayer((l: any) => {
        const type = (l.feature?.properties?.type as VlakType) ?? "erf";
        styleLayer(l, type);
        l.addTo(group);
        l.on("pm:edit", recompute);
      });
      // pas center/zoom aan op de tekening.
      const b = group.getBounds();
      if (b.isValid()) map.fitBounds(b, { padding: [40, 40], maxZoom: 20 });
    }
    recompute();

    return () => {
      try {
        (map as any).pm.removeControls();
      } catch {
        /* noop */
      }
      group.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

export default function ErfKaartInner({
  leadId,
  lat,
  lon,
  initial,
  initialSnapshotUrl,
  saveTekening,
  saveSnapshot,
}: ErfKaartProps) {
  const [vlakken, setVlakken] = useState<Vlak[]>([]);
  const [type, setType] = useState<VlakType>("erf");
  const [showKadaster, setShowKadaster] = useState(true);
  const [showBag, setShowBag] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(initialSnapshotUrl ?? null);
  const typeRef = useRef<VlakType>("erf");
  const groupRef = useRef<L.FeatureGroup | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  typeRef.current = type;

  function onChange(v: Vlak[], group: L.FeatureGroup) {
    setVlakken(v);
    groupRef.current = group;
  }

  // Platte PNG: PDOK-luchtfoto + kadaster + de ingetekende vlakken op één canvas.
  async function makeSnapshot(): Promise<Blob | null> {
    const map = mapRef.current;
    const group = groupRef.current;
    if (!map) return null;
    const b = map.getBounds();
    const [minX, minY] = toMerc(b.getWest(), b.getSouth());
    const [maxX, maxY] = toMerc(b.getEast(), b.getNorth());
    const W = 1200;
    const H = Math.max(300, Math.min(1400, Math.round((W * (maxY - minY)) / (maxX - minX))));
    const bbox = `${minX},${minY},${maxX},${maxY}`;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const aerial = await loadImg(
      wmsGetMap("https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0", "Actueel_orthoHR", "image/jpeg", false, bbox, W, H),
    );
    ctx.drawImage(aerial, 0, 0, W, H);
    try {
      const kad = await loadImg(
        wmsGetMap("https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0", "Kadastralekaart", "image/png", true, bbox, W, H),
      );
      ctx.drawImage(kad, 0, 0, W, H);
    } catch {
      /* kadaster-laag optioneel */
    }

    group?.eachLayer((layer: any) => {
      const gj = layer.toGeoJSON();
      const ring: number[][] = gj.geometry?.coordinates?.[0] ?? [];
      if (ring.length < 3) return;
      const kleur = TYPE_META[(layer.options.erftype as VlakType) ?? "erf"].kleur;
      ctx.beginPath();
      ring.forEach(([lo, la], i) => {
        const [X, Y] = toMerc(lo, la);
        const px = ((X - minX) / (maxX - minX)) * W;
        const py = ((maxY - Y) / (maxY - minY)) * H;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = hexA(kleur, 0.28);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = kleur;
      ctx.stroke();
    });

    return await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  }

  async function save() {
    const group = groupRef.current;
    if (!group) return;
    setMsg("");
    setSaving(true);
    const features: any[] = [];
    group.eachLayer((layer: any) => {
      const gj = layer.toGeoJSON();
      gj.properties = { type: layer.options.erftype ?? "erf", m2: Math.round(area(gj)) };
      features.push(gj);
    });
    const fc =
      features.length > 0 ? ({ type: "FeatureCollection", features } as unknown as Json) : null;
    const r = await saveTekening(leadId, fc);
    if (!r.ok) {
      setSaving(false);
      setMsg(`Opslaan mislukt: ${r.error}`);
      return;
    }
    // Platte afbeelding genereren + uploaden (best-effort — vectoren zijn al bewaard).
    let imgOk = false;
    try {
      const blob = await makeSnapshot();
      if (blob) {
        const fd = new FormData();
        fd.set("lead_id", leadId);
        fd.set("file", new File([blob], "tekening.png", { type: "image/png" }));
        const up = await saveSnapshot(fd);
        imgOk = up.ok;
        if (up.ok) setSnapshotUrl(URL.createObjectURL(blob));
      }
    } catch {
      /* afbeelding optioneel */
    }
    setSaving(false);
    setMsg(imgOk ? "Tekening + afbeelding opgeslagen." : "Tekening opgeslagen (afbeelding mislukt).");
  }

  const totaal = (t: VlakType) =>
    vlakken.filter((v) => v.type === t).reduce((s, v) => s + v.m2, 0);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-slate-600">Nieuw vlak:</span>
        {(Object.keys(TYPE_META) as VlakType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${
              type === t ? "text-white" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
            }`}
            style={type === t ? { backgroundColor: TYPE_META[t].kleur, borderColor: "transparent" } : {}}
          >
            {TYPE_META[t].label}
          </button>
        ))}
        <span className="ml-2 text-xs text-slate-400">
          Kies een type en teken links met het polygon-gereedschap.
        </span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showKadaster} onChange={(e) => setShowKadaster(e.target.checked)} />
          Kadaster (perceelgrenzen)
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showBag} onChange={(e) => setShowBag(e.target.checked)} />
          BAG (panden)
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <MapContainer
          center={[lat, lon]}
          zoom={19}
          maxZoom={22}
          style={{ height: 480, width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg"
            maxNativeZoom={20}
            maxZoom={22}
            attribution="Luchtfoto &copy; PDOK / Beeldmateriaal Nederland"
          />
          {showKadaster && (
            <WMSTileLayer
              url="https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0"
              layers="Kadastralekaart"
              format="image/png"
              transparent
              version="1.3.0"
              maxZoom={22}
            />
          )}
          {showBag && (
            <WMSTileLayer
              url="https://service.pdok.nl/lv/bag/wms/v2_0"
              layers="pand"
              format="image/png"
              transparent
              version="1.3.0"
              opacity={0.6}
              maxZoom={22}
            />
          )}
          <Tekenlaag
            initial={initial}
            typeRef={typeRef}
            onChange={onChange}
            onMap={(m) => (mapRef.current = m)}
          />
        </MapContainer>
      </div>

      {/* Overzicht + opslaan */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-sm">
          {(Object.keys(TYPE_META) as VlakType[]).map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: TYPE_META[t].kleur }} />
              {TYPE_META[t].label}:{" "}
              <strong>{totaal(t).toLocaleString("nl-NL")} m²</strong>
              <span className="text-slate-400">
                ({vlakken.filter((v) => v.type === t).length})
              </span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {msg && (
            <span className={`text-sm ${msg.includes("mislukt") ? "text-red-600" : "text-green-600"}`}>
              {msg}
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
          >
            {saving ? "Opslaan…" : "Tekening opslaan"}
          </button>
        </div>
      </div>

      {snapshotUrl && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Opgeslagen afbeelding
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={snapshotUrl}
            alt="Erf-intekening"
            className="max-h-64 w-auto rounded-lg border border-slate-200"
          />
        </div>
      )}
    </div>
  );
}
