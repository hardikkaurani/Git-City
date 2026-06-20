import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username")?.trim().toLowerCase();
  const developerIdStr = searchParams.get("developer_id");

  const sb = getSupabaseAdmin();

  try {
    let devId: number | null = null;
    let login: string | null = null;

    if (developerIdStr) {
      devId = parseInt(developerIdStr, 10);
      if (isNaN(devId)) {
        return NextResponse.json({ error: "Invalid developer_id parameter" }, { status: 400 });
      }
      const { data: dev } = await sb
        .from("developers")
        .select("github_login")
        .eq("id", devId)
        .maybeSingle();
      if (dev) {
        login = dev.github_login;
      }
    } else if (username) {
      login = username;
      const { data: dev } = await sb
        .from("developers")
        .select("id")
        .eq("github_login", login)
        .maybeSingle();
      if (dev) {
        devId = dev.id;
      }
    } else {
      return NextResponse.json({ error: "Missing username or developer_id parameter" }, { status: 400 });
    }

    if (!login) {
      return NextResponse.json({ error: "Developer not found" }, { status: 404 });
    }

    // Check claimed_profiles
    const { data: claimRecord } = await sb
      .from("claimed_profiles")
      .select("*")
      .eq("github_login", login)
      .maybeSingle();

    if (!claimRecord) {
      return NextResponse.json({
        claimed: false,
        owner_id: null,
        claimed_at: null,
        developer_id: devId,
        github_login: login,
      });
    }

    return NextResponse.json({
      claimed: true,
      owner_id: claimRecord.claimed_by,
      claimed_at: claimRecord.claimed_at,
      developer_id: devId,
      github_login: login,
    });
  } catch (err) {
    console.error("Building owner error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch building owner" },
      { status: 500 }
    );
  }
}
