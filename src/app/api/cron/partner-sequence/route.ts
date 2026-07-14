import { NextResponse, type NextRequest } from "next/server";
import { runPartnerSequence } from "@/lib/partner-sequence";

export const runtime = "nodejs";
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Dagelijkse aanbieder-werving: verstuurt de vervolgmails (2 en 3) van de
// wervingssequence op basis van de ingestelde wachttijden. Alleen aanbieders
// met status 'benaderd' schuiven op. Beveiligd met CRON_SECRET (Bearer).
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const res = await runPartnerSequence();
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
