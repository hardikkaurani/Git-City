import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { isLocalSupabase } from "@/lib/sign-in";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const redirectPath = searchParams.get("redirect") ?? "/";

  // Local dev has no Google OAuth provider configured — use the dev-login.
  if (isLocalSupabase()) {
    const next = redirectPath !== "/" ? `?next=${encodeURIComponent(redirectPath)}` : "";
    return NextResponse.redirect(`${origin}/api/dev/login${next}`);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectPath)}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/?error=oauth_failed`);
  }

  return NextResponse.redirect(data.url);
}
