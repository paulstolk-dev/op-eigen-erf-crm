"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setSetting, SETTING_KEYS, type NurtureFlow } from "@/lib/settings";
import { runNurture } from "@/lib/nurture";

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
  send_condition: z
    .enum(["altijd", "niet_geconverteerd", "niet_geklikt_vorige"])
    .default("altijd"),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(parsed.data as any) // send_condition (0031) staat nog niet in de gegenereerde types
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

export async function saveSender(
  from: string,
  replyTo: string,
  bcc: string,
): Promise<Result> {
  await requireCrm();
  if (!from.trim() || !replyTo.trim()) {
    return { ok: false, error: "Afzender en reply-to zijn verplicht." };
  }
  try {
    await setSetting(SETTING_KEYS.nurtureFrom, from.trim());
    await setSetting(SETTING_KEYS.nurtureReplyTo, replyTo.trim());
    await setSetting(SETTING_KEYS.nurtureBcc, bcc.trim());
    revalidatePath("/instellingen/e-mailflow");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Opslaan mislukt." };
  }
}

// Handmatig de opvolgmails nu versturen (i.p.v. wachten op de dagelijkse cron).
// force = negeer de wachttijd en stuur de eerstvolgende stap direct.
export async function verstuurNurtureNu(
  force: boolean,
): Promise<{ ok: boolean; verstuurd?: number; error?: string }> {
  await requireCrm();
  const res = await runNurture({ force });
  revalidatePath("/instellingen/e-mailflow");
  revalidatePath("/leads");
  return res;
}

export async function deleteStep(id: string): Promise<Result> {
  await requireCrm();
  const admin = createAdminClient();
  const { error } = await admin.from("email_sequence_steps").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/instellingen/e-mailflow");
  return { ok: true };
}

/** Verwissel de volgorde van een stap met zijn buur (omhoog = -1, omlaag = +1). */
export async function reorderStep(id: string, dir: -1 | 1): Promise<Result> {
  await requireCrm();
  const admin = createAdminClient();
  const { data: steps } = await admin
    .from("email_sequence_steps")
    .select("id, volgorde")
    .order("volgorde", { ascending: true });
  const list = steps ?? [];
  const i = list.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  const a = list[i];
  const b = list[j];
  // Wissel de volgorde-waarden (twee losse updates; kleine dataset).
  const { error: e1 } = await admin
    .from("email_sequence_steps")
    .update({ volgorde: b.volgorde })
    .eq("id", a.id);
  const { error: e2 } = await admin
    .from("email_sequence_steps")
    .update({ volgorde: a.volgorde })
    .eq("id", b.id);
  if (e1 || e2) return { ok: false, error: (e1 || e2)!.message };
  revalidatePath("/instellingen/e-mailflow");
  return { ok: true };
}

/** Flow-instellingen (naam/actief/verdict/uitsluitingen/venster) opslaan. */
export async function saveFlowSettings(flow: NurtureFlow): Promise<Result> {
  await requireCrm();
  try {
    await setSetting(SETTING_KEYS.nurtureFlow, JSON.stringify(flow));
    revalidatePath("/instellingen/e-mailflow");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Opslaan mislukt." };
  }
}
