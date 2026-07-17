import { NextResponse, type NextRequest } from "next/server";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

// Notificatie-endpoint voor de omgevingsplan-poller. De poller (Railway) POST't
// hier bij een nieuw gesignaleerde gemeentewijziging; wij mailen een werkopdracht
// naar de redactie via Resend. GEEN publicatie-actie — de mens verwerkt de inhoud.
//
// Beveiligd met een gedeeld secret (x-notify-secret of Authorization: Bearer),
// zelfde patroon als de lead-ingest.
export async function POST(request: NextRequest) {
  const secret = process.env.NOTIFY_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "NOTIFY_SECRET niet gezet." }, { status: 503 });
  }
  const provided =
    request.headers.get("x-notify-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    gemeente?: string;
    type?: string;
    artikel?: string;
    bron_url?: string;
    id?: string;
    signalen?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const gemeente = (body.gemeente || "onbekende gemeente").trim();
  const artikel = (body.artikel || "?").trim();
  const type = (body.type || "onbekend").trim();
  const signalen = Array.isArray(body.signalen) ? body.signalen.filter((s) => typeof s === "string") : [];

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bron = body.bron_url && /^https?:\/\//.test(body.bron_url) ? body.bron_url : null;

  const to = process.env.NOTIFY_TO || process.env.LEAD_NOTIFY_EMAIL || "info@opeigenerf.nl";
  const html = `
<div style="font-family:system-ui,Arial,sans-serif;color:#0a1b2b;max-width:600px">
  <h2 style="margin:0 0 8px">Mogelijke wijziging vergunningvrij bouwen</h2>
  <table style="border-collapse:collapse;font-size:14px;margin-bottom:12px">
    <tr><td style="padding:2px 16px 2px 0;color:#64748b">Gemeente</td><td><strong>${esc(gemeente)}</strong></td></tr>
    <tr><td style="padding:2px 16px 2px 0;color:#64748b">Vindplaats</td><td><strong>${esc(artikel)}</strong></td></tr>
    <tr><td style="padding:2px 16px 2px 0;color:#64748b">Type</td><td>${esc(type)}</td></tr>
    ${signalen.length ? `<tr><td style="padding:2px 16px 2px 0;color:#64748b">Signaalwoorden</td><td>${signalen.map(esc).join(", ")}</td></tr>` : ""}
  </table>
  ${bron ? `<p><a href="${bron}" style="color:#0a1b2b">Bekijk de publicatie »</a></p>` : ""}
  <p style="margin:12px 0 0;font-size:13px;color:#64748b">
    Dit is een signaal, geen actie. Beoordeel de wijziging en werk de content bij in het CRM.
  </p>
</div>`;

  await sendEmail({
    to,
    subject: `[OpEigenErf] ${gemeente} — mogelijke wijziging vergunningvrij bouwen (${artikel})`,
    html,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
