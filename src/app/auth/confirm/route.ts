import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the magic-link / OTP confirmation. Supabase redirects here with
// ?token_hash=...&type=... — we verify it and set the session cookie.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/leads";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // Confirm the user is actually on the allowlist (defence in depth).
      const { data: allowed } = await supabase.rpc("is_allowed_user");
      if (allowed) {
        return NextResponse.redirect(new URL(next, request.url));
      }
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/login?error=not_allowed", request.url),
      );
    }
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
}
