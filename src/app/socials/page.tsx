import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, STATUS_STYLE, CONTENT_STATUSSEN } from "@/lib/socials";
import type { RegelgevingProps } from "@/lib/socials";
import type { ContentQueueItem } from "@/lib/database.types";
import { GenerateForm } from "./generate-form";
import { RenderButton } from "./render-button";

export const dynamic = "force-dynamic";

function datumNL(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SocialsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_queue")
    .select("*")
    .order("created_at", { ascending: false });
  const items = (data ?? []) as ContentQueueItem[];

  const telling = CONTENT_STATUSSEN.map((s) => ({
    status: s,
    n: items.filter((i) => i.status === s).length,
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Socials</h1>
        <p className="mt-1 text-sm text-slate-500">
          Content-automation voor regelgeving-shorts (IG Reel + YouTube Short). Flow:
          concept → gerenderd → goedgekeurd → ingepland.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {telling.map(({ status, n }) => (
          <span
            key={status}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}
          >
            {STATUS_LABEL[status]}
            <span className="font-bold">{n}</span>
          </span>
        ))}
      </div>

      <div className="mb-6 space-y-4">
        <GenerateForm />
        <RenderButton conceptCount={items.filter((i) => i.status === "concept").length} />
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nog geen afleveringen. Genereer je eerste batch hierboven.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const props = item.props as unknown as RegelgevingProps;
            return (
              <li key={item.id}>
                <Link
                  href={`/socials/${item.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-navy/40 hover:shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-erf">
                        {props?.kicker}
                      </span>
                      {props?.nogNietDefinitief && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          ⚠ nog niet definitief
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {props?.titel || item.slug}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {props?.scenes?.length ?? 0} scenes · {datumNL(item.created_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[item.status]}`}
                  >
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
