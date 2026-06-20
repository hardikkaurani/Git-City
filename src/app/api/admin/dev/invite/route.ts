import { NextRequest, NextResponse } from "next/server";
import { getResend } from "@/lib/resend";
import { wrapInBaseTemplate, buildButton, escapeHtml, buildStatsTable } from "@/lib/email-template";
import { createServerSupabase } from "@/lib/supabase-server";
import { getGithubLoginFromUser, isAdminGithubLogin } from "@/lib/admin";
import { fetchGitHubDeveloperData } from "@/lib/github-api";

export const maxDuration = 60;

async function requireAdmin(): Promise<null | NextResponse> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminGithubLogin(getGithubLoginFromUser(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

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
  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  try {
    // Fetch GitHub data to customize the email (stars, contributions, avatar)
    const ghData = await fetchGitHubDeveloperData(username, { allowEmpty: true });
    
    const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://the-git-city.vercel.app";
    const inviteUrl = `${BASE_URL}/?user=${encodeURIComponent(username)}`;

    const subject = `You have been invited to construct your skyscraper in Git City! 🏙️`;
    
    const bodyHtml = `
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="${escapeHtml(ghData.avatar_url ?? "")}" width="80" height="80" style="border-radius: 50%; border: 3px solid #111111; display: block; margin: 0 auto 12px;" alt="${escapeHtml(username)}" />
        <h1 style="margin: 0 0 8px; font-family: Helvetica, Arial, sans-serif; font-size: 22px; color: #111111;">
          Build your tower, @${escapeHtml(username)}!
        </h1>
        <p style="margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 15px; color: #555555; line-height: 1.5;">
          You have been personally invited by the maintainer of <strong>Git City</strong> to claim your plot and construct your building.
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

      <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 30px 0 20px;" />
      
      <p style="margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #777777; text-align: center;">
        Invited by <strong>@hardikkaurani</strong>, Maintainer of Git City.
      </p>
    `;

    const html = wrapInBaseTemplate(bodyHtml);
    const resend = getResend();

    const { error: sendError } = await resend.emails.send({
      from: "Git City <noreply@example.com>",
      to: [email],
      subject,
      html,
    });

    if (sendError) {
      console.error("Resend error:", sendError);
      return NextResponse.json({ error: sendError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Invitation send error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to send invitation" }, { status: 500 });
  }
}
