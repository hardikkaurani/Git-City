import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";
import { getResend } from "@/lib/resend";
import { wrapInBaseTemplate, buildButton, escapeHtml, buildStatsTable } from "@/lib/email-template";
import { fetchGitHubDeveloperData } from "@/lib/github-api";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // 1. Verify user is logged in
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { username?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!username) {
    return NextResponse.json({ error: "Missing username" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  try {
    // Check if already claimed
    const { data: cachedDev } = await sb
      .from("developers")
      .select("claimed")
      .eq("github_login", username)
      .maybeSingle();

    if (cachedDev?.claimed) {
      return NextResponse.json({ error: "Developer is already claimed" }, { status: 400 });
    }

    // Insert or update the invite in developer_invites
    const { data: invite, error: inviteErr } = await sb
      .from("developer_invites")
      .upsert({
        invite_code: username,
        invited_by: user.id,
        invited_email: email || null,
        claimed: false,
      }, { onConflict: "invite_code" })
      .select()
      .single();

    if (inviteErr || !invite) {
      throw new Error(inviteErr?.message || "Failed to create invite record");
    }

    // Record 'created' event
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    await sb.from("invite_events").insert({
      invite_id: invite.id,
      event_type: "created",
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    let emailSent = false;

    // Send email if address is provided and Resend key is set
    if (email && process.env.RESEND_API_KEY) {
      const ghData = await fetchGitHubDeveloperData(username, { allowEmpty: true });
      const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://the-git-city.vercel.app";
      const inviteUrl = `${BASE_URL}/invite/${encodeURIComponent(username)}`;

      const subject = `You have been invited to construct your skyscraper in Git City! 🏙️`;
      const bodyHtml = `
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="${escapeHtml(ghData.avatar_url ?? "")}" width="80" height="80" style="border-radius: 50%; border: 3px solid #111111; display: block; margin: 0 auto 12px;" alt="${escapeHtml(username)}" />
          <h1 style="margin: 0 0 8px; font-family: Helvetica, Arial, sans-serif; font-size: 22px; color: #111111;">
            Build your tower, @${escapeHtml(username)}!
          </h1>
          <p style="margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 15px; color: #555555; line-height: 1.5;">
            You have been personally invited to claim your plot and construct your building in <strong>Git City</strong>.
          </p>
        </div>

        <p style="margin: 0 0 16px; font-family: Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333333;">
          Git City is a 3D developer metaverse where your GitHub contributions are converted into towering skyscrapers. The more active you are on GitHub, the taller and more premium your building becomes.
        </p>

        <p style="margin: 0 0 8px; font-family: Helvetica, Arial, sans-serif; font-size: 14px; font-weight: bold; color: #111111; text-transform: uppercase; letter-spacing: 0.5px;">
          Your Current Github Stats:
        </p>
        
        ${buildStatsTable([
          { label: "Total Contributions", value: (ghData.contributions_total ?? ghData.contributions).toLocaleString() },
          { label: "Total Repository Stars", value: ghData.total_stars.toLocaleString() },
          { label: "Public Repositories", value: ghData.public_repos.toLocaleString() },
          { label: "Primary Language", value: ghData.primary_language ?? "Unknown" }
        ])}

        <p style="margin: 20px 0 14px; font-family: Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333333; text-align: center;">
          Click the button below to sign in via GitHub, claim your plot, and generate your building instantly:
        </p>

        ${buildButton("Claim Your Plot & Join Git City", inviteUrl)}
      `;

      const html = wrapInBaseTemplate(bodyHtml);
      const resend = getResend();
      const fromEmail = process.env.RESEND_FROM_EMAIL || "Git City <noreply@example.com>";

      const { error: sendError } = await resend.emails.send({
        from: fromEmail,
        to: [email],
        subject,
        html,
      });

      if (!sendError) {
        emailSent = true;
        // Record 'sent' event
        await sb.from("invite_events").insert({
          invite_id: invite.id,
          event_type: "sent",
          ip_address: ipAddress,
          user_agent: userAgent,
        });
      } else {
        console.error("Resend send error:", sendError);
      }
    }

    return NextResponse.json({
      success: true,
      invite_code: invite.invite_code,
      emailSent,
      warning: (email && !process.env.RESEND_API_KEY) ? "RESEND_API_KEY not configured" : undefined,
    });
  } catch (err) {
    console.error("Invite API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process invite" },
      { status: 500 }
    );
  }
}
