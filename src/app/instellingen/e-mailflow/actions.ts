"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireCrm() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  const { data: allowed } = await supabase.rpc("is_allowed_user");
  if (allowed !== true) throw new Error("Alleen CRM-beheerders.");
}

const stepSchema = z.object({
  dag_na_start: z.coerce.number().int().min(0),
  onderwerp: z.string().trim().min(1, "Onderwerp is verplicht"),
  preview: z.string().optional().transform((v) => v?.trim() || null),
  body: z.string().trim().min(1, "Body is verplicht"),
  cta_primary_label: z.string().optional().transform((v) => v?.trim() || null),
  cta_primary_url: z.string().optional().transform((v) => v?.trim() || null),
  cta_secondary_label: z.string().optional().transform((v) => v?.trim() || null),
  cta_secondary_url: z.string().optional().transform((v) => v?.trim() || null),
  actief: z.boolean().default(true),
});

export type StepInput = z.input<typeof stepSchema>;

type Result = { ok: boolean; error?: string };

export async function saveStep(id: string, input: StepInput): Promise<Result> {
  await requireCrm();
  const parsed = stepSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("email_sequence_steps")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/instellingen/e-mailflow");
  return { ok: true };
}

export async function addStep(): Promise<Result> {
  await requireCrm();
  const admin = createAdminClient();
  const { data: last } = await admin
    .from("email_sequence_steps")
    .select("volgorde,dag_na_start")
    .order("volgorde", { ascending: false })
    .limit(1)
    .maybeSingle();
  const volgorde = (last?.volgorde ?? -1) + 1;
  const { error } = await admin.from("email_sequence_steps").insert({
    sleutel: `stap-${Date.now().toString(36)}`,
    volgorde,
    dag_na_start: (last?.dag_na_start ?? 0) + 3,
    onderwerp: "Nieuw onderwerp",
    body: "Hoi {{voornaam}},\n\n…\n\nGroet,\n[Naam]",
    actief: false,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/instellingen/e-mailflow");
  return { ok: true };
}

export async function deleteStep(id: string): Promise<Result> {
  await requireCrm();
  const admin = createAdminClient();
  const { error } = await admin.from("email_sequence_steps").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/instellingen/e-mailflow");
  return { ok: true };
}
