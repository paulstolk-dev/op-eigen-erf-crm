import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Aanbieder } from "@/lib/database.types";

type Membership = {
  aanbieder_id: string;
  status: "pending" | "approved" | "geweigerd";
  email: string | null;
};

// Bepaalt waar een INGELOGDE gebruiker heen moet op basis van rol:
//   CRM-medewerker      -> /dashboard
//   goedgekeurde aanbieder -> /portal
//   wachtend/afgewezen  -> /portal/status
//   ingelogd zonder rol -> null (aanroeper beslist: uitloggen/geen-toegang)
export async function roleLandingPath(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: allowed } = await supabase.rpc("is_allowed_user");
  if (allowed) return "/dashboard";
  const { data: status } = await supabase.rpc("my_aanbieder_status");
  if (status === "approved") return "/portal";
  if (status === "pending" || status === "geweigerd") return "/portal/status";
  return null;
}

// Haalt de ingelogde gebruiker + zijn aanbieder-lidmaatschap op (elke status).
export async function getAanbiederContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, membership: null as Membership | null, supabase };
  const { data } = await supabase
    .from("aanbieder_users")
    .select("aanbieder_id,status,email")
    .eq("user_id", user.id)
    .maybeSingle();
  return { user, membership: (data as Membership | null) ?? null, supabase };
}

// Guard voor portal-pagina's die een GOEDGEKEURDE aanbieder vereisen.
// Redirect: niet ingelogd -> /login, geen lidmaatschap -> /geen-toegang,
// nog niet goedgekeurd -> /portal/status.
export async function requireApprovedAanbieder() {
  const { user, membership, supabase } = await getAanbiederContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/geen-toegang");
  if (membership.status !== "approved") redirect("/portal/status");

  const { data: aanbieder } = await supabase
    .from("aanbieders")
    .select("*")
    .eq("id", membership.aanbieder_id)
    .single();

  return {
    user,
    supabase,
    membership,
    aanbieder: aanbieder as Aanbieder,
  };
}
