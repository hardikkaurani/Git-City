"use client";

import { useState } from "react";
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
}

interface InviteCardProps {
  developer: InvitePreview;
  isLoggedIn: boolean;
  isAdmin?: boolean;
  onLogin: () => void;
  onClose: () => void;
  accent: string;
  shadow: string;
}

export default function InviteCard({ developer, isLoggedIn, isAdmin, onLogin, onClose, accent, shadow }: InviteCardProps) {
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const inviteUrl = `${window.location.origin}/?user=${developer.github_login}`;

  const handleInvite = async () => {
    let defaultEmail = developer.email || "";
    let promptMsg = `Invite @${developer.github_login}!\n`;
    if (developer.email) {
      promptMsg += `We found a public email: ${developer.email}.\nPress OK to send the invitation to this email, or edit it below:`;
    } else {
      promptMsg += `No public email was found on their GitHub profile.\nPlease enter the email address to send the invitation to:`;
    }

    const emailConfirm = window.prompt(promptMsg, defaultEmail);
    if (emailConfirm === null) return;

    const targetEmail = emailConfirm.trim();
    if (!targetEmail) {
      alert("Email address is required to send the invitation.");
      return;
    }

    setAdding(true);
    setAddError(null);

    try {
      const res = await fetch("/api/admin/dev/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: developer.github_login,
          email: targetEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send invitation email");
      }

      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      if (data.emailSent === false) {
        alert(`Invite link successfully copied to your clipboard!\n\n(Note: The invitation email could not be sent because RESEND_API_KEY is not configured on the server)`);
      } else {
        alert(`Invitation email successfully sent to ${targetEmail}!\nInvite link has also been copied to your clipboard.`);
      }
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative mx-3 border-[3px] border-border bg-bg-raised p-4 text-center sm:mx-0 sm:p-6" style={{ maxWidth: 340 }}>
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-[10px] text-muted transition-colors hover:text-cream"
        >
          &#10005;
        </button>

        {/* Avatar */}
        {developer.avatar_url && (
          <Image
            src={developer.avatar_url}
            alt={developer.github_login}
            width={48}
            height={48}
            className="mx-auto mb-3 border-2 border-border"
            style={{ imageRendering: "pixelated" }}
          />
        )}

        {/* Name */}
        <p className="text-xs text-cream normal-case">
          <span style={{ color: accent }}>@{developer.github_login}</span>
          {developer.name && (
            <span className="text-muted"> ({developer.name})</span>
          )}
        </p>

        {/* Status */}
        <p className="mt-2 text-[10px] text-muted normal-case">
          Not in the city yet
        </p>

        {/* Stats */}
        <p className="mt-2 text-[10px] text-muted normal-case">
          <span style={{ color: accent }}>{developer.contributions.toLocaleString()}</span> contributions
          {" · "}
          <span style={{ color: accent }}>{developer.total_stars.toLocaleString()}</span> stars
          {" · "}
          <span style={{ color: accent }}>{developer.public_repos}</span> repos
        </p>

        {/* CTAs */}
        {(isAdmin || !isLoggedIn) && (
          <div className="mt-4 flex flex-col items-center gap-2 sm:mt-5 sm:flex-row sm:justify-center sm:gap-3">
            {!isLoggedIn && (
              <button
                onClick={() => { onLogin(); onClose(); }}
                className="btn-press whitespace-nowrap px-4 py-2 text-[10px] text-bg"
                style={{
                  backgroundColor: accent,
                  boxShadow: `3px 3px 0 0 ${shadow}`,
                }}
              >
                This is me? Sign in
              </button>
            )}

            {isAdmin && (
              <button
                onClick={handleInvite}
                disabled={adding}
                className="btn-press whitespace-nowrap border-[3px] border-border px-4 py-2 text-[10px] text-cream transition-colors hover:border-border-light disabled:opacity-60"
              >
                {adding ? "Sending Invite..." : copied ? "Invite Sent!" : "Invite this dev"}
              </button>
            )}
          </div>
        )}

        {addError && (
          <p className="mt-3 text-[10px] text-red-400 normal-case">{addError}</p>
        )}
      </div>
    </div>
  );
}
