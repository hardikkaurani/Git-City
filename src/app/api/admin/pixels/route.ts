import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getGithubLoginFromUser, isAdminGithubLogin } from "@/lib/admin";

export async function GET() {
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

  const sb = getSupabaseAdmin();

  try {
    // Fetch UPI purchases and join developers
    const { data: purchases, error } = await sb
      .from("pixel_purchases")
      .select(`
        id,
        package_id,
        provider,
        provider_tx_id,
        amount_cents,
        currency,
        status,
        created_at,
        developers (
          github_login
        )
      `)
      .eq("provider", "upi")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch UPI purchases error:", error);
      return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 });
    }

    // Format output
    const formatted = (purchases ?? []).map((p) => {
      const dev = Array.isArray(p.developers) ? p.developers[0] : p.developers;
      return {
        id: p.id,
        packageId: p.package_id,
        utr: p.provider_tx_id,
        amountInr: p.amount_cents / 100,
        status: p.status,
        createdAt: p.created_at,
        githubLogin: dev?.github_login ?? "unknown",
      };
    });

    return NextResponse.json({ purchases: formatted });
  } catch (err) {
    console.error("GET UPI purchases error:", err);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
