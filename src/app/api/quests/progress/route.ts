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

  const { action, increment = 1 } = body;
  if (!action) {
    return NextResponse.json({ error: "Action is required" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];

  // 2. Fetch active quest progress rows that match this action
  const { data: qRows, error: qErr } = await admin
    .from("quest_progress")
    .select("*, quests(*)")
    .eq("developer_id", dev.id)
    .eq("quest_date", today)
    .eq("quests.action", action);

  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  const updatedRows = [];

  // 3. Process and update each matching quest progress
  if (qRows && qRows.length > 0) {
    for (const row of qRows) {
      if (!row.quests) continue; // safety filter

      // Check if already completed
      if (row.completed) {
        updatedRows.push(row);
        continue;
      }

      const newProgress = Math.min(row.quests.threshold, row.progress + increment);
      const isCompleted = newProgress >= row.quests.threshold;

      const { data: updated, error: uErr } = await admin
        .from("quest_progress")
        .update({
          progress: newProgress,
          completed: isCompleted,
        })
        .eq("developer_id", dev.id)
        .eq("quest_id", row.quest_id)
        .eq("quest_date", today)
        .select("*, quests(*)")
        .single();

      if (!uErr && updated) {
        updatedRows.push(updated);
      }
    }
  }

  return NextResponse.json({ success: true, quests: updatedRows });
}
