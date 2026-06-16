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
    .select("status")
    .eq("id", purchase_id)
    .single();

  if (fetchError || !purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  if (purchase.status !== "pending") {
    return NextResponse.json({ error: `Purchase is already ${purchase.status}` }, { status: 400 });
  }

  try {
    const { error: updateError } = await sb
      .from("pixel_purchases")
      .update({
        status: "expired", // 'expired' matches the allowed check constraint
      })
      .eq("id", purchase_id);

    if (updateError) {
      console.error("Reject purchase update error:", updateError);
      return NextResponse.json({ error: "Failed to reject purchase" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Reject purchase error:", err);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
