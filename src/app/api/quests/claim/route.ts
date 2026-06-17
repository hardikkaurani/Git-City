import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { questId } = body;
  if (!questId) {
    return NextResponse.json({ error: "Quest ID is required" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];

  // 2. Fetch and check quest progress row
  const { data: row, error: rErr } = await admin
    .from("quest_progress")
    .select("*, quests(*)")
    .eq("developer_id", dev.id)
    .eq("quest_id", questId)
    .eq("quest_date", today)
    .single();

  if (rErr || !row) {
    return NextResponse.json({ error: "Daily quest not found or not assigned to you today" }, { status: 404 });
  }

  if (!row.completed) {
    return NextResponse.json({ error: "Daily quest is not completed yet" }, { status: 400 });
  }

  if (row.claimed) {
    return NextResponse.json({ error: "Daily quest reward already claimed" }, { status: 400 });
  }

  const quest = row.quests;
  if (!quest) {
    return NextResponse.json({ error: "Quest details missing" }, { status: 500 });
  }

  // 3. Grant Rewards
  // A. Credit Pixels
  if (quest.reward_pixels > 0) {
    await admin.rpc("credit_pixels", {
      p_developer_id: dev.id,
      p_amount: quest.reward_pixels,
      p_source: "achievement",
      p_reference_id: quest.id,
      p_reference_type: "daily_quest",
      p_description: `Daily Quest Completed: ${quest.title}`,
      p_idempotency_key: `quest-px:${dev.id}:${quest.id}:${today}`,
    });
  }

  // B. Credit XP
  if (quest.reward_xp > 0) {
    await admin.rpc("grant_xp", {
      p_developer_id: dev.id,
      p_source: "checkin",
      p_amount: quest.reward_xp,
    });
  }

  // C. Award Crate
  if (quest.reward_crate_id) {
    await admin.from("developer_crates").insert({
      developer_id: dev.id,
      crate_id: quest.reward_crate_id,
      opened: false,
    });
  }

  // 4. Mark daily quest as claimed
  const { data: updated } = await admin
    .from("quest_progress")
    .update({ claimed: true })
    .eq("developer_id", dev.id)
    .eq("quest_id", questId)
    .eq("quest_date", today)
    .select("*, quests(*)")
    .single();

  return NextResponse.json({
    success: true,
    quest: updated,
    rewards: {
      pixels: quest.reward_pixels,
      xp: quest.reward_xp,
      crate: quest.reward_crate_id,
    },
  });
}
