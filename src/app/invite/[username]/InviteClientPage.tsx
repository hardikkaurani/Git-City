"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";
import { signInWithGitHub } from "@/lib/sign-in";
import type { Session } from "@supabase/supabase-js";

interface ProfileData {
  exists: boolean;
  claimed: boolean;
  github_login: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers: number;
  following: number;
  public_repos: number;
  contributions: number;
  primary_language: string;
  invite_status: "claimed" | "invited" | "uninvited";
}

interface ProfileStatus {
  claimed: boolean;
  active: boolean;
  invited: boolean;
  is_owner: boolean;
  badges: string[];
}

export default function InviteClientPage({ username }: { username: string }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [status, setStatus] = useState<ProfileStatus | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserSupabase();

  useEffect(() => {
    // 1. Fetch Session
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setSession(data.session);
    });

    // 2. Fetch Profile & Status
    Promise.all([
      fetch(`/api/search-profile?username=${encodeURIComponent(username)}`).then((r) => r.json()),
      fetch(`/api/profile-status?username=${encodeURIComponent(username)}`).then((r) => r.json()),
    ])
      .then(([profileData, statusData]) => {
        if (profileData.error) throw new Error(profileData.error);
        if (statusData.error) throw new Error(statusData.error);
        setProfile(profileData);
        setStatus(statusData);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load invite details");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [username, supabase]);

  const handleSignIn = async () => {
    try {
      await signInWithGitHub(supabase, window.location.href);
    } catch (err) {
      alert("Failed to start GitHub login");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleClaim = async () => {
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch("/api/claim-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to claim profile");
      }
      // Redirect to home page and focus the new building!
      window.location.href = `/?user=${encodeURIComponent(username)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim");
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg text-cream font-mono">
        <p className="animate-pulse text-xs tracking-widest text-muted">LOADING CITIZEN RECORDS...</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4 text-center font-mono">
        <div className="border-[3px] border-border bg-bg-raised p-6 max-w-sm">
          <p className="text-xs text-red-400 uppercase tracking-wider mb-4">Database Error</p>
          <p className="text-[10px] text-muted mb-6 leading-relaxed">{error}</p>
          <Link
            href="/"
            className="btn-press inline-block border-[3px] border-border px-4 py-2 text-[10px] text-cream"
          >
            Back to City
          </Link>
        </div>
      </div>
    );
  }

  const oauthLogin = session?.user?.user_metadata?.user_name?.toLowerCase() || "";
  const isMatchingUser = oauthLogin === username.toLowerCase();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4 font-mono text-cream selection:bg-yellow-400 selection:text-black">
      <div className="w-full max-w-md border-[3px] border-border bg-bg-raised p-6 shadow-2xl relative">
        
        {/* Pixel Corners */}
        <div className="absolute -top-[3px] -left-[3px] w-2 h-2 bg-border"></div>
        <div className="absolute -top-[3px] -right-[3px] w-2 h-2 bg-border"></div>
        <div className="absolute -bottom-[3px] -left-[3px] w-2 h-2 bg-border"></div>
        <div className="absolute -bottom-[3px] -right-[3px] w-2 h-2 bg-border"></div>

        {/* Title */}
        <div className="text-center mb-6 border-b border-border pb-4">
          <h1 className="text-sm font-bold tracking-widest uppercase text-yellow-400">
            GIT CITY INVITATION
          </h1>
          <p className="text-[9px] text-muted mt-1 uppercase">
            3D Developer Metaverse
          </p>
        </div>

        {/* Profile Card */}
        {profile && (
          <div className="flex flex-col items-center">
            {profile.avatar_url && (
              <div className="relative mb-4">
                <Image
                  src={profile.avatar_url}
                  alt={profile.github_login}
                  width={80}
                  height={80}
                  className="border-[3px] border-border shadow-md"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
            )}

            <h2 className="text-xs font-bold text-cream">
              @{profile.github_login}
            </h2>
            {profile.name && <p className="text-[10px] text-muted mt-0.5">{profile.name}</p>}

            {profile.bio && (
              <p className="text-[10px] text-muted text-center mt-3 max-w-xs leading-relaxed border-t border-border/30 pt-3 italic">
                "{profile.bio}"
              </p>
            )}

            {/* Badges Container */}
            {status && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                {status.badges.map((badge, idx) => {
                  let badgeStyle = "border-muted text-muted";
                  if (badge === "Claimed Developer" || badge === "Verified Owner") {
                    badgeStyle = "border-green-500 text-green-400 bg-green-950/20";
                  } else if (badge === "Building Active") {
                    badgeStyle = "border-yellow-500 text-yellow-400 bg-yellow-950/20";
                  } else if (badge === "Invited Developer") {
                    badgeStyle = "border-blue-500 text-blue-400 bg-blue-950/20";
                  } else if (badge === "Building Not Claimed") {
                    badgeStyle = "border-red-500 text-red-400 bg-red-950/20";
                  }

                  return (
                    <span
                      key={idx}
                      className={`border text-[8px] uppercase tracking-wider px-2 py-0.5 font-bold ${badgeStyle}`}
                    >
                      {badge}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Stats Table */}
            <div className="w-full mt-6 bg-black/35 p-3 border-2 border-border/50 text-[10px] space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">CONTRIBUTIONS:</span>
                <span className="font-bold text-yellow-400">{profile.contributions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-border/20 pt-2">
                <span className="text-muted">PUBLIC REPOS:</span>
                <span className="font-bold text-yellow-400">{profile.public_repos}</span>
              </div>
              <div className="flex justify-between border-t border-border/20 pt-2">
                <span className="text-muted">FOLLOWERS:</span>
                <span className="font-bold text-yellow-400">{profile.followers.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-border/20 pt-2">
                <span className="text-muted">PRIMARY LANGUAGE:</span>
                <span className="font-bold text-yellow-400">{profile.primary_language}</span>
              </div>
            </div>

            {/* Actions Zone */}
            <div className="w-full mt-6 border-t border-border pt-5 flex flex-col items-center">
              
              {error && (
                <p className="text-[9px] text-red-400 uppercase text-center mb-4 leading-relaxed bg-red-950/30 border border-red-900/50 p-2 w-full">
                  Error: {error}
                </p>
              )}

              {profile.claimed ? (
                <div className="text-center w-full">
                  <p className="text-[10px] text-green-400 uppercase tracking-widest mb-4">
                    🏙️ TOWER ALREADY CLAIMED
                  </p>
                  <div className="flex justify-center gap-3">
                    <Link
                      href={`/?user=${encodeURIComponent(username)}`}
                      className="btn-press px-4 py-2 border-[3px] border-border text-[10px] text-bg bg-yellow-400 hover:bg-yellow-300 font-bold"
                    >
                      Visit Building
                    </Link>
                    <Link
                      href="/"
                      className="btn-press px-4 py-2 border-[3px] border-border text-[10px] text-cream hover:border-border-light font-bold"
                    >
                      Back to City
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="w-full text-center">
                  {!session ? (
                    <div>
                      <p className="text-[9px] text-muted uppercase tracking-wider mb-4 leading-normal">
                        Sign in with GitHub to verify ownership and claim your building.
                      </p>
                      <button
                        onClick={handleSignIn}
                        className="btn-press w-full py-2 border-[3px] border-border text-[10px] text-bg bg-yellow-400 hover:bg-yellow-300 font-bold uppercase tracking-wider"
                      >
                        Sign in with GitHub
                      </button>
                    </div>
                  ) : isMatchingUser ? (
                    <div>
                      <p className="text-[10px] text-yellow-400 uppercase tracking-wider mb-4 leading-relaxed font-bold animate-pulse">
                        ⭐ Verification Successful! You are @{username}
                      </p>
                      <button
                        onClick={handleClaim}
                        disabled={claiming}
                        className="btn-press w-full py-2.5 border-[3px] border-border text-[10px] text-bg bg-green-500 hover:bg-green-400 disabled:opacity-50 font-bold uppercase tracking-wider"
                      >
                        {claiming ? "Claiming..." : "Construct & Claim My Skyscraper"}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-red-950/20 border border-red-900/40 p-3 w-full text-left">
                      <p className="text-[9px] text-red-400 leading-normal uppercase">
                        ⚠️ ACCOUNT MISMATCH
                      </p>
                      <p className="text-[8px] text-muted mt-2 leading-relaxed normal-case">
                        This invite is for <strong className="text-cream">@{username}</strong>, but you are signed in as <strong className="text-cream">@{oauthLogin}</strong>.
                      </p>
                      <p className="text-[8px] text-muted mt-2 leading-relaxed normal-case">
                        If you are @{username}, please sign out and sign in using your matching GitHub account.
                      </p>
                      <button
                        onClick={handleSignOut}
                        className="mt-4 px-3 py-1.5 border-2 border-border text-[8px] text-cream hover:border-border-light uppercase font-bold"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="text-[10px] text-muted hover:text-cream transition-colors uppercase">
          ← Enter Git City
        </Link>
      </div>
    </div>
  );
}
