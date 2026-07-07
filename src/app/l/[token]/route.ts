import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Klik-redirect voor links in opvolgmails: /l/<report_token>?u=<base64url-url>&l=<label>
// Registreert de klik op de lead en stuurt door (302) naar de bestemming. GEEN
// auth — de report_token is de sleutel. Alleen doorsturen naar toegestane hosts,
// zodat dit geen open-redirect wordt.

const ALLOWED_HOSTS = [
  "opeigenerf.nl",
  "www.opeigenerf.nl",
  "crm.opeigenerf.nl",
];

function decodeTarget(u: string | null): URL | null {
  if (!u) return null;
  try {
    const decoded = Buffer.from(u, "base64url").toString("utf8");
    const url = new URL(decoded);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    const ok = ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
    return ok ? url : null;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const target = decodeTarget(request.nextUrl.searchParams.get("u"));

  // Ongeldige/niet-toegestane bestemming → naar de homepage i.p.v. blind door te sturen.
  if (!target) {
    return NextResponse.redirect("https://opeigenerf.nl/");
  }

  // Klik registreren (best-effort — mag de redirect nooit blokkeren).
  try {
    const admin = createAdminClient();
    const { data: lead } = await admin
      .from("leads")
      .select("id")
      .eq("report_token", token)
      .maybeSingle();
    if (lead) {
      await admin.from("lead_link_clicks").insert({
        lead_id: lead.id,
        url: target.toString(),
        label: request.nextUrl.searchParams.get("l")?.slice(0, 120) || null,
        user_agent: request.headers.get("user-agent")?.slice(0, 400) || null,
      });
    }
  } catch {
    /* stil falen — bezoeker moet altijd doorgestuurd worden */
  }

  return NextResponse.redirect(target.toString(), 302);
}
