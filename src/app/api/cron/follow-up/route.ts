import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

// ---------------------------------------------------------------------------
// Fase 3: status-based follow-up. Runs on a Vercel Cron (see vercel.json).
//
// Strategy (scaffold): find leads still in status 'nieuw' that are older than
// 24h and haven't been followed up yet, send the owner a reminder, and stamp
// details.follow_up_sent_at so we don't repeat. Extend with lifecycle
// sequences per status as needed.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Protect the cron endpoint. Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("status", "nieuw")
    .lt("created_at", dayAgo)
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notify = process.env.LEAD_NOTIFY_EMAIL || "info@opeigenerf.nl";
  let processed = 0;

  for (const lead of leads ?? []) {
    const details = (lead.details ?? {}) as Record<string, unknown>;
    if (details.follow_up_sent_at) continue;

    if (notify) {
      await sendEmail({
        to: notify,
        subject: `Opvolgen: ${lead.type} lead nog op 'nieuw'`,
        html: `<p>Lead <strong>${lead.naam ?? lead.email ?? lead.id}</strong> (${lead.type}) staat al ruim 24u op 'nieuw'.</p>
               <p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/leads/${lead.id}">Bekijk in CRM</a></p>`,
      });
    }

    await supabase
      .from("leads")
      .update({
        details: { ...details, follow_up_sent_at: new Date().toISOString() },
      })
      .eq("id", lead.id);

    processed++;
  }

  return NextResponse.json({ checked: leads?.length ?? 0, processed });
}
