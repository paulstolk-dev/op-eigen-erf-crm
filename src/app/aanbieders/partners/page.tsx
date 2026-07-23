import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/app-header";
import { PartnerRow } from "./partner-row";
import { PARTNER_FUNNEL, PARTNER_STATUS_LABELS } from "@/lib/aanbieders-constants";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  naam: string;
  contact_naam: string | null;
  contact_email: string | null;
  partner_status: string;
  partner_benaderd_at: string | null;
  partner_pitch_step: number | null;
};

export default async function PartnersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data } = await admin
    .from("aanbieders")
    .select(
      "id,naam,contact_naam,contact_email,partner_status,partner_benaderd_at,partner_pitch_step",
    )
    .order("naam", { ascending: true });
  const rows = (data ?? []) as Row[];

  const telling = (s: string) => rows.filter((r) => r.partner_status === s).length;

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Link href="/aanbieders" className="text-sm text-slate-500 hover:text-navy">
          ← Terug naar aanbieders
        </Link>
        <div className="mb-5 mt-2">
          <h1 className="text-lg font-semibold text-slate-900">
            Aanbieder-funnel — werving
          </h1>
          <p className="text-sm text-slate-500">
            Benader aanbieders en plan een afspraak om ze preferred partner te maken.
            Vul contactgegevens in, stuur de pitch en volg de status door de funnel.
          </p>
        </div>

        {/* Funnel-telling: nieuw → benaderd → afspraak gepland → partner */}
        <div className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PARTNER_FUNNEL.map((s, i) => (
            <div key={s} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {i + 1}. {PARTNER_STATUS_LABELS[s]}
              </div>
              <div className="mt-1 text-xl font-semibold text-slate-900">
                {telling(s)}
              </div>
            </div>
          ))}
        </div>
        <p className="mb-5 text-xs text-slate-400">
          Afgewezen / geen match: {telling("afgewezen")}
        </p>

        {/* Wervingssequence beheer je centraal onder Instellingen → E-mailflow. */}
        <Link
          href="/instellingen/e-mailflow?groep=aanbieders"
          className="mb-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition hover:border-navy/40 hover:shadow-sm"
        >
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Wervingssequence bewerken (3 mails + wachttijden)
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Beheer de pitch-mails + wachttijden centraal onder Instellingen → E-mailflow →
              Aanbieder-werving, met prestaties (bezorgd/geklikt) per pitch.
            </div>
          </div>
          <span className="shrink-0 text-sm font-medium text-navy">Openen →</span>
        </Link>

        {/* Tabel */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">Aanbieder</th>
                <th className="px-3 py-3 font-medium">Contactpersoon</th>
                <th className="px-3 py-3 font-medium">E-mail</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">Benaderd</th>
                <th className="px-3 py-3 text-right font-medium">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-400">
                    Geen aanbieders.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <PartnerRow key={r.id} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
