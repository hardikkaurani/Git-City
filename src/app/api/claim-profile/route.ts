import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";
import { getGithubLoginFromUser } from "@/lib/admin";
import { provisionDeveloperOnLogin } from "@/lib/auth-provision";

export async function POST(req: NextRequest) {
  // 1. Verify user is logged in
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { username?: unknown; ref?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const ref = typeof body.ref === "string" ? body.ref.trim() : null;

  if (!username) {
    return NextResponse.json({ error: "Missing username parameter" }, { status: 400 });
  }

  // 2. Verify username ownership
  const oauthLogin = getGithubLoginFromUser(user);
  if (oauthLogin !== username) {
    return NextResponse.json({ error: "You can only claim your own GitHub profile" }, { status: 403 });
  }

  const sb = getSupabaseAdmin();

  try {
    // 3. Provision developer building, rank, achievements, welcome email, etc.
    await provisionDeveloperOnLogin(username, user.id, ref);

    // Retrieve developer record ID
    const { data: dev } = await sb
      .from("developers")
      .select("id")
      .eq("github_login", username)
      .single();

    if (!dev) {
      throw new Error("Developer record not found after provisioning");
    }

    // 4. Record claim in claimed_profiles
    await sb
      .from("claimed_profiles")
      .upsert({
        github_login: username,
        claimed_by: user.id,
        claimed_at: new Date().toISOString(),
      }, { onConflict: "github_login" });

    // 5. Record ownership in building_owners
    await sb
      .from("building_owners")
      .upsert({
        developer_id: dev.id,
        owner_id: user.id,
      }, { onConflict: "developer_id" });

    // 6. Update invite record to claimed
    const { data: invite } = await sb
      .from("developer_invites")
      .update({
        claimed: true,
        claimed_at: new Date().toISOString(),
      })
      .eq("invite_code", username)
      .select()
      .maybeSingle();

    if (invite) {
      // Record 'claimed' event
      const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";

      await sb.from("invite_events").insert({
        invite_id: invite.id,
        event_type: "claimed",
        ip_address: ipAddress,
        user_agent: userAgent,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Claim profile API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to claim profile" },
      { status: 500 }
    );
  }
}
