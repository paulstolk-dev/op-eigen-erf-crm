import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Google Ads spend-sync (accountniveau). Draait op Vercel Cron (vercel.json)
// of handmatig. Haalt de dagelijkse kosten (LAST_90_DAYS) op en upsert ze in
// public.ad_spend. Beveiligd met CRON_SECRET (Bearer), net als de follow-up cron.
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) throw new Error(`OAuth-token verversen mislukt: ${await r.text()}`);
  const j = await r.json();
  return j.access_token as string;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const need = [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
  ];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) {
    return NextResponse.json(
      { error: `Ontbrekende env-variabelen: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const token = await getAccessToken();
    const version = process.env.GOOGLE_ADS_API_VERSION || "v18";
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/[^0-9]/g, "");
    const loginId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/[^0-9]/g, "");

    const query =
      "SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions " +
      "FROM customer WHERE segments.date DURING LAST_90_DAYS";

    const res = await fetch(
      `https://googleads.googleapis.com/${version}/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
          ...(loginId ? { "login-customer-id": loginId } : {}),
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      },
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `Google Ads API: ${await res.text()}` },
        { status: 500 },
      );
    }

    // searchStream levert een array van batches: [{ results: [...] }, ...]
    const batches = (await res.json()) as Array<{
      results?: Array<{
        segments: { date: string };
        metrics: { costMicros?: string; clicks?: string; impressions?: string };
      }>;
    }>;

    const perDate: Record<string, { cost: number; clicks: number; impressions: number }> = {};
    for (const b of batches) {
      for (const row of b.results ?? []) {
        const d = row.segments.date;
        perDate[d] = perDate[d] || { cost: 0, clicks: 0, impressions: 0 };
        perDate[d].cost += Number(row.metrics.costMicros ?? 0) / 1e6;
        perDate[d].clicks += Number(row.metrics.clicks ?? 0);
        perDate[d].impressions += Number(row.metrics.impressions ?? 0);
      }
    }

    const upserts = Object.entries(perDate).map(([date, v]) => ({
      date,
      cost_eur: Number(v.cost.toFixed(2)),
      clicks: v.clicks,
      impressions: v.impressions,
      synced_at: new Date().toISOString(),
    }));

    const admin = createAdminClient();
    if (upserts.length) {
      const { error } = await admin.from("ad_spend").upsert(upserts, { onConflict: "date" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      dagen: upserts.length,
      totaal_eur: Number(upserts.reduce((s, r) => s + r.cost_eur, 0).toFixed(2)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Onbekende fout" },
      { status: 500 },
    );
  }
}
