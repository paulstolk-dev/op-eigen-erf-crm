import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/app-header";
import type { Artikel } from "@/lib/database.types";
import { ArtikelAfbeelding } from "./artikel-afbeelding";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  gepubliceerd: "bg-green-100 text-green-800 ring-green-600/20",
  concept: "bg-slate-100 text-slate-600 ring-slate-400/20",
  gearchiveerd: "bg-amber-100 text-amber-800 ring-amber-600/20",
};

function datumNL(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function WebsitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data } = await admin
    .from("artikelen")
    .select("*")
    .order("publicatiedatum", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  const artikelen = (data ?? []) as Artikel[];

  const telling = (s: string) => artikelen.filter((a) => a.status === s).length;

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-slate-900">Website — artikelen</h1>
          <p className="mt-1 text-sm text-slate-500">
            Alle kennisbank-artikelen uit Supabase. Voeg per artikel een uitgelichte
            afbeelding toe.
          </p>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {["gepubliceerd", "concept", "gearchiveerd"].map((s) => (
            <span
              key={s}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                STATUS_STYLE[s] ?? STATUS_STYLE.concept
              }`}
            >
              {s}
              <span className="font-bold">{telling(s)}</span>
            </span>
          ))}
        </div>

        {artikelen.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Nog geen artikelen.
          </div>
        ) : (
          <ul className="space-y-2">
            {artikelen.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
              >
                <ArtikelAfbeelding artikelId={a.id} url={a.afbeelding_url} />
                <div className="min-w-[14rem] flex-1">
                  <p className="text-sm font-semibold text-slate-900">{a.titel}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {a.categorie ?? "—"} · {datumNL(a.publicatiedatum)}
                    {a.slug ? ` · /${a.slug}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                    STATUS_STYLE[a.status] ?? STATUS_STYLE.concept
                  }`}
                >
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
