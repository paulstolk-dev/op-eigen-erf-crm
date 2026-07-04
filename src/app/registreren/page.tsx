import { createClient } from "@/lib/supabase/server";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegistrerenPage() {
  const supabase = await createClient();
  const { data: aanbieders } = await supabase
    .from("aanbieders")
    .select("id,naam")
    .eq("actief", true)
    .order("naam", { ascending: true });

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="opeigenerf.nl" className="h-9 w-auto" />
        <h1 className="mt-4 text-lg font-semibold text-slate-900">
          Aanbieder-portaal — toegang aanvragen
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Beheer je eigen woningen en bekijk leads die met je gedeeld worden. Na
          goedkeuring door opeigenerf krijg je toegang.
        </p>
        <RegisterForm aanbieders={aanbieders ?? []} />
      </div>
    </main>
  );
}
