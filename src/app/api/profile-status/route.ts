import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";
import { getGithubLoginFromUser } from "@/lib/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username")?.trim().toLowerCase();

  if (!username) {
    return NextResponse.json({ error: "Missing username parameter" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  try {
    // Check if claimed in claimed_profiles
    const { data: claimRecord } = await sb
      .from("claimed_profiles")
      .select("*")
      .eq("github_login", username)
      .maybeSingle();

    // Check if exists in developers
    const { data: devRecord } = await sb
      .from("developers")
      .select("claimed, claimed_by")
      .eq("github_login", username)
      .maybeSingle();

    const claimed = !!(claimRecord || devRecord?.claimed);

    // Check if invited in developer_invites
    const { data: inviteRecord } = await sb
      .from("developer_invites")
      .select("*")
      .eq("invite_code", username)
      .maybeSingle();

    const invited = !!inviteRecord;

    // Check if the current viewer is the verified owner
    let isViewerOwner = false;
    try {
      const supabase = await createServerSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const viewerLogin = getGithubLoginFromUser(user);
        if (viewerLogin === username) {
          isViewerOwner = true;
        }
      }
    } catch {}

    // Generate badges list
    const badges: string[] = [];
    if (claimed) {
      badges.push("Claimed Developer");
      badges.push("Building Active");
      badges.push("Verified Owner");
    } else {
      badges.push("Building Not Claimed");
      if (invited) {
        badges.push("Invited Developer");
      }
    }

    return NextResponse.json({
      username,
      claimed,
      active: claimed,
      invited,
      is_owner: isViewerOwner,
      badges,
    });
  } catch (err) {
    console.error("Profile status error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch profile status" },
      { status: 500 }
    );
  }
}
