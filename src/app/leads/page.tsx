import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { LeadsTable } from "./leads-table";
import type { Lead } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  const { data: erfscans } = await supabase
    .from("erfscans")
    .select("lead_id,status,conclusie");

  const erfscanByLead: Record<
    string,
    { status: string; conclusie: string | null }
  > = Object.fromEntries(
    (erfscans ?? []).map((e) => [
      e.lead_id,
      { status: e.status, conclusie: e.conclusie },
    ]),
  );

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">
            Live overzicht van alle aanvragen. Nieuwe leads verschijnen
            automatisch bovenaan.
          </p>
        </div>
        <LeadsTable
          initialLeads={(leads ?? []) as Lead[]}
          erfscanByLead={erfscanByLead}
        />
      </main>
    </div>
  );
}
