import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/app-header";
import { SequenceEditor } from "./sequence-editor";
import { SenderForm } from "./sender-form";
import { ManualSend } from "./manual-send";
import {
  getSetting,
  SETTING_KEYS,
  DEFAULT_NURTURE_FROM,
  DEFAULT_NURTURE_REPLY_TO,
  DEFAULT_NURTURE_BCC,
} from "@/lib/settings";
import type { EmailSequenceStep } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function EmailFlowPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Admin-client: RLS staat CRM-lezen toe, maar admin is simpel en consistent.
  const admin = createAdminClient();
  const { data: steps } = await admin
    .from("email_sequence_steps")
    .select("*")
    .order("volgorde", { ascending: true });

  const [from, replyTo, bcc] = await Promise.all([
    getSetting(SETTING_KEYS.nurtureFrom, DEFAULT_NURTURE_FROM),
    getSetting(SETTING_KEYS.nurtureReplyTo, DEFAULT_NURTURE_REPLY_TO),
    getSetting(SETTING_KEYS.nurtureBcc, DEFAULT_NURTURE_BCC),
  ]);

  // Meetlaag-metrics per stap (via de user-client → is_allowed_user-guard in de RPC).
  type Metric = {
    step_order: number;
    subject: string;
    verzonden: number;
    bezorgd: number;
    geopend: number;
    geklikt: number;
    gebounced: number;
    ctr_pct: number | null;
  };
  const { data: metricsRaw } = await (supabase as any).rpc("nurture_step_performance");
  const metrics = (metricsRaw ?? []) as Metric[];
  const totVerzonden = metrics.reduce((s, m) => s + Number(m.verzonden), 0);

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/instellingen" className="text-sm text-slate-500 hover:text-navy">
          ← Terug naar instellingen
        </Link>
        <div className="mb-5 mt-2">
          <h1 className="text-lg font-semibold text-slate-900">E-mailflow (opvolging)</h1>
          <p className="text-sm text-slate-500">
            Automatische opvolgmails naar leads. De reeks start zodra je het
            erfcheck-rapport naar de lead <strong>verstuurt</strong>; “Dag” is het
            aantal dagen daarna. Leads met status gewonnen of verloren vallen
            automatisch uit de reeks.
          </p>
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Merge-velden:{" "}
            <code className="text-slate-700">{"{{voornaam}}"}</code>{" "}
            <code className="text-slate-700">{"{{adres}}"}</code>{" "}
            <code className="text-slate-700">{"{{verdict}}"}</code>{" "}
            <code className="text-slate-700">{"{{perceel_m2}}"}</code>{" "}
            <code className="text-slate-700">{"{{erfcheck_url}}"}</code>. Zet{" "}
            <code className="text-slate-700">{"{{erfcheck_url}}"}</code> als CTA-link
            (of in de tekst) om naar de persoonlijke, trackbare Erf Check-pagina van
            de lead te verwijzen — een klik verschijnt als bezoek op de lead. Laat de
            primaire knop/secundaire link leeg om die weg te laten. Tip: houd de
            eerste stap (levering) op <em>inactief</em> — die verstuur je handmatig.
          </p>
        </div>

        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Afzender &amp; antwoorden
          </h2>
          <SenderForm from={from} replyTo={replyTo} bcc={bcc} />
        </section>

        <div className="mb-4">
          <ManualSend />
        </div>

        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Prestaties per stap</h2>
          <p className="mt-0.5 mb-3 text-xs text-slate-500">
            Meetlaag op basis van Resend-events. <strong>Stuur op klikken</strong>, niet op
            opens: Apple Mail &amp; Gmail prefetchen de tracking-pixel, dus opens zijn
            onbetrouwbaar (CTR staat daarom op <em>bezorgd</em>).
          </p>
          {totVerzonden === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">
              Nog geen gemeten verzendingen. Zodra de webhook events levert, verschijnen
              hier bezorgd/geklikt/bounced per stap.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Onderwerp</th>
                    <th className="py-2 pr-3 font-medium">Verzonden</th>
                    <th className="py-2 pr-3 font-medium">Bezorgd</th>
                    <th className="py-2 pr-3 font-medium">Geklikt</th>
                    <th className="py-2 pr-3 font-medium">Bounced</th>
                    <th className="py-2 pr-3 font-medium">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.map((m) => (
                    <tr key={m.step_order}>
                      <td className="py-2 pr-3 text-slate-500">{m.step_order}</td>
                      <td className="py-2 pr-3 font-medium text-slate-800">{m.subject}</td>
                      <td className="py-2 pr-3 text-slate-700">{m.verzonden}</td>
                      <td className="py-2 pr-3 text-slate-700">{m.bezorgd}</td>
                      <td className="py-2 pr-3 font-semibold text-navy">{m.geklikt}</td>
                      <td className="py-2 pr-3 text-slate-700">
                        {m.gebounced > 0 ? (
                          <span className="text-red-600">{m.gebounced}</span>
                        ) : (
                          m.gebounced
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        {m.ctr_pct != null ? `${m.ctr_pct}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <SequenceEditor steps={(steps ?? []) as EmailSequenceStep[]} />
      </main>
    </div>
  );
}
