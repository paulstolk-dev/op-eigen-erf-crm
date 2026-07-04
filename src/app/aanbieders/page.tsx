import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { PRIJSKLASSE_LABELS, euro } from "@/lib/aanbieders-constants";
import type { Aanbieder } from "@/lib/database.types";

export const dynamic = "force-dynamic";

function datum(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function AanbiedersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; actief?: string }>;
}) {
  const { q, actief } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("aanbieders")
    .select("*")
    .order("sortering", { ascending: true })
    .order("naam", { ascending: true });

  if (q && q.trim()) query = query.ilike("naam", `%${q.trim()}%`);
  if (actief === "actief") query = query.eq("actief", true);
  if (actief === "inactief") query = query.eq("actief", false);

  const { data: aanbieders } = await query;
  const rows = (aanbieders ?? []) as Aanbieder[];

  // Aantal woningen per aanbieder.
  const { data: woningen } = await supabase
    .from("woningen")
    .select("aanbieder_id");
  const woningCount = new Map<string, number>();
  for (const w of woningen ?? []) {
    woningCount.set(w.aanbieder_id, (woningCount.get(w.aanbieder_id) ?? 0) + 1);
  }

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Aanbieders</h1>
            <p className="text-sm text-slate-500">
              Catalogus van aanbieders en woningen op opeigenerf.nl.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/aanbieders/aanvragen"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Toegangsaanvragen
            </Link>
            <Link
              href="/aanbieders/nieuw"
              className="rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-700"
            >
              Nieuwe aanbieder
            </Link>
          </div>
        </div>

        <form
          method="get"
          className="mb-4 flex flex-wrap items-center gap-2 text-sm"
        >
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Zoek op naam…"
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
          />
          <select
            name="actief"
            defaultValue={actief ?? ""}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">Alle</option>
            <option value="actief">Alleen actief</option>
            <option value="inactief">Alleen inactief</option>
          </select>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Filter
          </button>
        </form>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Naam</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  Prijsklasse
                </th>
                <th className="px-4 py-3 font-medium">Vanaf-prijs</th>
                <th className="px-4 py-3 font-medium">Woningen</th>
                <th className="px-4 py-3 font-medium">Actief</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Laatst gecontroleerd
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Geen aanbieders gevonden.
                  </td>
                </tr>
              )}
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/aanbieders/${a.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {a.naam}
                    </Link>
                    {a.is_partner && (
                      <span className="ml-2 rounded bg-erf/10 px-1.5 py-0.5 text-xs font-medium text-erf">
                        Partner
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                    {a.prijsklasse ? PRIJSKLASSE_LABELS[a.prijsklasse] : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {euro(a.vanaf_prijs_incl_btw)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {woningCount.get(a.id) ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    {a.actief ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                        Actief
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-400/20">
                        Inactief
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
                    {datum(a.laatst_gecontroleerd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
