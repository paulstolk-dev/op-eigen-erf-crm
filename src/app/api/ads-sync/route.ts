import { NextResponse, type NextRequest } from "next/server";
import { runAdsSync } from "@/lib/ads-sync";

// Google Ads spend-sync. Draait op Vercel Cron (vercel.json) of handmatig.
// Beveiligd met CRON_SECRET (Bearer), net als de follow-up cron.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const res = await runAdsSync();
  return NextResponse.json(res, { status: res.ok ? 200 : (res.status ?? 500) });
}
