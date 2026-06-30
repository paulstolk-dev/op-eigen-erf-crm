import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAD_TYPES } from "@/lib/constants";
import type { TablesInsert } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// Fase 1/3 bridge: server-side lead ingest for the marketing site.
//
// The marketing site POSTs here instead of writing to Supabase directly, so
// the service-role key never leaves the server and RLS stays closed.
//
// Optional: protect with a shared secret. Set LEAD_INGEST_SECRET in env and
// send it as the `x-ingest-secret` header (or Authorization: Bearer ...).
// ---------------------------------------------------------------------------

const KNOWN_FIELDS = [
  "naam",
  "voornaam",
  "achternaam",
  "email",
  "telefoon",
  "postcode",
  "huisnummer",
  "toevoeging",
  "audience",
  "startdatum",
  "budget",
  "planning",
  "source",
] as const;

export async function POST(request: NextRequest) {
  const secret = process.env.LEAD_INGEST_SECRET;
  if (secret) {
    const header =
      request.headers.get("x-ingest-secret") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (header !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = String(payload.type ?? "");
  if (!(LEAD_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json(
      { error: `type must be one of ${LEAD_TYPES.join(", ")}` },
      { status: 422 },
    );
  }

  const insert: TablesInsert<"leads"> = {
    type,
    source: typeof payload.source === "string" ? payload.source : "website",
    details: payload as Record<string, never>, // full payload, future-proof
  };

  const record = insert as Record<string, unknown>;
  for (const f of KNOWN_FIELDS) {
    const v = payload[f];
    if (typeof v === "string" && v.trim() !== "") {
      record[f] = v.trim();
    }
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .insert(insert)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
