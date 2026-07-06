import { NextResponse, type NextRequest } from "next/server";
import { syncLeadToHubspot, syncAanbiederToHubspot } from "@/lib/hubspot";
import { backfillNurtureHubspot } from "@/lib/nurture";

export const runtime = "nodejs";
export const maxDuration = 60;

// CRM -> HubSpot sync. Aangeroepen door DB-triggers (leads/erfscans/aanbieders)
// of handmatig. Body: { lead_id } of { aanbieder_id }. Beveiligd met het
// gedeelde interne secret (zelfde als de erfscan-/rapport-triggers).
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    /* lege body toegestaan */
  }

  const secret = process.env.ERFSCAN_SECRET;
  if (secret) {
    const provided =
      request.headers.get("x-erfscan-secret") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      (typeof body.secret === "string" ? body.secret : undefined);
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (body.backfill_nurture === true) {
    const res = await backfillNurtureHubspot();
    return NextResponse.json(res, { status: res.ok ? 200 : 500 });
  }

  const record = (body.record ?? {}) as Record<string, unknown>;
  const leadId = (body.lead_id ?? record.lead_id) as string | undefined;
  const aanbiederId = (body.aanbieder_id ?? record.aanbieder_id) as
    | string
    | undefined;

  if (leadId) {
    const res = await syncLeadToHubspot(leadId);
    return NextResponse.json(res, { status: res.ok ? 200 : 500 });
  }
  if (aanbiederId) {
    const res = await syncAanbiederToHubspot(aanbiederId);
    return NextResponse.json(res, { status: res.ok ? 200 : 500 });
  }
  return NextResponse.json(
    { error: "lead_id of aanbieder_id ontbreekt" },
    { status: 422 },
  );
}
