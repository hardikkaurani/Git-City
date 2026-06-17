import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST() {
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

  // 2. Fetch daily streak state
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

  if (streak.claimed_today && streak.last_login_date === today) {
    return NextResponse.json({ error: "Already claimed today's login reward" }, { status: 400 });
  }

  // 3. Calculate new streak count
  let newStreakVal = 1;
  if (streak.last_login_date) {
    const lastLogin = new Date(streak.last_login_date);
    const todayDate = new Date(today);
    const diffTime = Math.abs(todayDate.getTime() - lastLogin.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      newStreakVal = streak.current_streak + 1;
    } else if (diffDays > 1) {
      newStreakVal = 1;
    } else {
      // same day or timezone edge case
      newStreakVal = streak.current_streak || 1;
    }
  }

  // 4. Calculate rewards based on the new streak value
  let pixelReward = 10;
  let xpReward = 20;
  let crateRewardId: string | null = null;
  let badgeReward: string | null = null;

  if (newStreakVal === 2) {
    pixelReward = 20;
  } else if (newStreakVal === 3) {
    pixelReward = 50;
  } else if (newStreakVal % 30 === 0) {
    pixelReward = 200;
    xpReward = 500;
    crateRewardId = "legendary";
    badgeReward = "legendary_badge";
  } else if (newStreakVal % 7 === 0) {
    pixelReward = 100;
    xpReward = 200;
    crateRewardId = "rare";
  }

  // 5. Credit Rewards
  // A. Credit pixels through RPC ledger
  if (pixelReward > 0) {
    await admin.rpc("credit_pixels", {
      p_developer_id: dev.id,
      p_amount: pixelReward,
      p_source: "streak_bonus",
      p_reference_id: today,
      p_reference_type: "daily_checkin",
      p_description: `Daily Check-in Day ${newStreakVal} Bonus`,
      p_idempotency_key: `checkin-px:${dev.id}:${today}:${newStreakVal}`,
    });
  }

  // B. Credit XP through RPC
  if (xpReward > 0) {
    await admin.rpc("grant_xp", {
      p_developer_id: dev.id,
      p_source: "checkin",
      p_amount: xpReward,
    });
  }

  // C. Award Crate if eligible
  if (crateRewardId) {
    await admin.from("developer_crates").insert({
      developer_id: dev.id,
      crate_id: crateRewardId,
      opened: false,
    });
  }

  // D. Award Badge if eligible
  if (badgeReward) {
    await admin.from("developer_customizations").insert({
      developer_id: dev.id,
      type: "special_title",
      value: badgeReward,
      active: true,
    });
  }

  // 6. Update Streak Row
  const { data: updatedStreak } = await admin
    .from("daily_streaks")
    .update({
      current_streak: newStreakVal,
      longest_streak: Math.max(streak.longest_streak || 0, newStreakVal),
      last_login_date: today,
      claimed_today: true,
      updated_at: new Date().toISOString(),
    })
    .eq("developer_id", dev.id)
    .select("*")
    .single();

  return NextResponse.json({
    success: true,
    streak: updatedStreak,
    rewards: {
      pixels: pixelReward,
      xp: xpReward,
      crate: crateRewardId,
      badge: badgeReward,
    },
  });
}
