import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { getSetting, DEFAULT_EMAIL_PROMPT, SETTING_KEYS } from "@/lib/settings";
import { EmailPromptForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function InstellingenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const prompt = await getSetting(
    SETTING_KEYS.reportEmailPrompt,
    DEFAULT_EMAIL_PROMPT,
  );

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-slate-900">Instellingen</h1>
          <p className="text-sm text-slate-500">
            Beheer de instellingen van de erfcheck-automatisering.
          </p>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Concept-mail prompt
          </h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">
            Deze instructie bepaalt hoe de concept-mail aan de lead wordt
            opgesteld bij het automatisch genereren van het rapport. De feitelijke
            regels van de erfcheck blijven altijd gelden; dit stuurt alleen de
            toon en inhoud van de mail.
          </p>
          <EmailPromptForm initial={prompt} defaultPrompt={DEFAULT_EMAIL_PROMPT} />
        </section>

        <Link
          href="/instellingen/e-mailflow"
          className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 transition hover:border-navy/40 hover:shadow-sm"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              E-mailflow (opvolging)
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Bewerk de automatische opvolgmails en het aantal dagen tussen elke
              stap. De reeks start zodra je het rapport naar de lead verstuurt.
            </p>
          </div>
          <span className="text-slate-400">→</span>
        </Link>
      </main>
    </div>
  );
}
