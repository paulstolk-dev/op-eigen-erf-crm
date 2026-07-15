"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { generateArtikelVideo } from "../socials/actions";

/**
 * Artikel-content op /website: enkel de AI-generatieknop + een link naar de
 * social content van dit artikel. Alle social-velden (video-URL's, post-teksten)
 * leven op /socials — hier houden we het overzicht schoon.
 */
export function ArtikelContent({
  artikelId,
  afleveringId,
}: {
  artikelId: string;
  afleveringId: string | null;
}) {
  const [genPending, startGen] = useTransition();
  const [genMsg, setGenMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function genereerVideo() {
    setGenMsg(null);
    startGen(async () => {
      const res = await generateArtikelVideo(artikelId);
      setGenMsg(
        res.ok
          ? { ok: true, text: "Concept-aflevering aangemaakt — zie /socials." }
          : { ok: false, text: res.error ?? "Mislukt." },
      );
    });
  }

  const socialHref = afleveringId ? `/socials/${afleveringId}` : "/socials";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
      <Link
        href={socialHref}
        className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700"
      >
        Social content{afleveringId ? "" : " →"}
        {afleveringId ? " bekijken →" : ""}
      </Link>

      <button
        onClick={genereerVideo}
        disabled={genPending}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {genPending ? "Genereren…" : "Genereer socialvideo (AI)"}
      </button>
      <span className="text-xs text-slate-400">
        Video's, post-teksten en captions beheer je op{" "}
        <Link href={socialHref} className="font-medium text-navy hover:underline">
          /socials
        </Link>
        .
      </span>
      {genMsg && (
        <span className={`text-sm ${genMsg.ok ? "text-green-600" : "text-red-600"}`}>
          {genMsg.text}
        </span>
      )}
    </div>
  );
}
