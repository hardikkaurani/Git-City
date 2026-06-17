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

  const { crateInstanceId } = body;
  if (!crateInstanceId) {
    return NextResponse.json({ error: "Crate Instance ID is required" }, { status: 400 });
  }

  // 2. Fetch and check owned crate
  const { data: crateInst, error: cErr } = await admin
    .from("developer_crates")
    .select("*, crates(*)")
    .eq("id", crateInstanceId)
    .eq("developer_id", dev.id)
    .single();

  if (cErr || !crateInst) {
    return NextResponse.json({ error: "Crate not found or does not belong to you" }, { status: 404 });
  }

  if (crateInst.opened) {
    return NextResponse.json({ error: "Crate has already been opened" }, { status: 400 });
  }

  // 3. Fetch crate rewards catalog
  const { data: rewards, error: rErr } = await admin
    .from("crate_rewards")
    .select("*")
    .eq("crate_id", crateInst.crate_id);

  if (rErr || !rewards || rewards.length === 0) {
    return NextResponse.json({ error: "No rewards found for this crate type" }, { status: 500 });
  }

  // 4. Weighted random selection
  const totalWeight = rewards.reduce((acc, curr) => acc + (curr.weight || 1), 0);
  let random = Math.floor(Math.random() * totalWeight);
  let selectedReward = rewards[0];

  for (const r of rewards) {
    random -= (r.weight || 1);
    if (random < 0) {
      selectedReward = r;
      break;
    }
  }

  // 5. Grant reward
  const rewardType = selectedReward.reward_type;
  const rewardValue = selectedReward.reward_value;

  if (rewardType === "pixels") {
    const amount = parseInt(rewardValue, 10) || 50;
    await admin.rpc("credit_pixels", {
      p_developer_id: dev.id,
      p_amount: amount,
      p_source: "achievement",
      p_reference_id: crateInstanceId,
      p_reference_type: "crate_opening",
      p_description: `Crate Opened: ${crateInst.crates.name}`,
      p_idempotency_key: `crate-open-px:${crateInstanceId}`,
    });
  } else if (rewardType === "xp") {
    const amount = parseInt(rewardValue, 10) || 100;
    await admin.rpc("grant_xp", {
      p_developer_id: dev.id,
      p_source: "checkin",
      p_amount: amount,
    });
  } else {
    // skin, effect, frame, badge -> insert into customizations
    let customType = "special_title";
    if (rewardType === "skin") customType = "building_theme";
    if (rewardType === "effect") customType = "glow_effect";
    if (rewardType === "frame") customType = "profile_frame";

    await admin.from("developer_customizations").insert({
      developer_id: dev.id,
      type: customType,
      value: rewardValue,
      active: false,
    });
  }

  // 6. Update Crate status to opened
  await admin
    .from("developer_crates")
    .update({
      opened: true,
      opened_at: new Date().toISOString(),
    })
    .eq("id", crateInstanceId);

  return NextResponse.json({
    success: true,
    reward: {
      type: rewardType,
      value: rewardValue,
    },
  });
}
