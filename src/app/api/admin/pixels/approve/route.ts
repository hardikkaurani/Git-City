import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getGithubLoginFromUser, isAdminGithubLogin } from "@/lib/admin";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = getGithubLoginFromUser(user);
  if (!isAdminGithubLogin(login)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { purchase_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { purchase_id } = body;
  if (!purchase_id) {
    return NextResponse.json({ error: "Missing purchase_id" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  const { data: purchase, error: fetchError } = await sb
    .from("pixel_purchases")
    .select("*")
    .eq("id", purchase_id)
    .single();

  if (fetchError || !purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  if (purchase.status !== "pending") {
    return NextResponse.json({ error: `Purchase is already ${purchase.status}` }, { status: 400 });
  }

  // Get package to calculate how many pixels to credit
  const { data: pkg } = await sb
    .from("pixel_packages")
    .select("pixels, bonus_pixels")
    .eq("id", purchase.package_id)
    .single();

  if (!pkg) {
    return NextResponse.json({ error: "Pixel package not found" }, { status: 404 });
  }

  const totalPx = pkg.pixels + pkg.bonus_pixels;

  try {
    // 1. Credit pixels using the RPC function
    const { data: rpcData, error: rpcError } = await sb.rpc("credit_pixels", {
      p_developer_id: purchase.developer_id,
      p_amount: totalPx,
      p_source: "purchase",
      p_reference_id: purchase.id,
      p_reference_type: "upi_purchase",
      p_description: `Approved UPI purchase of ${totalPx} PX (${purchase.package_id})`,
      p_idempotency_key: `upi:${purchase.id}`,
    });

    const isDuplicate = rpcData && rpcData.error === "duplicate_transaction";

    if (rpcError || (rpcData && rpcData.error && !isDuplicate)) {
      console.error("RPC credit_pixels error:", rpcError || rpcData?.error);
      return NextResponse.json({ error: rpcError?.message || rpcData?.error || "Failed to credit pixels" }, { status: 500 });
    }

    // 2. Update status of purchase to completed
    const { error: updateError } = await sb
      .from("pixel_purchases")
      .update({
        status: "completed",
        pixels_credited: totalPx,
      })
      .eq("id", purchase.id);

    if (updateError) {
      console.error("Update purchase status error:", updateError);
      return NextResponse.json({ error: "Failed to update purchase status" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Approve purchase error:", err);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
