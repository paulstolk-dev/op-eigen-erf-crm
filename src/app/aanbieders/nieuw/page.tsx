import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { AanbiederForm } from "@/components/aanbieder-form";

export const dynamic = "force-dynamic";

export default async function NieuweAanbiederPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link
          href="/aanbieders"
          className="text-sm text-slate-500 hover:text-navy"
        >
          ← Terug naar aanbieders
        </Link>
        <h1 className="mb-5 mt-2 text-lg font-semibold text-slate-900">
          Nieuwe aanbieder
        </h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <AanbiederForm />
        </div>
      </main>
    </div>
  );
}
