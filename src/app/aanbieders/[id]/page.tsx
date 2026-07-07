import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { AanbiederForm } from "@/components/aanbieder-form";
import { WoningenSection } from "@/components/woningen-section";
import { HerscrapeKnop } from "./herscrape-knop";
import type { Aanbieder, Woning } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function AanbiederDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: aanbieder } = await supabase
    .from("aanbieders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!aanbieder) notFound();

  const { data: woningen } = await supabase
    .from("woningen")
    .select("*")
    .eq("aanbieder_id", id)
    .order("sortering", { ascending: true })
    .order("naam", { ascending: true });

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/aanbieders" className="text-sm text-slate-500 hover:text-navy">
          ← Terug naar aanbieders
        </Link>
        <div className="mb-5 mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-900">
            {(aanbieder as Aanbieder).naam}
          </h1>
          <HerscrapeKnop aanbiederId={id} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <AanbiederForm initial={aanbieder as Aanbieder} />
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <WoningenSection
            aanbiederId={id}
            woningen={(woningen ?? []) as Woning[]}
          />
        </div>
      </main>
    </div>
  );
}
