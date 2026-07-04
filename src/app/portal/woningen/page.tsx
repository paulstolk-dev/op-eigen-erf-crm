import { requireApprovedAanbieder } from "@/lib/portal";
import { PortalHeader } from "@/components/portal-header";
import { WoningenSection } from "@/components/woningen-section";
import type { Woning } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function PortalWoningenPage() {
  const { supabase, aanbieder, user } = await requireApprovedAanbieder();

  const { data: woningen } = await supabase
    .from("woningen")
    .select("*")
    .eq("aanbieder_id", aanbieder.id)
    .order("sortering", { ascending: true })
    .order("naam", { ascending: true });

  return (
    <div className="min-h-screen">
      <PortalHeader aanbiederNaam={aanbieder.naam} email={user.email} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-slate-900">Mijn woningen</h1>
          <p className="text-sm text-slate-500">
            Voeg modellen toe, werk prijzen bij en upload foto&apos;s. Wijzigingen
            zijn direct zichtbaar op opeigenerf.nl.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <WoningenSection
            aanbiederId={aanbieder.id}
            woningen={(woningen ?? []) as Woning[]}
          />
        </div>
      </main>
    </div>
  );
}
