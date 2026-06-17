import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const githubLogin = (
    user.user_metadata?.user_name ??
    user.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();

  const admin = getSupabaseAdmin();

  // 1. Fetch developer
  const { data: dev } = await admin
    .from("developers")
    .select("id, claimed")
    .eq("github_login", githubLogin)
    .single();

  if (!dev || !dev.claimed) {
    return NextResponse.json({ error: "Must claim building first" }, { status: 403 });
  }

  const today = new Date().toISOString().split("T")[0];

  // 2. Fetch today's quests progress
  let { data: progress } = await admin
    .from("quest_progress")
    .select("quest_id, progress, completed, claimed, quest_date, quests(*)")
    .eq("developer_id", dev.id)
    .eq("quest_date", today);

  // 3. Auto-generate 4 random quests if none exist for today
  if (!progress || progress.length === 0) {
    const { data: allQuests } = await admin
      .from("quests")
      .select("*");

    if (allQuests && allQuests.length > 0) {
      // Shuffle and select 4
      const shuffled = [...allQuests].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 4);

      const insertRows = selected.map((q) => ({
        developer_id: dev.id,
        quest_id: q.id,
        quest_date: today,
        progress: 0,
        completed: false,
        claimed: false,
      }));

      await admin.from("quest_progress").insert(insertRows);

      // Re-fetch progress
      const { data: refetched } = await admin
        .from("quest_progress")
        .select("quest_id, progress, completed, claimed, quest_date, quests(*)")
        .eq("developer_id", dev.id)
        .eq("quest_date", today);

      progress = refetched || [];
    }
  }

  // 4. Fetch daily streak state
  let { data: streak } = await admin
    .from("daily_streaks")
    .select("*")
    .eq("developer_id", dev.id)
    .maybeSingle();

  if (!streak) {
    const newStreak = {
      developer_id: dev.id,
      current_streak: 0,
      longest_streak: 0,
      last_login_date: null,
      claimed_today: false,
    };
    const { data: inserted } = await admin
      .from("daily_streaks")
      .insert(newStreak)
      .select("*")
      .single();
    streak = inserted;
  }

  // Check if streak reset is needed (last login was more than 1 day ago)
  if (streak && streak.last_login_date) {
    const lastLogin = new Date(streak.last_login_date);
    const todayDate = new Date(today);
    const diffTime = Math.abs(todayDate.getTime() - lastLogin.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
      // Reset streak
      const { data: updated } = await admin
        .from("daily_streaks")
        .update({ current_streak: 0, claimed_today: false })
        .eq("developer_id", dev.id)
        .select("*")
        .single();
      streak = updated;
    } else if (streak.last_login_date !== today) {
      // It's a new day, allow claiming login reward again
      const { data: updated } = await admin
        .from("daily_streaks")
        .update({ claimed_today: false })
        .eq("developer_id", dev.id)
        .select("*")
        .single();
      streak = updated;
    }
  }

  // 5. Fetch owned crates
  const { data: crates } = await admin
    .from("developer_crates")
    .select("*, crates(*)")
    .eq("developer_id", dev.id)
    .eq("opened", false);

  // 6. Fetch owned customizations
  const { data: customizations } = await admin
    .from("developer_customizations")
    .select("*")
    .eq("developer_id", dev.id);

  // 7. Fetch wallet balance
  const { data: wallet } = await admin
    .from("wallets")
    .select("balance")
    .eq("developer_id", dev.id)
    .maybeSingle();

  return NextResponse.json({
    quests: progress || [],
    streak,
    crates: crates || [],
    customizations: customizations || [],
    balance: wallet?.balance ?? 0,
  });
}
