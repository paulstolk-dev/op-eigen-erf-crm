"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSocial, setSocialStatus, deleteSocial } from "../actions";
import { STATUS_LABEL, STATUS_STYLE, CONTENT_STATUSSEN } from "@/lib/socials";

export function SocialReview({
  id,
  status,
  instagram,
  youtubeTitle,
  videoUrl,
  reviewNotes,
}: {
  id: string;
  status: string;
  instagram: string;
  youtubeTitle: string;
  videoUrl: string;
  reviewNotes: string;
}) {
  const router = useRouter();
  const [ig, setIg] = useState(instagram);
  const [yt, setYt] = useState(youtubeTitle);
  const [video, setVideo] = useState(videoUrl);
  const [notes, setNotes] = useState(reviewNotes);
  const [msg, setMsg] = useState("");
  const [isSave, startSave] = useTransition();
  const [isStatus, startStatus] = useTransition();
  const [isDelete, startDelete] = useTransition();

  function onSave() {
    setMsg("");
    startSave(async () => {
      const r = await saveSocial(id, {
        instagram: ig,
        youtube_title: yt,
        review_notes: notes,
        video_url: video,
      });
      setMsg(r.ok ? "Opgeslagen." : `Opslaan mislukt: ${r.error}`);
      if (r.ok) router.refresh();
    });
  }

  function onStatus(next: string) {
    setMsg("");
    startStatus(async () => {
      const r = await setSocialStatus(id, next);
      if (!r.ok) setMsg(`Status wijzigen mislukt: ${r.error}`);
      else router.refresh();
    });
  }

  function onDelete() {
    if (!confirm("Deze aflevering verwijderen?")) return;
    startDelete(async () => {
      const r = await deleteSocial(id);
      if (!r.ok) setMsg(`Verwijderen mislukt: ${r.error}`);
      else router.push("/socials");
    });
  }

  return (
    <div className="space-y-5">
      {/* Statusflow */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Status
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          {CONTENT_STATUSSEN.map((s) => {
            const actief = s === status;
            return (
              <button
                key={s}
                type="button"
                disabled={isStatus || actief}
                onClick={() => onStatus(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition disabled:cursor-default ${
                  actief
                    ? STATUS_STYLE[s]
                    : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
                }`}
              >
                {actief ? "● " : ""}
                {STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Keur pas goed nadat je de gerenderde video + caption merk-kritisch hebt bekeken
          (bron erbij, badge bij niet-definitief, geen ACM-gevoelige claim).
        </p>
      </div>

      {/* Caption + video + notities */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Instagram-caption
            </label>
            <textarea
              value={ig}
              onChange={(e) => setIg(e.target.value)}
              rows={7}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              YouTube-titel
            </label>
            <input
              value={yt}
              onChange={(e) => setYt(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Video-URL (mp4)
            </label>
            <input
              value={video}
              onChange={(e) => setVideo(e.target.value)}
              placeholder="Wordt door het renderproject gevuld; of plak zelf een URL"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Review-notitie
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy"
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={isSave}
              onClick={onSave}
              className="rounded-lg bg-erf px-4 py-2 text-sm font-medium text-white transition hover:bg-erf-700 disabled:opacity-50"
            >
              {isSave ? "Opslaan…" : "Opslaan"}
            </button>
            <button
              type="button"
              disabled={isDelete}
              onClick={onDelete}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              Verwijderen
            </button>
          </div>
          {msg && (
            <p
              className={`text-sm ${msg.includes("mislukt") ? "text-red-600" : "text-green-600"}`}
            >
              {msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
