import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Google Ads spend-sync (accountniveau). Haalt de dagelijkse kosten van de
// laatste 90 dagen op en upsert ze in public.ad_spend. Gebruikt door de cron-
// route én de handmatige "Nu bijwerken"-knop op het dashboard.

export type AdsSyncResult = {
  ok: boolean;
  dagen?: number;
  totaal_eur?: number;
  error?: string;
  status?: number;
};

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

export async function runAdsSync(): Promise<AdsSyncResult> {
  const need = [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
  ];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) {
    return {
      ok: false,
      status: 400,
      error: `Ontbrekende env-variabelen: ${missing.join(", ")}`,
    };
  }

  try {
    const token = await getAccessToken();
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/[^0-9]/g, "");
    const loginId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/[^0-9]/g, "");

    // GAQL kent geen LAST_90_DAYS-literal → expliciete datumrange.
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const query =
      "SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions " +
      `FROM customer WHERE segments.date BETWEEN '${start}' AND '${end}'`;

    // API-versies verlopen; probeer de gepinde versie, val terug op recente.
    const versions = [
      process.env.GOOGLE_ADS_API_VERSION,
      "v22",
      "v21",
      "v20",
    ].filter(Boolean) as string[];

    type Batch = {
      results?: Array<{
        segments: { date: string };
        metrics: { costMicros?: string; clicks?: string; impressions?: string };
      }>;
    };
    let batches: Batch[] | null = null;
    let lastErr = "";
    for (const version of versions) {
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
      if (res.ok) {
        batches = (await res.json()) as Batch[];
        break;
      }
      lastErr = `${version}: ${(await res.text()).slice(0, 300)}`;
      if (res.status !== 404 && !lastErr.includes("UNSUPPORTED_VERSION")) break;
    }
    if (!batches) {
      return { ok: false, status: 500, error: `Google Ads API: ${lastErr}` };
    }

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
      if (error) return { ok: false, status: 500, error: error.message };
    }

    return {
      ok: true,
      dagen: upserts.length,
      totaal_eur: Number(upserts.reduce((s, r) => s + r.cost_eur, 0).toFixed(2)),
    };
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error: e instanceof Error ? e.message : "Onbekende fout",
    };
  }
}
