import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="opeigenerf.nl" className="h-9 w-auto" />
        <p className="mt-4 text-sm text-slate-500">
          CRM — log in met je e-mailadres en wachtwoord.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
