import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { NurtureDashboard, type FlowRow } from "./nurture-dashboard";

export const dynamic = "force-dynamic";

export default async function EmailDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Geaggregeerd overzicht van de twee bestaande flows (via de is_allowed_user-guard in de RPC).
  const { data } = await (supabase as any).rpc("nurture_flow_overview");
  const rows = (data ?? []) as FlowRow[];

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-slate-500">Marketing · Email</span>
          <Link
            href="/instellingen/e-mailflow"
            className="text-sm font-medium text-navy hover:underline"
          >
            Flows bewerken →
          </Link>
        </div>
        <NurtureDashboard rows={rows} />
      </main>
    </div>
  );
}
