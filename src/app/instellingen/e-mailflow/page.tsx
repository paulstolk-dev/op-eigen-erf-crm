import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/app-header";
import { SequenceEditor } from "./sequence-editor";
import { SenderForm } from "./sender-form";
import {
  getSetting,
  SETTING_KEYS,
  DEFAULT_NURTURE_FROM,
  DEFAULT_NURTURE_REPLY_TO,
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

  const [from, replyTo] = await Promise.all([
    getSetting(SETTING_KEYS.nurtureFrom, DEFAULT_NURTURE_FROM),
    getSetting(SETTING_KEYS.nurtureReplyTo, DEFAULT_NURTURE_REPLY_TO),
  ]);

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
            <code className="text-slate-700">{"{{perceel_m2}}"}</code>. Laat de
            primaire knop/secundaire link leeg om die weg te laten. Tip: houd de
            eerste stap (levering) op <em>inactief</em> — die verstuur je handmatig.
          </p>
        </div>

        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Afzender &amp; antwoorden
          </h2>
          <SenderForm from={from} replyTo={replyTo} />
        </section>

        <SequenceEditor steps={(steps ?? []) as EmailSequenceStep[]} />
      </main>
    </div>
  );
}
