"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PROJECT_CONFIG, PROJECT_REPOSITORY_URL } from "@/config/project";

const ETH_ADDRESS = "0x8C24A2b54128bC0717F533E6DA7338be30b9f732";
const ACCENT = "#c8e64a";

function SupportContent() {
  const searchParams = useSearchParams();
  const thanks = searchParams.get("thanks") === "true";

  const [copied, setCopied] = useState(false);
  const [loadingAmount, setLoadingAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const copyEth = async () => {
    await navigator.clipboard.writeText(ETH_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStripeCheckout = async (amount: number) => {
    if (loadingAmount) return;
    setError(null);
    setLoadingAmount(amount);

    try {
      const res = await fetch("/api/support/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Failed to connect. Try again.");
    } finally {
      setLoadingAmount(null);
    }
  };

  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-muted transition-colors hover:text-cream sm:mb-8"
        >
          &larr; Back to City
        </Link>

        <h1 className="text-2xl text-cream sm:text-3xl">
          Keep the <span style={{ color: ACCENT }}>Signal</span> Alive
        </h1>
        <p className="mt-2 text-xs text-muted normal-case sm:text-sm">
          50,000 buildings. 2 million views. Zero ads. Built by one dev, on nights and weekends.
          Here&apos;s how you can help keep this city growing.
        </p>

        {/* Thank you banner */}
        {thanks && (
          <div
            className="mt-6 border-[3px] p-5 sm:p-6"
            style={{ borderColor: ACCENT, backgroundColor: "rgba(200, 230, 74, 0.06)" }}
          >
            <p className="text-sm" style={{ color: ACCENT }}>
              Thank you for your support
            </p>
            <p className="mt-2 text-xs text-muted normal-case">
              Your contribution keeps the city running. You are a real one.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-5">
          {/* Claim */}
          <div className="border-[3px] border-border bg-bg-raised p-5 sm:p-6">
            <p className="text-sm text-cream">
              <span style={{ color: ACCENT }}>01.</span> Claim your building
            </p>
            <p className="mt-2 text-xs text-muted normal-case">
              Connect your GitHub account and your building appears in the city based on your real contributions.
            </p>
            <Link
              href="/"
              className="btn-press mt-4 inline-block border-2 px-5 py-2 text-xs transition-colors"
              style={{ borderColor: ACCENT, color: ACCENT }}
            >
              Go to the city →
            </Link>
          </div>

          {PROJECT_CONFIG.discordUrl && (
            <div className="border-[3px] border-border bg-bg-raised p-5 sm:p-6">
              <p className="text-sm text-cream">
                <span style={{ color: ACCENT }}>02.</span> Join the Discord
              </p>
              <p className="mt-2 text-xs text-muted normal-case">
                Talk to other devs, follow updates, and help shape what gets built next.
              </p>
              <a
                href={PROJECT_CONFIG.discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press mt-4 inline-block border-2 border-border px-5 py-2 text-xs text-muted transition-colors hover:border-border-light hover:text-cream"
              >
                {PROJECT_CONFIG.discordUrl.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}

          {/* GitHub Star */}
          <div className="border-[3px] border-border bg-bg-raised p-5 sm:p-6">
            <p className="text-sm text-cream">
              <span style={{ color: ACCENT }}>03.</span> Star on GitHub
            </p>
            <p className="mt-2 text-xs text-muted normal-case">
              A star helps more developers discover Git City. Takes one click.
            </p>
            <a
              href={PROJECT_REPOSITORY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press mt-4 inline-block border-2 border-border px-5 py-2 text-xs text-muted transition-colors hover:border-border-light hover:text-cream"
            >
              {PROJECT_REPOSITORY_URL.replace(/^https?:\/\//, "")}
            </a>
          </div>

          {/* Financial support removed */}
        </div>
      </div>
    </main>
  );
}

export default function SupportPage() {
  return (
    <Suspense>
      <SupportContent />
    </Suspense>
  );
}
