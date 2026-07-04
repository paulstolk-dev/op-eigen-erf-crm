"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "signing" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("signing");
    setMessage("");
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setStatus("error");
      setMessage(
        error.message === "Invalid login credentials"
          ? "Onjuiste e-mail of wachtwoord."
          : error.message,
      );
      return;
    }

    // Routeer op rol: CRM-medewerker -> dashboard, aanbieder -> portaal.
    const { data: allowed } = await supabase.rpc("is_allowed_user");
    if (allowed) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const { data: aanbiederStatus } = await supabase.rpc("my_aanbieder_status");
    if (aanbiederStatus === "approved") {
      router.push("/portal");
      router.refresh();
      return;
    }
    if (aanbiederStatus === "pending" || aanbiederStatus === "geweigerd") {
      router.push("/portal/status");
      router.refresh();
      return;
    }

    // Geen enkele rol: uitloggen.
    await supabase.auth.signOut();
    setStatus("error");
    setMessage("Dit account heeft nog geen toegang. Vraag toegang aan of wacht op goedkeuring.");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3">
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="jij@voorbeeld.nl"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
      />
      <input
        type="password"
        required
        autoComplete="current-password"
        placeholder="Wachtwoord"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
      />
      <button
        type="submit"
        disabled={status === "signing"}
        className="w-full rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
      >
        {status === "signing" ? "Inloggen…" : "Inloggen"}
      </button>
      {message && <p className="text-sm text-red-600">{message}</p>}
      <p className="pt-1 text-center text-sm text-slate-500">
        Aanbieder?{" "}
        <a href="/registreren" className="font-medium text-navy hover:underline">
          Toegang aanvragen
        </a>
      </p>
    </form>
  );
}
