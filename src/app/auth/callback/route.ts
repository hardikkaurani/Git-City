import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { provisionDeveloperOnLogin } from "@/lib/auth-provision";

// Extend timeout for GitHub API calls during login
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=no_code`);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  let githubLogin = (
    data.user.user_metadata.user_name ??
    data.user.user_metadata.preferred_username ??
    ""
  ).toLowerCase();

  if (!githubLogin) {
    const email = data.user.email;
    const fullName = data.user.user_metadata.full_name || data.user.user_metadata.name;
    let baseHandle = "user";
    if (fullName) {
      baseHandle = fullName.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();
    } else if (email) {
      baseHandle = email.split("@")[0].replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();
    }
    baseHandle = baseHandle.slice(0, 30);
    if (!baseHandle) baseHandle = "user";

    const admin = getSupabaseAdmin();
    const { data: existing } = await admin
      .from("developers")
      .select("id, claimed_by")
      .eq("github_login", baseHandle)
      .maybeSingle();

    if (existing && existing.claimed_by !== data.user.id) {
      githubLogin = `${baseHandle}-${data.user.id.slice(0, 5)}`;
    } else {
      githubLogin = baseHandle;
    }

    // Sync generated username to user metadata so the client-side session immediately has it.
    await supabase.auth.updateUser({
      data: {
        user_name: githubLogin,
        preferred_username: githubLogin,
      },
    });
  }

  // Create/claim the building + XP + rank + feed + achievements + referral.
  // Shared with the local dev-login route (src/app/api/dev/login).
  await provisionDeveloperOnLogin(githubLogin, data.user.id, searchParams.get("ref"));

  // Support ?next= param for post-login redirect
  const next = searchParams.get("next");
  if (next && githubLogin) {
    // Special case: /shop redirects to /shop/{username}
    if (next === "/shop") {
      const admin = getSupabaseAdmin();
      const { data: dev } = await admin
        .from("developers")
        .select("github_login")
        .eq("github_login", githubLogin)
        .single();

      if (!dev) {
        return NextResponse.redirect(`${origin}/?user=${githubLogin}`);
      }

      return NextResponse.redirect(`${origin}/shop/${githubLogin}`);
    }

    // General redirect: only allow relative paths.
    // Reject protocol-relative ("//evil.com") and backslash ("/\evil.com")
    // forms, which browsers treat as off-site open redirects.
    if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?user=${githubLogin}`);
}
