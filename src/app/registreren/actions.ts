"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(8, "Wachtwoord: minimaal 8 tekens"),
  aanbieder_id: z.string().uuid("Kies je bedrijf uit de lijst"),
  bericht: z.string().max(1000).optional(),
});

export type RegisterInput = z.input<typeof schema>;

export async function registerAanbieder(
  input: RegisterInput,
): Promise<{ ok: boolean; error?: string; needsConfirm?: boolean }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { email, password, aanbieder_id, bericht } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    const msg = error.message.toLowerCase();
    return {
      ok: false,
      error: msg.includes("already registered")
        ? "Er bestaat al een account met dit e-mailadres. Log in of vraag een wachtwoord-reset aan."
        : error.message,
    };
  }
  const userId = data.user?.id;
  if (!userId) return { ok: false, error: "Registratie mislukt, probeer opnieuw." };

  // Lidmaatschap als 'pending' vastleggen via de service-role client
  // (RLS staat geen self-insert toe). CRM keurt daarna goed.
  const admin = createAdminClient();
  const { error: mErr } = await admin.from("aanbieder_users").insert({
    user_id: userId,
    aanbieder_id,
    email,
    bericht: bericht?.trim() || null,
    status: "pending",
  });
  if (mErr) {
    return {
      ok: false,
      error: mErr.code === "23505"
        ? "Er is al een toegangsaanvraag voor dit account."
        : mErr.message,
    };
  }

  // Geen half-actieve sessie vóór goedkeuring.
  const needsConfirm = !data.session;
  await supabase.auth.signOut();
  return { ok: true, needsConfirm };
}
