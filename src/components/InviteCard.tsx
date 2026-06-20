"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export interface InvitePreview {
  github_login: string;
  avatar_url: string | null;
  name: string | null;
  bio: string | null;
  email: string | null;
  contributions: number;
  public_repos: number;
  total_stars: number;
  primary_language: string | null;
  followers?: number;
  following?: number;
  claimed?: boolean;
}

interface InviteCardProps {
  developer: InvitePreview;
  isLoggedIn: boolean;
  isAdmin?: boolean;
  onLogin: () => void;
  onClose: () => void;
  onFlyToBuilding?: (login: string) => void;
  onCompare?: (developer: any) => void;
  onViewAchievements?: (login: string) => void;
  accent: string;
  shadow: string;
}

export default function InviteCard({
  developer,
  isLoggedIn,
  isAdmin,
  onLogin,
  onClose,
  onFlyToBuilding,
  onCompare,
  onViewAchievements,
  accent,
  shadow,
}: InviteCardProps) {
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [statusBadges, setStatusBadges] = useState<string[]>([]);
  const [isClaimed, setIsClaimed] = useState(!!developer.claimed);
  const [fetchingStatus, setFetchingStatus] = useState(true);

  const inviteUrl = `${window.location.origin}/invite/${developer.github_login}`;

  // Fetch live profile status/badges when component mounts
  useEffect(() => {
    setFetchingStatus(true);
    fetch(`/api/profile-status?username=${encodeURIComponent(developer.github_login.toLowerCase())}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setStatusBadges(data.badges || []);
          setIsClaimed(!!data.claimed);
        }
      })
      .catch((err) => console.error("Failed to fetch profile status:", err))
      .finally(() => setFetchingStatus(false));
  }, [developer.github_login]);

  const handleInvite = async () => {
    let defaultEmail = developer.email || "";
    let promptMsg = `Invite @${developer.github_login} to Git City!\n`;
    if (developer.email) {
      promptMsg += `We found a public email: ${developer.email}.\nPress OK to send the invitation to this email, or edit it below:`;
    } else {
      promptMsg += `No public email was found on their GitHub profile.\nPlease enter the email address to send the invitation to:`;
    }

    const emailConfirm = window.prompt(promptMsg, defaultEmail);
    if (emailConfirm === null) return;

    const targetEmail = emailConfirm.trim();
    setAdding(true);
    setAddError(null);

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: developer.github_login,
          email: targetEmail || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process invitation");
      }

      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);

      if (targetEmail && data.emailSent === false) {
        alert(
          `Invite link successfully copied to your clipboard!\n\n(Note: The invitation email could not be sent because RESEND_API_KEY is not configured on the server)`
        );
      } else if (targetEmail && data.emailSent) {
        alert(`Invitation email successfully sent to ${targetEmail}!\nInvite link has also been copied to your clipboard.`);
      } else {
        alert("Invite link copied to your clipboard!");
      }

      // Refresh status badges
      const statusRes = await fetch(`/api/profile-status?username=${encodeURIComponent(developer.github_login.toLowerCase())}`);
      const statusData = await statusRes.json();
      if (!statusData.error) {
        setStatusBadges(statusData.badges || []);
      }

      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setAdding(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      alert("Invite link copied to your clipboard!");
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      alert("Failed to copy link");
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 font-mono">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative mx-3 border-[3px] border-border bg-bg-raised p-5 text-center sm:mx-0 sm:p-6 w-full max-w-sm">
        {/* Pixel Corners */}
        <div className="absolute -top-[3px] -left-[3px] w-2 h-2 bg-border"></div>
        <div className="absolute -top-[3px] -right-[3px] w-2 h-2 bg-border"></div>
        <div className="absolute -bottom-[3px] -left-[3px] w-2 h-2 bg-border"></div>
        <div className="absolute -bottom-[3px] -right-[3px] w-2 h-2 bg-border"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-[10px] text-muted transition-colors hover:text-cream font-bold"
        >
          &#10005;
        </button>

        {/* Header Title */}
        <p className="text-[9px] uppercase tracking-widest text-yellow-400 font-bold mb-4">
          Developer Profile
        </p>

        {/* Avatar */}
        {developer.avatar_url && (
          <Image
            src={developer.avatar_url}
            alt={developer.github_login}
            width={64}
            height={64}
            className="mx-auto mb-3 border-2 border-border shadow-md"
            style={{ imageRendering: "pixelated" }}
          />
        )}

        {/* Username & Name */}
        <h3 className="text-xs text-cream normal-case font-bold">
          <span style={{ color: accent }}>@{developer.github_login}</span>
          {developer.name && (
            <span className="text-muted text-[10px]"> ({developer.name})</span>
          )}
        </h3>

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-1 mt-2.5">
          {fetchingStatus ? (
            <span className="border border-border/30 text-[8px] uppercase px-1.5 py-0.5 text-muted animate-pulse">
              fetching status...
            </span>
          ) : (
            statusBadges.map((badge, idx) => {
              let badgeClass = "border-muted text-muted";
              if (badge === "Claimed Developer" || badge === "Verified Owner") {
                badgeClass = "border-green-500 text-green-400 bg-green-950/20";
              } else if (badge === "Building Active") {
                badgeClass = "border-yellow-500 text-yellow-400 bg-yellow-950/20";
              } else if (badge === "Invited Developer") {
                badgeClass = "border-blue-500 text-blue-400 bg-blue-950/20";
              } else if (badge === "Building Not Claimed") {
                badgeClass = "border-red-500 text-red-400 bg-red-950/20";
              }

              return (
                <span
                  key={idx}
                  className={`border text-[8px] uppercase tracking-wider px-1.5 py-0.5 font-bold ${badgeClass}`}
                >
                  {badge}
                </span>
              );
            })
          )}
        </div>

        {/* Bio */}
        {developer.bio && (
          <p className="mt-3 text-[9px] text-muted normal-case max-w-xs mx-auto leading-relaxed border-t border-border/20 pt-2.5 italic">
            "{developer.bio}"
          </p>
        )}

        {/* GitHub Stats */}
        <div className="w-full mt-4 bg-black/30 p-2.5 border border-border/40 text-[9px] text-left space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted">Contributions:</span>
            <span className="font-bold text-cream">{developer.contributions.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t border-border/10 pt-1.5">
            <span className="text-muted">Repositories:</span>
            <span className="font-bold text-cream">{developer.public_repos}</span>
          </div>
          <div className="flex justify-between border-t border-border/10 pt-1.5">
            <span className="text-muted">Total Stars:</span>
            <span className="font-bold text-cream">{developer.total_stars.toLocaleString()}</span>
          </div>
          {(developer.followers !== undefined || developer.following !== undefined) && (
            <div className="flex justify-between border-t border-border/10 pt-1.5">
              <span className="text-muted">Followers / Following:</span>
              <span className="font-bold text-cream">
                {developer.followers ?? 0} / {developer.following ?? 0}
              </span>
            </div>
          )}
          {developer.primary_language && (
            <div className="flex justify-between border-t border-border/10 pt-1.5">
              <span className="text-muted">Primary Lang:</span>
              <span className="font-bold" style={{ color: accent }}>
                {developer.primary_language}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-5 w-full flex flex-col gap-2">
          {!fetchingStatus && isClaimed ? (
            /* STATE 1: CLAIMED DEVELOPER ACTIONS */
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  if (onFlyToBuilding) onFlyToBuilding(developer.github_login);
                  onClose();
                }}
                className="btn-press py-2 text-[9px] text-bg font-bold uppercase tracking-wider transition-colors"
                style={{ backgroundColor: accent, boxShadow: `2px 2px 0 0 ${shadow}` }}
              >
                Visit Building
              </button>
              <button
                onClick={() => {
                  if (onFlyToBuilding) onFlyToBuilding(developer.github_login);
                  onClose();
                }}
                className="btn-press border-[2px] border-border py-2 text-[9px] text-cream hover:border-border-light font-bold uppercase tracking-wider"
              >
                Fly To Building
              </button>
              <button
                onClick={() => {
                  if (onCompare) onCompare(developer);
                  onClose();
                }}
                className="btn-press border-[2px] border-border py-2 text-[9px] text-cream hover:border-border-light font-bold uppercase tracking-wider"
              >
                Compare Dev
              </button>
              <button
                onClick={() => {
                  if (onViewAchievements) onViewAchievements(developer.github_login);
                  onClose();
                }}
                className="btn-press border-[2px] border-border py-2 text-[9px] text-cream hover:border-border-light font-bold uppercase tracking-wider"
              >
                Achievements
              </button>
            </div>
          ) : (
            /* STATE 2: UNCLAIMED DEVELOPER ACTIONS */
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleInvite}
                  disabled={adding}
                  className="btn-press py-2 text-[9px] text-bg font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                  style={{ backgroundColor: accent, boxShadow: `2px 2px 0 0 ${shadow}` }}
                >
                  {adding ? "Inviting..." : "Invite Dev"}
                </button>
                <button
                  onClick={handleCopyLink}
                  className="btn-press border-[2px] border-border py-2 text-[9px] text-cream hover:border-border-light font-bold uppercase tracking-wider"
                >
                  Copy Invite Link
                </button>
              </div>

              <a
                href={`https://github.com/${developer.github_login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press w-full py-2 border-[2px] border-border text-[9px] text-cream hover:border-border-light font-bold uppercase tracking-wider block text-center"
              >
                Follow on GitHub
              </a>
            </div>
          )}
        </div>

        {addError && (
          <p className="mt-3.5 text-[9px] text-red-400 uppercase tracking-wide">{addError}</p>
        )}
      </div>
    </div>
  );
}
