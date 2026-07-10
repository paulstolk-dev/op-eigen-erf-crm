"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadArtikelAfbeelding, clearArtikelAfbeelding } from "./actions";

export function ArtikelAfbeelding({
  artikelId,
  url,
}: {
  artikelId: string;
  url: string | null;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(url);
  const [isPending, start] = useTransition();
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    const fd = new FormData();
    fd.set("artikel_id", artikelId);
    fd.set("file", file);
    start(async () => {
      const r = await uploadArtikelAfbeelding(fd);
      if (r.ok && r.url) {
        setCurrent(r.url);
        router.refresh();
      } else {
        setErr(r.error ?? "Upload mislukt");
      }
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function onClear() {
    start(async () => {
      const r = await clearArtikelAfbeelding(artikelId);
      if (r.ok) {
        setCurrent(null);
        router.refresh();
      } else {
        setErr(r.error ?? "Verwijderen mislukt");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] text-slate-400">geen</span>
        )}
      </div>
      <div className="flex flex-col items-start gap-1">
        <label className="cursor-pointer rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
          {isPending ? "Uploaden…" : current ? "Vervangen" : "Afbeelding uploaden"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isPending}
            onChange={onFile}
          />
        </label>
        {current && (
          <button
            type="button"
            onClick={onClear}
            disabled={isPending}
            className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50"
          >
            Verwijderen
          </button>
        )}
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    </div>
  );
}
