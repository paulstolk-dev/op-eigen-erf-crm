import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Resend-webhook voor de nurture-meetlaag. Resend levert events (Svix) op deze
// endpoint; wij verifiëren de handtekening, mappen het event-type en schrijven het
// idempotent weg via public.nurture_ingest_event (ruw event + afgeleide status +
// suppressions). GEEN verzendactie — puur meten.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resend event.type → onze nurture.event_type enum.
const TYPE_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.failed": "failed",
  "email.scheduled": "scheduled",
};

// Svix-handtekeningverificatie (zonder svix-dependency): HMAC-SHA256 over
// `${id}.${timestamp}.${body}` met de base64-secret na 'whsec_'.
function verifySvix(secret: string, id: string, ts: string, body: string, header: string): boolean {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
  // header = "v1,<sig> v1,<sig2> ..."; vergelijk constant-time met elk.
  const exp = Buffer.from(expected);
  return header.split(" ").some((part) => {
    const sig = part.split(",")[1] ?? "";
    const got = Buffer.from(sig);
    return got.length === exp.length && crypto.timingSafeEqual(got, exp);
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RESEND_WEBHOOK_SECRET niet gezet." }, { status: 503 });
  }
  const id = request.headers.get("svix-id");
  const ts = request.headers.get("svix-timestamp");
  const sig = request.headers.get("svix-signature");
  const raw = await request.text();
  if (!id || !ts || !sig || !verifySvix(secret, id, ts, raw, sig)) {
    return NextResponse.json({ error: "Ongeldige handtekening." }, { status: 401 });
  }

  let evt: {
    type?: string;
    created_at?: string;
    data?: { email_id?: string; click?: { link?: string }; link?: string };
  };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mapped = TYPE_MAP[evt.type ?? ""];
  const pmid = evt.data?.email_id;
  if (!mapped || !pmid) {
    // Onbekend type of geen message-id: acknowledge (Resend niet laten retryen).
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }

  const admin = createAdminClient();
  const { error } = await (admin as any).rpc("nurture_ingest_event", {
    p_event_id: id, // svix-id = idempotentiesleutel
    p_pmid: pmid,
    p_event_type: mapped,
    p_occurred: evt.created_at ?? new Date().toISOString(),
    p_link: evt.data?.click?.link ?? evt.data?.link ?? null,
    p_payload: evt,
  });
  if (error) {
    console.error("[resend-webhook] ingest error", error.message);
    return NextResponse.json({ error: "Verwerken mislukt." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
