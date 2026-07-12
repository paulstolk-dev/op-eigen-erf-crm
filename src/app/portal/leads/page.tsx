import { requireApprovedAanbieder } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { PortalHeader } from "@/components/portal-header";
import { LeadCard } from "./lead-card";
import type { PortalLead } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function PortalLeadsPage() {
  const { supabase, aanbieder, user } = await requireApprovedAanbieder();

  const { data } = await supabase.rpc("get_portal_leads");
  const leads = (data ?? []) as PortalLead[];

  // Signed URL voor de opgeslagen erf-intekening (eigen intekening wint van de interne).
  const admin = createAdminClient();
  const snapshotByLead = new Map<string, string>();
  for (const lead of leads) {
    const path = lead.partner_tekening_path || lead.crm_tekening_path;
    if (!path) continue;
    try {
      const { data: signed } = await admin.storage
        .from("erfscans")
        .createSignedUrl(path, 3600);
      if (signed?.signedUrl) snapshotByLead.set(lead.lead_id, `${signed.signedUrl}&v=${Date.now()}`);
    } catch {
      /* geen afbeelding */
    }
  }

  return (
    <div className="min-h-screen">
      <PortalHeader aanbiederNaam={aanbieder.naam} email={user.email} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">
            Aanvragen die opeigenerf met je heeft gedeeld. Reageer of ze passen;
            contactgegevens volgen bij een match.
          </p>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
            Er zijn nog geen leads met je gedeeld.
          </div>
        ) : (
          <ul className="space-y-3">
            {leads.map((lead) => (
              <LeadCard
                key={lead.share_id}
                lead={lead}
                snapshotUrl={snapshotByLead.get(lead.lead_id) ?? null}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
