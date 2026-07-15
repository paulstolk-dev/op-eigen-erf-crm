"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  defaultVideoSettings,
  videoDuration,
  type VideoSettings,
} from "@/lib/video-settings";
import {
  saveVideoSettings,
  uploadVideoLogo,
  clearVideoLogo,
  uploadVideoMusic,
  clearVideoMusic,
} from "./video-settings-actions";

function Kleur({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-navy"
        />
      </div>
    </div>
  );
}

function Getal({
  label,
  value,
  onChange,
  step = 1,
  min,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {suffix ? ` (${suffix})` : ""}
      </label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy"
      />
    </div>
  );
}

export function VideoSettingsPanel({ initial }: { initial: VideoSettings }) {
  const router = useRouter();
  const [s, setS] = useState<VideoSettings>(initial);
  const [msg, setMsg] = useState("");
  const [isSave, startSave] = useTransition();
  const [isLogo, startLogo] = useTransition();
  const [isMusic, startMusic] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const musicRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof VideoSettings>(k: K, v: VideoSettings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  function onSave() {
    setMsg("");
    startSave(async () => {
      const r = await saveVideoSettings(s);
      setMsg(r.ok ? "Instellingen opgeslagen." : `Opslaan mislukt: ${r.error}`);
      if (r.ok) router.refresh();
    });
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg("");
    const fd = new FormData();
    fd.set("logo", file);
    startLogo(async () => {
      const r = await uploadVideoLogo(fd);
      if (r.ok && r.url) {
        setS((prev) => ({ ...prev, logoUrl: r.url!, logoPath: prev.logoPath }));
        setMsg("Logo geüpload.");
        router.refresh();
      } else {
        setMsg(`Logo-upload mislukt: ${r.error}`);
      }
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function onClearLogo() {
    startLogo(async () => {
      const r = await clearVideoLogo();
      if (r.ok) {
        setS((prev) => ({ ...prev, logoUrl: null, logoPath: null }));
        router.refresh();
      }
    });
  }

  function onMusic(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg("");
    const fd = new FormData();
    fd.set("music", file);
    startMusic(async () => {
      const r = await uploadVideoMusic(fd);
      if (r.ok && r.url) {
        setS((prev) => ({ ...prev, musicUrl: r.url! }));
        setMsg("Muziek geüpload.");
        router.refresh();
      } else {
        setMsg(`Muziek-upload mislukt: ${r.error}`);
      }
      if (musicRef.current) musicRef.current.value = "";
    });
  }

  function onClearMusic() {
    startMusic(async () => {
      const r = await clearVideoMusic();
      if (r.ok) {
        setS((prev) => ({ ...prev, musicUrl: null, musicPath: null }));
        router.refresh();
      }
    });
  }

  const dur3 = videoDuration(s, 3);
  const dur4 = videoDuration(s, 4);

  return (
    <details className="rounded-xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">
        Video-instellingen
        <span className="ml-2 font-normal text-slate-400">
          {s.width}×{s.height} · {s.fps} fps · ± {Math.round(dur3)}–{Math.round(dur4)} sec
        </span>
      </summary>

      <div className="mt-4 space-y-5">
        {/* Formaat + duur */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-erf">
            Formaat & duur
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Getal label="Breedte" value={s.width} onChange={(v) => set("width", v)} suffix="px" min={16} />
            <Getal label="Hoogte" value={s.height} onChange={(v) => set("height", v)} suffix="px" min={16} />
            <Getal label="FPS" value={s.fps} onChange={(v) => set("fps", v)} min={1} />
            <Getal label="Intro" value={s.intro} onChange={(v) => set("intro", v)} step={0.5} suffix="sec" min={0} />
            <Getal label="Per scene" value={s.perScene} onChange={(v) => set("perScene", v)} step={0.5} suffix="sec" min={0.5} />
            <Getal label="Outro" value={s.outro} onChange={(v) => set("outro", v)} step={0.5} suffix="sec" min={0} />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Totale duur: ± {dur3.toFixed(1)} sec (3 scenes) — {dur4.toFixed(1)} sec (4 scenes).
          </p>
        </div>

        {/* Kleuren + vorm */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-erf">
            Stijl
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kleur label="Achtergrond" value={s.bg} onChange={(v) => set("bg", v)} />
            <Kleur label="Accent" value={s.accent} onChange={(v) => set("accent", v)} />
            <Kleur label="Cards" value={s.card} onChange={(v) => set("card", v)} />
            <Kleur label="Tekst" value={s.text} onChange={(v) => set("text", v)} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Getal label="Hoekafronding" value={s.radius} onChange={(v) => set("radius", v)} suffix="px" min={0} />
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Logo-positie
              </label>
              <select
                value={s.logoPosition}
                onChange={(e) => set("logoPosition", e.target.value as VideoSettings["logoPosition"])}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy"
              >
                <option value="linksboven">Linksboven</option>
                <option value="rechtsonder">Rechtsonder</option>
              </select>
            </div>
            <Getal
              label="Logo-grootte"
              value={s.logoSize}
              onChange={(v) => set("logoSize", v)}
              suffix="px hoog"
              step={10}
              min={40}
            />
          </div>
        </div>

        {/* Logo */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-erf">Logo</p>
          <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={s.logoOpOutro}
              onChange={(e) => set("logoOpOutro", e.target.checked)}
            />
            Hoek-logo óók op de laatste slide (outro) tonen
            <span className="text-xs text-slate-400">— de outro heeft al een eigen gecentreerd logo</span>
          </label>
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-slate-200"
              style={{ backgroundColor: s.bg }}
            >
              {s.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logoUrl} alt="logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-[10px] text-slate-400">geen</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={onLogo}
                disabled={isLogo}
                className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-navy-700"
              />
              {s.logoUrl && (
                <button
                  type="button"
                  onClick={onClearLogo}
                  disabled={isLogo}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Verwijderen
                </button>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            PNG met transparante achtergrond werkt het best. Max 3 MB. Wordt{" "}
            {s.logoPosition === "linksboven" ? "linksboven" : "rechtsonder"} in beeld gezet.
          </p>
        </div>

        {/* Achtergrondmuziek */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-erf">
            Achtergrondmuziek
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600">
              {s.musicUrl ? "🎵 track ingesteld" : "geen muziek"}
            </span>
            <input
              ref={musicRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac,audio/mp4"
              onChange={onMusic}
              disabled={isMusic}
              className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-navy-700"
            />
            {s.musicUrl && (
              <button
                type="button"
                onClick={onClearMusic}
                disabled={isMusic}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Verwijderen
              </button>
            )}
          </div>
          {s.musicUrl && (
            <div className="mt-3">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio src={s.musicUrl} controls className="h-9 w-full max-w-md" />
            </div>
          )}
          <div className="mt-3 flex items-center gap-3">
            <label className="w-28 text-xs font-medium text-slate-600">Volume</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.musicVolume}
              onChange={(e) => set("musicVolume", Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-10 text-right text-sm text-slate-700">
              {Math.round(s.musicVolume * 100)}%
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Rustige, royaltyvrije track. Max 15 MB (mp3/wav/ogg/m4a). Loopt onder de hele
            video met een zachte fade-out. Vergeet niet op &quot;Opslaan&quot; te klikken.
          </p>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={isSave}
            onClick={onSave}
            className="rounded-lg bg-erf px-4 py-2 text-sm font-medium text-white transition hover:bg-erf-700 disabled:opacity-50"
          >
            {isSave ? "Opslaan…" : "Instellingen opslaan"}
          </button>
          <button
            type="button"
            onClick={() => setS({ ...defaultVideoSettings, logoPath: s.logoPath, logoUrl: s.logoUrl })}
            className="text-sm text-slate-500 hover:text-navy"
          >
            Herstel standaardstijl
          </button>
          {msg && (
            <span className={`text-sm ${msg.includes("mislukt") ? "text-red-600" : "text-green-600"}`}>
              {msg}
            </span>
          )}
        </div>
      </div>
    </details>
  );
}
