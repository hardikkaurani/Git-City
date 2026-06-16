import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

const lastCheckout = new Map<string, number>();

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Rate limit: 1 request per 10 seconds
  const now = Date.now();
  const last = lastCheckout.get(user.id);
  if (last && now - last < 10_000) {
    return NextResponse.json({ error: "Too fast. Wait a few seconds." }, { status: 429 });
  }
  lastCheckout.set(user.id, now);

  const githubLogin = (
    user.user_metadata?.user_name ??
    user.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();

  if (!githubLogin) {
    return NextResponse.json({ error: "No GitHub login found" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  const { data: dev } = await sb
    .from("developers")
    .select("id, claimed, claimed_by, suspended")
    .eq("github_login", githubLogin)
    .single();

  if (!dev || !dev.claimed || dev.claimed_by !== user.id) {
    return NextResponse.json({ error: "You must claim your building first" }, { status: 403 });
  }

  if (dev.suspended) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  let body: { package_id: string; utr: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { package_id, utr } = body;
  if (!package_id || !utr) {
    return NextResponse.json({ error: "Missing package_id or UTR" }, { status: 400 });
  }

  // Validate UTR is 12 digits and numeric
  const utrRegex = /^\d{12}$/;
  if (!utrRegex.test(utr)) {
    return NextResponse.json({ error: "UTR must be exactly 12 numeric digits" }, { status: 400 });
  }

  // Validate package exists
  const { data: pkg } = await sb
    .from("pixel_packages")
    .select("*")
    .eq("id", package_id)
    .eq("is_active", true)
    .single();

  if (!pkg) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  // Check if UTR is already submitted
  const { data: existingPurchase } = await sb
    .from("pixel_purchases")
    .select("id")
    .eq("provider_tx_id", utr)
    .maybeSingle();

  if (existingPurchase) {
    return NextResponse.json({ error: "This UTR / Transaction ID has already been submitted" }, { status: 409 });
  }

  const priceInInr = Math.round((pkg.price_usd_cents / 100) * 85);

  try {
    const { data, error: insertError } = await sb.from("pixel_purchases").insert({
      developer_id: dev.id,
      package_id,
      provider: "upi",
      provider_tx_id: utr,
      amount_cents: priceInInr * 100, // INR cents
      currency: "inr",
      pixels_credited: 0,
      status: "pending",
    }).select().single();

    if (insertError) {
      console.error("UPI checkout insert error:", insertError);
      return NextResponse.json({ error: "Database error. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true, purchaseId: data.id });
  } catch (err) {
    console.error("UPI checkout error:", err);
    return NextResponse.json({ error: "Failed to submit UPI verification" }, { status: 500 });
  }
}
