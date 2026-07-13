import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Basis-URL van het klantportaal (opeigenerf.nl — "Mijn Erfplan"). Env-override
// mogelijk (PORTAL_BASE_URL); valt nooit terug op een localhost-waarde, zodat een
// test-verzending vanaf de dev-server geen onbereikbare link in de mail zet.
export function portalBaseUrl(): string {
  const url = process.env.PORTAL_BASE_URL?.replace(/\/$/, "");
  if (url && !/localhost|127\.0\.0\.1/.test(url)) return url;
  return "https://opeigenerf.nl";
}

/**
 * Genereer een magic-link naar "Mijn Erfplan" (/mijn/erf) voor een lead-e-mailadres.
 * De klant landt met één klik ingelogd op de erfcheck-pagina; de erfscan koppelt
 * daar automatisch op e-mailgelijkheid.
 *
 * Werkt via de token_hash/verifyOtp-flow: de site-callback verifieert het token
 * server-side (geen PKCE-verifier in de browser nodig). De CRM en de site delen
 * hetzelfde Supabase-project, dus deze admin-client kan het token genereren.
 *
 * Retourneert null bij een fout, zodat de aanroeper kan terugvallen op de CRM-link.
 */
export async function buildErfplanMagicLink(
  email: string,
  next = "/mijn/erf",
): Promise<string | null> {
  const admin = createAdminClient();

  // 1) Zorg dat de auth-user bestaat — generateLink('magiclink') vereist een
  //    bestaande user. Idempotent: een "already registered"-fout negeren we.
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createErr && !/already|registered|exists/i.test(createErr.message)) {
    return null;
  }

  // 2) Genereer het magic-link-token (one-time, verloopt volgens de Supabase
  //    OTP-expiry). Daarom pas verzenden op result-time, niet bij de aanvraag.
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) return null;

  // 3) Bouw de link naar de site-callback (token_hash-flow). `next` blijft intern.
  const params = new URLSearchParams({
    token_hash: hashed,
    type: "magiclink",
    next: next.startsWith("/mijn") ? next : "/mijn/erf",
  });
  return `${portalBaseUrl()}/mijn/auth/callback?${params.toString()}`;
}
