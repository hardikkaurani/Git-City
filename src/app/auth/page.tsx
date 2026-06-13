"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function AuthContent() {
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || searchParams.get("next") || "/";

  const githubUrl = `/api/auth/github?redirect=${encodeURIComponent(redirectPath)}`;
  const googleUrl = `/api/auth/google?redirect=${encodeURIComponent(redirectPath)}`;

  const ACCENT = "#c8e64a";

  return (
    <div className="mx-auto max-w-sm px-4 py-20 text-center">
      <Link
        href="/"
        className="mb-8 inline-block text-xs text-muted transition-colors hover:text-cream"
      >
        &larr; Back to City
      </Link>

      <div className="border-[3px] border-border bg-bg-raised p-8 shadow-[4px_4px_0_0_rgba(0,0,0,0.5)]">
        <span
          className="inline-block text-[9px] font-bold tracking-[0.15em] border-2 border-border px-2.5 py-1 mb-6 text-[#c8e64a] uppercase"
        >
          Gate Entrance
        </span>

        <h1 className="text-xl text-cream font-bold mb-2 tracking-wide">
          ENTER GIT CITY
        </h1>
        <p className="text-[10px] text-muted normal-case mb-8 leading-relaxed">
          Sign in to claim your building, customized items, kudos, and start your city quests.
        </p>

        <div className="flex flex-col gap-4">
          {/* GitHub Sign In */}
          <a
            href={githubUrl}
            className="btn-press flex items-center justify-center gap-3 w-full py-3.5 text-xs text-bg font-bold transition-all"
            style={{
              backgroundColor: ACCENT,
              boxShadow: "3px 3px 0 0 #5a7a00",
            }}
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
            </svg>
            Sign in with GitHub
          </a>

          {/* Google Sign In */}
          <a
            href={googleUrl}
            className="btn-press flex items-center justify-center gap-3 w-full py-3.5 text-xs text-cream border-[3px] border-border bg-bg font-bold transition-all hover:bg-white/5"
            style={{
              boxShadow: "3px 3px 0 0 rgba(0,0,0,0.4)",
            }}
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.41 0-6.19-2.78-6.19-6.19 0-3.41 2.78-6.19 6.19-6.19 1.488 0 2.85.53 3.903 1.408l2.946-2.946C18.887 2.84 15.772 1.8 12.24 1.8 6.64 1.8 2.1 6.34 2.1 11.94s4.54 10.14 10.14 10.14c5.783 0 10.027-4.047 10.027-10.14 0-.693-.06-1.353-.173-1.995l-9.854.34z"/>
            </svg>
            Sign in with Google
          </a>
        </div>

        <p className="text-[8px] text-dim normal-case mt-6">
          We secure your account and only read basic public profile info.
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm">
      <Suspense fallback={<div className="text-center py-20 text-xs text-muted">Loading Gate...</div>}>
        <AuthContent />
      </Suspense>
    </main>
  );
}
