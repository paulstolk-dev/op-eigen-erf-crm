"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import type { TablesUpdate } from "@/lib/database.types";

async function requireCrm() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  const { data: allowed } = await supabase.rpc("is_allowed_user");
  if (allowed !== true) throw new Error("Alleen CRM-beheerders.");
  return { user };
}

type Result = { ok: boolean; error?: string };

// Keur een aanbieder-account goed, wijs af, of zet terug op 'in behandeling'.
export async function setAanbiederUserStatus(
  userId: string,
  status: "approved" | "geweigerd" | "pending",
): Promise<Result> {
  const { user } = await requireCrm();
  const admin = createAdminClient();
  const patch: TablesUpdate<"aanbieder_users"> = { status };
  if (status === "approved") {
    patch.approved_at = new Date().toISOString();
    patch.approved_by = user.email ?? null;
  } else {
    patch.approved_at = null;
    patch.approved_by = null;
  }
  const { error } = await admin
    .from("aanbieder_users")
    .update(patch)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  // Bij goedkeuring: mail de aanbieder dat hij kan inloggen. Faalt stil —
  // een mislukte mail mag de goedkeuring niet blokkeren.
  if (status === "approved") {
    try {
      const { data: row } = await admin
        .from("aanbieder_users")
        .select("email, aanbieders(naam)")
        .eq("user_id", userId)
        .maybeSingle();
      const email = row?.email;
      const naam =
        (row?.aanbieders as { naam?: string } | null)?.naam ?? "je bedrijf";
      if (email) {
        const loginUrl =
          (process.env.NEXT_PUBLIC_SITE_URL || "https://crm.opeigenerf.nl") +
          "/login";
        await sendEmail({
          to: email,
          subject: "Je toegang tot het opeigenerf-portaal is goedgekeurd",
          html: `<p>Hallo,</p>
<p>Je account voor <strong>${naam}</strong> is goedgekeurd. Je kunt nu inloggen op het aanbieder-portaal om je woningen te beheren en gedeelde leads te bekijken.</p>
<p><a href="${loginUrl}">Inloggen op het portaal</a></p>
<p>Met vriendelijke groet,<br/>opeigenerf</p>`,
        });
      }
    } catch (e) {
      console.error("[toegang] goedkeuringsmail mislukt:", e);
    }
  }

  revalidatePath("/aanbieders/aanvragen");
  return { ok: true };
}
