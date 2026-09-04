import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Google Ads spend via de Windsor.ai-connector. Vervangt de directe Google Ads
// API-koppeling, die op een OAuth-refresh-token leunt die telkens verloopt.
// Windsor onderhoudt de koppeling met Google; wij halen alleen nog de cijfers op
// met een API-key die niet verloopt.
//
// Laat je 'campaign' uit de fields weg, dan aggregeert Windsor zelf per dag —
// precies de vorm die public.ad_spend nodig heeft (één rij per datum).

export type AdsSyncResult = {
  ok: boolean;
  dagen?: number;
  totaal_eur?: number;
  error?: string;
  status?: number;
};

function env(key: string): string {
  return (process.env[key] ?? "").trim();
}

/** Windsor verwacht het account als 'google_ads__137-670-5866'. Bouw dat uit het
 *  Google-klantnummer als WINDSOR_ACCOUNTS niet expliciet is gezet. */
function accountSelector(): string {
  const expliciet = env("WINDSOR_ACCOUNTS");
  if (expliciet) return expliciet;
  const cid = env("GOOGLE_ADS_CUSTOMER_ID").replace(/[^0-9]/g, "");
  if (cid.length !== 10) return "";
  return `google_ads__${cid.slice(0, 3)}-${cid.slice(3, 6)}-${cid.slice(6)}`;
}

export function windsorGeconfigureerd(): boolean {
  return Boolean(env("WINDSOR_API_KEY") && accountSelector());
}

type WindsorRij = {
  date?: string;
  spend?: number | string | null;
  clicks?: number | string | null;
  impressions?: number | string | null;
};

const getal = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Haalt de dagelijkse kosten/kliks/vertoningen op bij Windsor en upsert ze in
 * public.ad_spend (op datum). Standaard de laatste 90 dagen, zodat een gat na
 * een storing zichzelf herstelt.
 */
export async function runWindsorAdsSync(): Promise<AdsSyncResult> {
  const apiKey = env("WINDSOR_API_KEY");
  const accounts = accountSelector();
  if (!apiKey) {
    return { ok: false, status: 400, error: "WINDSOR_API_KEY niet gezet." };
  }
  if (!accounts) {
    return {
      ok: false,
      status: 400,
      error:
        "Geen Windsor-account bekend: zet WINDSOR_ACCOUNTS (bijv. google_ads__137-670-5866) of GOOGLE_ADS_CUSTOMER_ID.",
    };
  }

  const preset = env("WINDSOR_DATE_PRESET") || "last_90d";
  const url =
    "https://connectors.windsor.ai/all?" +
    new URLSearchParams({
      date_preset: preset,
      // Zonder 'campaign' levert Windsor één rij per datum.
      fields: "date,clicks,spend,impressions",
      select_accounts: accounts,
      api_key: apiKey,
    }).toString();

  let payload: { data?: WindsorRij[] };
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      // De API-key staat in de query-string; die nooit in een foutmelding echoën.
      return { ok: false, status: res.status, error: `Windsor ${res.status}: ${body}` };
    }
    payload = (await res.json()) as { data?: WindsorRij[] };
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error: `Windsor onbereikbaar: ${e instanceof Error ? e.message : "onbekende fout"}`,
    };
  }

  // Voor de zekerheid alsnog per datum optellen: als de fields ooit uitgebreid
  // worden met campaign/source levert Windsor meerdere rijen per dag.
  const perDatum = new Map<string, { cost: number; clicks: number; impressions: number }>();
  for (const r of payload.data ?? []) {
    const d = (r.date ?? "").slice(0, 10);
    if (!d) continue;
    const acc = perDatum.get(d) ?? { cost: 0, clicks: 0, impressions: 0 };
    acc.cost += getal(r.spend);
    acc.clicks += getal(r.clicks);
    acc.impressions += getal(r.impressions);
    perDatum.set(d, acc);
  }

  const upserts = [...perDatum.entries()].map(([date, v]) => ({
    date,
    cost_eur: Number(v.cost.toFixed(2)),
    clicks: Math.round(v.clicks),
    impressions: Math.round(v.impressions),
    synced_at: new Date().toISOString(),
  }));

  if (upserts.length === 0) {
    return { ok: true, dagen: 0, totaal_eur: 0 };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("ad_spend").upsert(upserts, { onConflict: "date" });
  if (error) return { ok: false, status: 500, error: error.message };

  return {
    ok: true,
    dagen: upserts.length,
    totaal_eur: Number(upserts.reduce((s, r) => s + r.cost_eur, 0).toFixed(2)),
  };
}
