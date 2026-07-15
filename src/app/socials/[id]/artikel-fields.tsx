"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveArtikelSocial } from "../actions";

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";
const label = "block text-xs font-medium text-slate-600 mb-1";

type Velden = {
  content_processed: boolean;
  ytvideo_url: string;
  instareel_url: string;
  instapost_tekst: string;
  youtube_title: string;
  yt_post_tekst: string;
};

/**
 * Social-uitwerking van het gekoppelde artikel: alle social-teksten op één plek.
 * Instagram-post tekst + YouTube-titel synchroniseren mee naar de caption van de
 * aflevering; de overige velden staan op de artikelen-tabel.
 */
export function ArtikelFields({
  afleveringId,
  artikelId,
  artikelTitel,
  initial,
}: {
  afleveringId: string;
  artikelId: string;
  artikelTitel: string;
  initial: Velden;
}) {
  const router = useRouter();
  const [f, setF] = useState<Velden>(initial);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function set<K extends keyof Velden>(k: K, v: Velden[K]) {
    setF((p) => ({ ...p, [k]: v }));
    setMsg(null);
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveArtikelSocial(afleveringId, artikelId, f);
      setMsg(
        res.ok
          ? { ok: true, text: "Opgeslagen." }
          : { ok: false, text: res.error ?? "Mislukt." },
      );
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">Social-uitwerking</h2>
      <p className="mt-0.5 text-xs text-slate-400">
        Gekoppeld artikel: <span className="font-medium text-slate-600">{artikelTitel}</span>
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={f.content_processed}
            onChange={(e) => set("content_processed", e.target.checked)}
          />
          Content verwerkt (video + socials gemaakt)
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>YouTube-video URL</label>
            <input
              className={inp}
              value={f.ytvideo_url}
              onChange={(e) => set("ytvideo_url", e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
            />
          </div>
          <div>
            <label className={label}>Instagram-reel URL</label>
            <input
              className={inp}
              value={f.instareel_url}
              onChange={(e) => set("instareel_url", e.target.value)}
              placeholder="https://instagram.com/reel/…"
            />
          </div>
        </div>

        <div>
          <label className={label}>Instagram-post tekst</label>
          <textarea
            rows={6}
            className={`${inp} text-xs leading-relaxed`}
            value={f.instapost_tekst}
            onChange={(e) => set("instapost_tekst", e.target.value)}
          />
        </div>

        <div>
          <label className={label}>YouTube-titel</label>
          <input
            className={inp}
            value={f.youtube_title}
            onChange={(e) => set("youtube_title", e.target.value)}
          />
        </div>

        <div>
          <label className={label}>YouTube-post tekst</label>
          <textarea
            rows={6}
            className={`${inp} text-xs leading-relaxed`}
            value={f.yt_post_tekst}
            onChange={(e) => set("yt_post_tekst", e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={save}
            disabled={isPending}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
          >
            {isPending ? "Opslaan…" : "Opslaan"}
          </button>
          {msg && (
            <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>
              {msg.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
