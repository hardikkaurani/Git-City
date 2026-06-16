"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface UpiPurchase {
  id: string;
  packageId: string;
  utr: string;
  amountInr: number;
  status: "pending" | "completed" | "expired" | "refunded";
  createdAt: string;
  githubLogin: string;
}

const ACCENT = "#c8e64a";

export function PixelsDashboard() {
  const [purchases, setPurchases] = useState<UpiPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "expired">("pending");

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pixels");
      if (!res.ok) throw new Error("Failed to fetch purchases");
      const json = await res.json();
      setPurchases(json.purchases ?? []);
    } catch (err) {
      setError("Failed to load UPI transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const handleApprove = async (id: string, utr: string) => {
    if (actioningId) return;
    setActioningId(id);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/admin/pixels/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchase_id: id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to approve transaction");
      }

      setSuccessMsg(`Approved transaction UTR: ${utr}. Pixels credited!`);
      fetchPurchases();
    } catch (err: any) {
      setError(err.message || "Failed to approve transaction");
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id: string, utr: string) => {
    if (actioningId) return;
    setActioningId(id);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/admin/pixels/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchase_id: id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reject transaction");
      }

      setSuccessMsg(`Rejected transaction UTR: ${utr}.`);
      fetchPurchases();
    } catch (err: any) {
      setError(err.message || "Failed to reject transaction");
    } finally {
      setActioningId(null);
    }
  };

  const filteredPurchases = purchases.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  const getStatusBadge = (status: UpiPurchase["status"]) => {
    switch (status) {
      case "completed":
        return (
          <span className="border border-lime/60 bg-lime/10 px-2 py-0.5 text-[10px] text-lime">
            COMPLETED
          </span>
        );
      case "pending":
        return (
          <span className="border border-yellow-500/60 bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-500 animate-pulse">
            PENDING
          </span>
        );
      case "expired":
        return (
          <span className="border border-red-500/60 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-500">
            REJECTED
          </span>
        );
      default:
        return (
          <span className="border border-border px-2 py-0.5 text-[10px] text-dim">
            {status.toUpperCase()}
          </span>
        );
    }
  };

  const formatPackage = (pkgId: string) => {
    switch (pkgId) {
      case "starter": return "Starter (100 PX)";
      case "value": return "Value Pack (525 PX)";
      case "popular": return "Popular (1200 PX)";
      case "mega": return "Mega Pack (2750 PX)";
      default: return pkgId;
    }
  };

  return (
    <div className="min-h-screen bg-bg font-pixel uppercase text-warm p-4 sm:p-6 lg:p-8">
      {loading && purchases.length === 0 && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-border">
          <div
            className="h-full w-1/3 bg-lime"
            style={{ animation: "loading-slide 1s ease-in-out infinite" }}
          />
          <style>{`@keyframes loading-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
        </div>
      )}

      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl text-cream">UPI PURCHASES</h1>
            <p className="mt-1 text-xs text-muted">
              {purchases.filter(p => p.status === "pending").length} pending transactions
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin"
              className="cursor-pointer border border-border px-4 py-2 text-xs text-muted transition-colors hover:border-border-light hover:text-cream"
            >
              BACK TO ADMIN
            </Link>
            <button
              onClick={fetchPurchases}
              disabled={loading}
              className="cursor-pointer border border-border px-4 py-2 text-xs text-muted transition-colors hover:border-border-light hover:text-cream"
            >
              {loading ? "REFRESHING..." : "REFRESH"}
            </button>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-4 border border-red-800 bg-red-900/20 p-4 text-xs text-red-400 normal-case">
            Error: {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 border border-lime/60 bg-lime/10 p-4 text-xs text-lime normal-case">
            Success: {successMsg}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 border-b border-border pb-1">
          {(["pending", "completed", "expired", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className="px-3 py-1.5 text-xs transition-colors cursor-pointer border-t-2 border-transparent"
              style={{
                borderColor: filter === t ? ACCENT : "transparent",
                color: filter === t ? ACCENT : "var(--color-muted)",
              }}
            >
              {t === "expired" ? "rejected" : t}
            </button>
          ))}
        </div>

        {/* Purchases Table */}
        <div className="border-[3px] border-border bg-bg">
          <div className="grid grid-cols-[1.2fr_1.2fr_1.5fr_1fr_1.5fr_0.8fr_auto] border-b border-border px-4 py-2.5 text-[10px] uppercase tracking-wider text-dim">
            <div>Date</div>
            <div>Developer</div>
            <div>Package</div>
            <div>Amount</div>
            <div>UTR / Transaction ID</div>
            <div>Status</div>
            <div className="text-right">Actions</div>
          </div>

          {filteredPurchases.length === 0 ? (
            <div className="px-4 py-12 text-center text-xs text-muted normal-case">
              {loading ? "Loading transactions..." : `No ${filter} UPI transactions found.`}
            </div>
          ) : (
            filteredPurchases.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[1.2fr_1.2fr_1.5fr_1fr_1.5fr_0.8fr_auto] items-center border-b border-border px-4 py-3 text-xs transition-colors hover:bg-bg-raised/50 last:border-b-0"
              >
                {/* Date */}
                <div className="text-dim">
                  {new Date(p.createdAt).toLocaleDateString()}
                  <span className="block text-[10px] opacity-75">
                    {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Developer */}
                <div className="min-w-0">
                  <Link
                    href={`/dev/${p.githubLogin}`}
                    target="_blank"
                    className="truncate text-cream hover:underline normal-case"
                  >
                    @{p.githubLogin}
                  </Link>
                </div>

                {/* Package */}
                <div className="text-cream">{formatPackage(p.packageId)}</div>

                {/* Amount */}
                <div className="text-cream">₹{p.amountInr}</div>

                {/* UTR */}
                <div className="font-mono text-[11px] text-cream select-all">{p.utr}</div>

                {/* Status */}
                <div>{getStatusBadge(p.status)}</div>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  {p.status === "pending" ? (
                    <>
                      <button
                        onClick={() => handleReject(p.id, p.utr)}
                        disabled={!!actioningId}
                        className="cursor-pointer border border-red-500 px-2.5 py-1 text-[10px] text-red-500 hover:bg-red-500/10 disabled:opacity-40"
                      >
                        {actioningId === p.id ? "..." : "REJECT"}
                      </button>
                      <button
                        onClick={() => handleApprove(p.id, p.utr)}
                        disabled={!!actioningId}
                        className="cursor-pointer border-2 border-lime px-2.5 py-0.5 text-[10px] text-lime hover:bg-lime/10 disabled:opacity-40"
                      >
                        {actioningId === p.id ? "..." : "APPROVE"}
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] text-dim">VERIFIED</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
