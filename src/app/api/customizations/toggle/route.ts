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

  const { customizationId } = body;
  if (!customizationId) {
    return NextResponse.json({ error: "Customization ID is required" }, { status: 400 });
  }

  // 2. Fetch customization
  const { data: custom, error: cErr } = await admin
    .from("developer_customizations")
    .select("*")
    .eq("id", customizationId)
    .eq("developer_id", dev.id)
    .single();

  if (cErr || !custom) {
    return NextResponse.json({ error: "Cosmetic item not found in your inventory" }, { status: 404 });
  }

  const targetActiveState = !custom.active;

  // 3. Deactivate all other owned items of the same type
  if (targetActiveState) {
    await admin
      .from("developer_customizations")
      .update({ active: false })
      .eq("developer_id", dev.id)
      .eq("type", custom.type);
  }

  // 4. Update the target item's active status
  const { data: updated, error: uErr } = await admin
    .from("developer_customizations")
    .update({ active: targetActiveState })
    .eq("id", customizationId)
    .select("*")
    .single();

  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    customization: updated,
  });
}
