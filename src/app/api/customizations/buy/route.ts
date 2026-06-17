import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

const COSMETICS_CATALOG: Record<string, { type: string; price: number; name: string }> = {
  // Skins
  cyberpunk: { type: "building_theme", price: 500, name: "Cyberpunk Theme" },
  steampunk: { type: "building_theme", price: 500, name: "Steampunk Theme" },
  obsidian: { type: "building_theme", price: 1000, name: "Obsidian Theme" },
  crystal: { type: "building_theme", price: 750, name: "Crystal Theme" },
  // Effects
  ghost_glow: { type: "glow_effect", price: 400, name: "Ghost Glow Effect" },
  fire_trail: { type: "glow_effect", price: 400, name: "Fire Trail Effect" },
  rainbow_matrix: { type: "glow_effect", price: 600, name: "Rainbow Matrix Effect" },
  // Frames
  neon_border: { type: "profile_frame", price: 200, name: "Neon Border Frame" },
  matrix_rain: { type: "profile_frame", price: 200, name: "Matrix Rain Frame" },
  legend_shield: { type: "profile_frame", price: 300, name: "Legend Shield Frame" },
  // Titles
  citadel_lord: { type: "special_title", price: 150, name: "Citadel Lord Title" },
  code_wizard: { type: "special_title", price: 150, name: "Code Wizard Title" },
  star_catcher: { type: "special_title", price: 150, name: "Star Catcher Title" },
};

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

  const { itemId } = body;
  if (!itemId || !COSMETICS_CATALOG[itemId]) {
    return NextResponse.json({ error: "Invalid cosmetic item specified" }, { status: 400 });
  }

  const cosmetic = COSMETICS_CATALOG[itemId];

  // 2. Check if already owned
  const { data: existing } = await admin
    .from("developer_customizations")
    .select("id")
    .eq("developer_id", dev.id)
    .eq("type", cosmetic.type)
    .eq("value", itemId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "You already own this cosmetic item" }, { status: 400 });
  }

  // 3. Fetch wallet and check balance
  const { data: wallet } = await admin
    .from("wallets")
    .select("*")
    .eq("developer_id", dev.id)
    .single();

  if (!wallet || wallet.balance < cosmetic.price) {
    return NextResponse.json({ error: "Insufficient Pixels balance" }, { status: 400 });
  }

  const oldBalance = wallet.balance;
  const newBalance = wallet.balance - cosmetic.price;

  // 4. Debit pixels and insert transaction log
  // Update wallet balance
  const { error: wErr } = await admin
    .from("wallets")
    .update({
      balance: newBalance,
      lifetime_spent: (wallet.lifetime_spent || 0) + cosmetic.price,
      updated_at: new Date().toISOString(),
    })
    .eq("developer_id", dev.id);

  if (wErr) {
    return NextResponse.json({ error: "Transaction failed" }, { status: 500 });
  }

  // Write to ledger
  await admin.from("wallet_transactions").insert({
    developer_id: dev.id,
    type: "debit",
    amount: cosmetic.price,
    source: "item_purchase",
    reference_id: itemId,
    reference_type: "customization",
    description: `Purchased cosmetic: ${cosmetic.name}`,
    balance_before: oldBalance,
    balance_after: newBalance,
    idempotency_key: `buy-cosmetic:${dev.id}:${itemId}:${new Date().getTime()}`,
  });

  // 5. Add customization to developer inventory
  const { data: customization } = await admin
    .from("developer_customizations")
    .insert({
      developer_id: dev.id,
      type: cosmetic.type,
      value: itemId,
      active: false,
    })
    .select("*")
    .single();

  return NextResponse.json({
    success: true,
    newBalance,
    customization,
  });
}
