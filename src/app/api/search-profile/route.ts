import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchGitHubDeveloperData } from "@/lib/github-api";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username")?.trim().toLowerCase();

  if (!username) {
    return NextResponse.json({ error: "Missing username parameter" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  try {
    // 1. Check if the developer is already in the database
    const { data: cached } = await sb
      .from("developers")
      .select("*")
      .eq("github_login", username)
      .maybeSingle();

    if (cached) {
      // Check if they are claimed in claimed_profiles or developers
      const { data: claimRecord } = await sb
        .from("claimed_profiles")
        .select("*")
        .eq("github_login", username)
        .maybeSingle();

      const claimed = !!(cached.claimed || claimRecord);

      // Check if there is an active invite
      const { data: inviteRecord } = await sb
        .from("developer_invites")
        .select("*")
        .eq("invite_code", username)
        .maybeSingle();

      return NextResponse.json({
        exists: true,
        claimed,
        github_login: cached.github_login,
        name: cached.name,
        avatar_url: cached.avatar_url,
        bio: cached.bio,
        followers: cached.followers || 0,
        following: cached.following || 0,
        public_repos: cached.public_repos || 0,
        contributions: cached.contributions_total ?? cached.contributions ?? 0,
        primary_language: cached.primary_language || "Unknown",
        invite_status: claimed ? "claimed" : inviteRecord ? "invited" : "uninvited",
      });
    }

    // 2. Not cached: fetch public GitHub data (do NOT write/insert anything to database)
    const ghData = await fetchGitHubDeveloperData(username, { allowEmpty: true });

    // Check if an invite exists for this unsaved username
    const { data: inviteRecord } = await sb
      .from("developer_invites")
      .select("*")
      .eq("invite_code", username)
      .maybeSingle();

    return NextResponse.json({
      exists: false,
      claimed: false,
      github_login: ghData.github_login,
      name: ghData.name,
      avatar_url: ghData.avatar_url,
      bio: ghData.bio,
      followers: ghData.followers || 0,
      following: ghData.following || 0,
      public_repos: ghData.public_repos || 0,
      contributions: ghData.contributions_total ?? ghData.contributions ?? 0,
      primary_language: ghData.primary_language || "Unknown",
      invite_status: inviteRecord ? "invited" : "uninvited",
    });
  } catch (err) {
    console.error("Search profile error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to search profile" },
      { status: 500 }
    );
  }
}
