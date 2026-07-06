import { NextResponse, type NextRequest } from "next/server";
import { runNurture } from "@/lib/nurture";

export const runtime = "nodejs";
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Dagelijkse lead-opvolging (nurture). Draait op de Vercel Cron (vercel.json).
// Verstuurt de bewerkbare e-mailflow (E0–E4) naar leads waarvan het erfcheck-
// rapport is verstuurd. Beveiligd met CRON_SECRET (Bearer), of handmatig.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const res = await runNurture();
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
