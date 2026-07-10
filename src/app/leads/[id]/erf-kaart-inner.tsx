"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, WMSTileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import area from "@turf/area";
import { saveErfTekening } from "./erf-actions";
import type { Json } from "@/lib/database.types";

type VlakType = "erf" | "bebouwbaar" | "overig";
const TYPE_META: Record<VlakType, { label: string; kleur: string }> = {
  erf: { label: "Erf / achtererf", kleur: "#16a34a" },
  bebouwbaar: { label: "Bebouwbaar", kleur: "#d97706" },
  overig: { label: "Overig", kleur: "#2563eb" },
};

type Vlak = { id: number; type: VlakType; m2: number };

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
}: {
  initial: any;
  typeRef: React.MutableRefObject<VlakType>;
  onChange: (vlakken: Vlak[], group: L.FeatureGroup) => void;
}) {
  const map = useMap();
  useEffect(() => {
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
}: {
  leadId: string;
  lat: number;
  lon: number;
  initial: any;
}) {
  const [vlakken, setVlakken] = useState<Vlak[]>([]);
  const [type, setType] = useState<VlakType>("erf");
  const [showKadaster, setShowKadaster] = useState(true);
  const [showBag, setShowBag] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const typeRef = useRef<VlakType>("erf");
  const groupRef = useRef<L.FeatureGroup | null>(null);
  typeRef.current = type;

  function onChange(v: Vlak[], group: L.FeatureGroup) {
    setVlakken(v);
    groupRef.current = group;
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
    const r = await saveErfTekening(leadId, fc);
    setSaving(false);
    setMsg(r.ok ? "Tekening opgeslagen." : `Opslaan mislukt: ${r.error}`);
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
          <Tekenlaag initial={initial} typeRef={typeRef} onChange={onChange} />
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
    </div>
  );
}
