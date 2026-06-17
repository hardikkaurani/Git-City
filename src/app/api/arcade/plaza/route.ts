import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sb = getSupabaseAdmin();
  const serverSb = await createServerSupabase();
  const { data: { user } } = await serverSb.auth.getUser();

  let userLanguage: string | null = null;
  let userLogin: string | null = null;

  if (user) {
    userLogin =
      (user?.user_metadata?.user_name as string | undefined)?.toLowerCase() ??
      (user?.user_metadata?.preferred_username as string | undefined)?.toLowerCase() ??
      null;

    if (userLogin) {
      const { data: userDev } = await sb
        .from("developers")
        .select("primary_language")
        .eq("github_login", userLogin)
        .maybeSingle();
      if (userDev) {
        userLanguage = userDev.primary_language;
      }
    }
  }

  try {
    // 1. Recently Active (latest updated devs)
    const { data: active } = await sb
      .from("developers")
      .select("github_login, name, avatar_url, contributions, total_stars, public_repos, primary_language, xp_level, xp_total")
      .order("created_at", { ascending: false })
      .limit(6);

    // 2. Top Contributors (most contributions)
    const { data: topContributors } = await sb
      .from("developers")
      .select("github_login, name, avatar_url, contributions, total_stars, public_repos, primary_language, xp_level, xp_total")
      .order("contributions", { ascending: false })
      .limit(6);

    // 3. Trending/Legends (most stars)
    const { data: trending } = await sb
      .from("developers")
      .select("github_login, name, avatar_url, contributions, total_stars, public_repos, primary_language, xp_level, xp_total")
      .order("total_stars", { ascending: false })
      .limit(6);

    // 4. Same Language Developers (developers matching same language)
    let sameLang: any[] = [];
    if (userLanguage) {
      const { data } = await sb
        .from("developers")
        .select("github_login, name, avatar_url, contributions, total_stars, public_repos, primary_language, xp_level, xp_total")
        .eq("primary_language", userLanguage)
        .neq("github_login", userLogin || "")
        .limit(6);
      sameLang = data ?? [];
    }

    // Fallback if no language match: just get highest repos
    if (sameLang.length === 0) {
      const { data } = await sb
        .from("developers")
        .select("github_login, name, avatar_url, contributions, total_stars, public_repos, primary_language, xp_level, xp_total")
        .order("public_repos", { ascending: false })
        .limit(6);
      sameLang = data ?? [];
    }

    return NextResponse.json({
      active: active ?? [],
      topContributors: topContributors ?? [],
      trending: trending ?? [],
      sameLanguage: sameLang,
      currentUserLogin: userLogin,
      currentUserLanguage: userLanguage,
    });
  } catch (err: any) {
    console.error("Developer Plaza API Error:", err);
    return NextResponse.json({ error: "Failed to load plaza data" }, { status: 500 });
  }
}
