import type { SupabaseClient } from "@supabase/supabase-js";

/** True when the browser is talking to a local Supabase instance. */
export function isLocalSupabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return /\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)(:|\/|$)/.test(url);
}

/**
 * Start GitHub sign-in.
 *
 * Against a local Supabase instance the GitHub OAuth provider isn't configured
 * (it needs a client secret that can't ship in an open-source repo), so this
 * routes to the zero-config local dev-login (`/api/dev/login`) instead. In
 * every other environment it runs the real GitHub OAuth flow unchanged.
 *
 * @param redirectTo Post-login URL (may carry a `?ref=` for referral credit).
 */
export async function signInWithGitHub(
  supabase: SupabaseClient,
  redirectTo: string,
): Promise<void> {
  if (isLocalSupabase()) {
    const u = new URL(redirectTo, window.location.origin);
    const params = new URLSearchParams();
    // Anything other than the OAuth callback is a post-login destination.
    if (u.pathname && u.pathname !== "/auth/callback") params.set("next", u.pathname);
    const ref = u.searchParams.get("ref");
    if (ref) params.set("ref", ref);
    const qs = params.toString();
    window.location.href = `/api/dev/login${qs ? `?${qs}` : ""}`;
    return;
  }

  await supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo } });
}
