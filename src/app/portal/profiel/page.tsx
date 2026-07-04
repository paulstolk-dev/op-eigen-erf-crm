import { requireApprovedAanbieder } from "@/lib/portal";
import { PortalHeader } from "@/components/portal-header";
import { AanbiederForm } from "@/components/aanbieder-form";

export const dynamic = "force-dynamic";

export default async function PortalProfielPage() {
  const { aanbieder, user } = await requireApprovedAanbieder();

  return (
    <div className="min-h-screen">
      <PortalHeader aanbiederNaam={aanbieder.naam} email={user.email} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-slate-900">Mijn profiel</h1>
          <p className="text-sm text-slate-500">
            Werk je bedrijfsgegevens en logo bij. Deze verschijnen op opeigenerf.nl.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <AanbiederForm initial={aanbieder} variant="portal" />
        </div>
      </main>
    </div>
  );
}
