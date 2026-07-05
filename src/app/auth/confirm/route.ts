import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the magic-link / OTP confirmation. Supabase redirects here with
// ?token_hash=...&type=... — we verify it and set the session cookie.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // Routeer op rol: CRM -> allowlist, anders aanbieder-portaal.
      const { data: allowed } = await supabase.rpc("is_allowed_user");
      let dest: string | null = allowed ? next : null;
      if (!allowed) {
        const { data: status } = await supabase.rpc("my_aanbieder_status");
        if (status === "approved") dest = "/portal";
        else if (status === "pending" || status === "geweigerd") dest = "/portal/status";
      }
      if (dest) {
        return NextResponse.redirect(new URL(dest, request.url));
      }
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/login?error=not_allowed", request.url),
      );
    }
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
}
