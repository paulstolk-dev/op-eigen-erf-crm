import Link from "next/link";
import { requireApprovedAanbieder } from "@/lib/portal";
import { PortalHeader } from "@/components/portal-header";

export const dynamic = "force-dynamic";

function Card({
  href,
  title,
  value,
  sub,
}: {
  href: string;
  title: string;
  value: string | number;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-navy/40 hover:shadow-sm"
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{sub}</div>
    </Link>
  );
}

export default async function PortalHome() {
  const { supabase, aanbieder, user } = await requireApprovedAanbieder();

  const { count: woningCount } = await supabase
    .from("woningen")
    .select("id", { count: "exact", head: true })
    .eq("aanbieder_id", aanbieder.id);

  const { data: leads } = await supabase.rpc("get_portal_leads");
  const totaalLeads = leads?.length ?? 0;
  const nieuweLeads = (leads ?? []).filter((l) => l.reactie_status === "gedeeld").length;

  return (
    <div className="min-h-screen">
      <PortalHeader aanbiederNaam={aanbieder.naam} email={user.email} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-lg font-semibold text-slate-900">
          Welkom, {aanbieder.naam}
        </h1>
        <p className="text-sm text-slate-500">
          Beheer je woningen en bekijk de leads die met je gedeeld zijn.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card
            href="/portal/woningen"
            title="Woningen"
            value={woningCount ?? 0}
            sub="Beheer je modellen en foto's"
          />
          <Card
            href="/portal/leads"
            title="Leads"
            value={totaalLeads}
            sub={
              nieuweLeads > 0
                ? `${nieuweLeads} nieuw — nog niet gereageerd`
                : "Gedeelde aanvragen"
            }
          />
        </div>
      </main>
    </div>
  );
}
