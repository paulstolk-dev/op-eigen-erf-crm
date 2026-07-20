import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/app-header";
import { FlowInstellingen } from "./flow-instellingen";
import { SenderForm } from "./sender-form";
import { ManualSend } from "./manual-send";
import {
  getSetting,
  SETTING_KEYS,
  DEFAULT_NURTURE_FROM,
  DEFAULT_NURTURE_REPLY_TO,
  DEFAULT_NURTURE_BCC,
  parseNurtureFlow,
} from "@/lib/settings";
import { getPitchStep, getPitchDelays } from "@/lib/partner-pitch";

export const dynamic = "force-dynamic";

export default async function EmailFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ groep?: string }>;
}) {
  const { groep } = await searchParams;
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
  const flow = parseNurtureFlow(await getSetting(SETTING_KEYS.nurtureFlow));

  // Aanbieder-wervingssequence (3 pitch-mails + wachttijden) voor de FlowInstellingen.
  const [pitch1, pitch2, pitch3, pitchDelays] = await Promise.all([
    getPitchStep(1),
    getPitchStep(2),
    getPitchStep(3),
    getPitchDelays(),
  ]);
  const partner = {
    step1: pitch1,
    step2: pitch2,
    step3: pitch3,
    delay2: pitchDelays.delay2,
    delay3: pitchDelays.delay3,
  };

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

  // Partner-pitch-metrics (aanbieder-stroom) voor de FlowInstellingen.
  const { data: pmRaw } = await (supabase as any).rpc("nurture_partner_performance");
  const partnerMetrics = (pmRaw ?? []) as Parameters<
    typeof FlowInstellingen
  >[0]["partnerMetrics"];

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Link href="/instellingen" className="text-sm text-slate-500 hover:text-navy">
          ← Terug naar instellingen
        </Link>

        <div className="mb-6 mt-3">
          <FlowInstellingen
            steps={(steps ?? []) as unknown as Parameters<typeof FlowInstellingen>[0]["steps"]}
            flow={flow}
            partner={partner}
            partnerMetrics={partnerMetrics}
            initialGroep={groep}
          />
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
      </main>
    </div>
  );
}
