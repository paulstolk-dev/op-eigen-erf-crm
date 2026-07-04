import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { AccessRow } from "./access-row";

export const dynamic = "force-dynamic";

type Row = {
  user_id: string;
  email: string | null;
  status: string;
  bericht: string | null;
  created_at: string;
  aanbieders: { naam: string } | null;
};

export default async function AanvragenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("aanbieder_users")
    .select("user_id,email,status,bericht,created_at,aanbieders(naam)")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as Row[];
  const pending = rows.filter((r) => r.status === "pending");
  const rest = rows.filter((r) => r.status !== "pending");
  const ordered = [...pending, ...rest];

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Link href="/aanbieders" className="text-sm text-slate-500 hover:text-navy">
          ← Terug naar aanbieders
        </Link>
        <div className="mb-5 mt-2">
          <h1 className="text-lg font-semibold text-slate-900">
            Toegangsaanvragen
          </h1>
          <p className="text-sm text-slate-500">
            Aanbieders die zich hebben aangemeld voor het portaal.
            {pending.length > 0 && (
              <span className="ml-1 font-medium text-amber-600">
                {pending.length} wacht{pending.length === 1 ? "" : "en"} op goedkeuring.
              </span>
            )}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Aanbieder / account</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  Aangevraagd
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ordered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                    Nog geen aanvragen.
                  </td>
                </tr>
              )}
              {ordered.map((r) => (
                <AccessRow
                  key={r.user_id}
                  userId={r.user_id}
                  email={r.email}
                  aanbiederNaam={r.aanbieders?.naam ?? "—"}
                  bericht={r.bericht}
                  status={r.status}
                  aangevraagd={r.created_at}
                />
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
