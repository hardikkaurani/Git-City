"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GitcPayButton } from "@/components/GitcPayButton";
import { PaymentMethodTabs, type PaymentMethodOption } from "@/components/PaymentMethodTabs";
import { isGitcEnabled } from "@/lib/gitc";
import { isBrazilClient } from "@/lib/geo";
import { PROJECT_CONFIG } from "@/config/project";

type PayMethod = "card" | "pix" | "gitc" | "upi";

interface PixelPackage {
  id: string;
  name: string;
  pixels: number;
  bonus_pixels: number;
  price_usd_cents: number;
  price_brl_cents: number | null;
  sort_order: number;
}

interface PixModalData {
  brCode: string;
  brCodeBase64: string;
  pixId: string;
  packageName: string;
  totalPx: number;
}

interface Props {
  packages: PixelPackage[];
  balance: number;
  isAuthenticated: boolean;
  githubLogin: string;
  serverCountry?: string | null;
  purchases?: any[];
}

const BADGES: Record<string, { label: string; color: string }> = {
  popular: { label: "Most Popular", color: "#c8e64a" },
  mega: { label: "Best Value", color: "#f7931a" },
};

const PIX_EXPIRY_SECONDS = 900; // 15 min

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── PIX Modal ───────────────────────────────────────────────
function PixModal({
  data,
  onClose,
}: {
  data: PixModalData;
  onClose: (purchased: boolean) => void;
}) {
  const [countdown, setCountdown] = useState(PIX_EXPIRY_SECONDS);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"polling" | "completed" | "expired">("polling");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setStatus("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (status !== "polling") return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/pixels/purchase-status?pix_id=${data.pixId}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.status === "completed") setStatus("completed");
      } catch { /* ignore */ }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status, data.pixId]);

  useEffect(() => {
    if (status === "completed" || status === "expired") {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [status]);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  }, [data.brCode]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="relative mx-4 w-full max-w-sm border-[3px] border-border bg-bg p-6 font-pixel uppercase">
        <button
          onClick={() => onClose(false)}
          className="absolute right-3 top-3 text-sm text-muted hover:text-cream cursor-pointer"
        >
          &#10005;
        </button>

        <h3 className="mb-1 text-sm text-lime">PIX Payment</h3>
        <p className="mb-4 text-xs text-muted normal-case">
          {data.totalPx.toLocaleString()} PX — {data.packageName}
        </p>

        {status === "completed" ? (
          <div className="py-6 text-center">
            <p className="mb-2 text-base text-lime">Payment confirmed!</p>
            <p className="text-sm text-muted normal-case mb-4">
              {data.totalPx.toLocaleString()} PX added to your balance.
            </p>
            <button
              onClick={() => onClose(true)}
              className="btn-press px-6 py-2 text-sm text-bg"
              style={{ backgroundColor: "#c8e64a", boxShadow: "2px 2px 0 0 #5a7a00" }}
            >
              Done
            </button>
          </div>
        ) : status === "expired" ? (
          <div className="py-6 text-center">
            <p className="mb-2 text-sm text-red-400">QR code expired</p>
            <p className="text-xs text-muted normal-case mb-3">
              Close and try again to generate a new code.
            </p>
            <button
              onClick={() => onClose(false)}
              className="border-2 border-border px-4 py-2 text-xs text-cream hover:border-border-light cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex justify-center">
              {data.brCodeBase64 ? (
                <img
                  src={data.brCodeBase64}
                  alt="PIX QR Code"
                  className="h-48 w-48"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <div className="flex h-48 w-48 items-center justify-center border-2 border-border text-xs text-muted">
                  QR code unavailable
                </div>
              )}
            </div>

            <div className="mb-4">
              <p className="mb-1 text-[10px] text-muted">PIX code (copy &amp; paste):</p>
              <div className="flex items-stretch gap-1">
                <div className="flex-1 overflow-hidden border-2 border-border bg-bg-card px-2 py-1.5">
                  <p className="truncate text-[10px] text-cream normal-case">
                    {data.brCode}
                  </p>
                </div>
                <button
                  onClick={copyCode}
                  className="shrink-0 border-2 px-3 text-xs transition-colors cursor-pointer"
                  style={{
                    borderColor: copied ? "#c8e64a" : "var(--color-border)",
                    color: copied ? "#c8e64a" : "var(--color-cream)",
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted normal-case">
                Expires in{" "}
                <span style={{ color: countdown < 60 ? "#ef4444" : "#c8e64a" }}>
                  {formatCountdown(countdown)}
                </span>
              </p>
              <p className="text-xs text-muted normal-case animate-pulse">
                Checking payment...
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Store Client ───────────────────────────────────────
export default function PixelsStoreClient({
  packages,
  balance,
  isAuthenticated,
  githubLogin,
  serverCountry,
  purchases = [],
}: Props) {
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pixModal, setPixModal] = useState<PixModalData | null>(null);
  const [successPkg, setSuccessPkg] = useState<string | null>(null);
  const [, setCurrentBalance] = useState(balance);
  const [checkoutPkgId, setCheckoutPkgId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>("upi");
  const [isBR, setIsBR] = useState(false);
  const [utrInput, setUtrInput] = useState("");
  const [upiPendingUtr, setUpiPendingUtr] = useState<string | null>(null);
  const [activePurchaseId, setActivePurchaseId] = useState<string | null>(null);
  const [upiTimeLeft, setUpiTimeLeft] = useState<number>(300);
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);
  const router = useRouter();

  const handlePrintReceipt = (receipt: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - Git City</title>
          <style>
            body {
              font-family: monospace;
              padding: 40px;
              color: #000;
              background: #fff;
            }
            .receipt-box {
              max-width: 400px;
              margin: 0 auto;
              border: 2px dashed #000;
              padding: 20px;
            }
            .title {
              text-align: center;
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 20px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
              font-size: 14px;
            }
            .divider {
              border-bottom: 2px dashed #000;
              margin: 15px 0;
            }
            .stamp {
              text-align: center;
              border: 3px double red;
              color: red;
              font-size: 20px;
              font-weight: bold;
              padding: 5px;
              margin: 20px auto 0;
              width: 100px;
              transform: rotate(-5deg);
            }
          </style>
        </head>
        <body>
          <div class="receipt-box">
            <div class="title">GIT CITY ECONOMY</div>
            <div class="title">OFFICIAL RECEIPT</div>
            <div class="divider"></div>
            <div class="row"><span>ORDER ID:</span><span>${receipt.id}</span></div>
            <div class="row"><span>DATE:</span><span>${new Date(receipt.created_at).toLocaleString()}</span></div>
            <div class="row"><span>DEVELOPER:</span><span>@${githubLogin}</span></div>
            <div class="divider"></div>
            <div class="row"><span>ITEM:</span><span>${receipt.package_id.toUpperCase()} PACK</span></div>
            <div class="row"><span>METHOD:</span><span>${receipt.provider.toUpperCase()}</span></div>
            <div class="row"><span>REF ID/UTR:</span><span>${receipt.provider_tx_id || 'N/A'}</span></div>
            <div class="divider"></div>
            <div class="row" style="font-size: 16px; font-weight: bold;">
              <span>TOTAL PAID:</span>
              <span>${receipt.currency === 'inr' ? '₹' + (receipt.amount_cents / 100) : '$' + (receipt.amount_cents / 100)}</span>
            </div>
            <div class="stamp">PAID</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  /** Refresh the server-rendered balance + re-fetch any in-flight purchase state. */
  const refreshBalance = useCallback(() => {
    fetch("/api/pixels/balance")
      .then((r) => r.json())
      .then((d) => setCurrentBalance(d.balance ?? 0))
      .catch(() => {});
    router.refresh();
  }, [router]);

  const closeCheckoutModal = useCallback(() => {
    setCheckoutPkgId(null);
    setUtrInput("");
    setUpiPendingUtr(null);
    setActivePurchaseId(null);
    setUpiTimeLeft(300);
    setError(null);
    refreshBalance();
  }, [refreshBalance]);

  const handleUpiSubmit = async (pkgId: string) => {
    if (buying || !isAuthenticated) return;
    setBuying(pkgId);
    setError(null);
    try {
      const res = await fetch("/api/pixels/checkout/upi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id: pkgId, utr: utrInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit verification. Try again.");
        return;
      }
      setUpiPendingUtr(utrInput);
      setActivePurchaseId(data.purchaseId);
      setUtrInput("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBuying(null);
    }
  };

  // BR detection: server header (Vercel) → timezone → language fallback.
  useEffect(() => {
    if (isBrazilClient(serverCountry)) {
      setIsBR(true);
      setPayMethod("pix");
    }
  }, [serverCountry]);

  // Check for Stripe success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchased = params.get("pixels_purchased");
    if (purchased) {
      setSuccessPkg(purchased);
      window.history.replaceState({}, "", "/pixels");
      fetch("/api/pixels/balance")
        .then((r) => r.json())
        .then((d) => setCurrentBalance(d.balance ?? 0))
        .catch(() => {});
    }
  }, []);

  // UPI Countdown timer
  useEffect(() => {
    if (!checkoutPkgId || payMethod !== "upi" || upiPendingUtr) {
      setUpiTimeLeft(300);
      return;
    }

    setUpiTimeLeft(300);
    const interval = setInterval(() => {
      setUpiTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [checkoutPkgId, payMethod, upiPendingUtr]);

  // UPI realtime payment polling
  useEffect(() => {
    if (!activePurchaseId || !upiPendingUtr) return;

    let isSubscribed = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pixels/checkout/upi?purchaseId=${activePurchaseId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "completed") {
          clearInterval(interval);
          if (isSubscribed) {
            setSuccessPkg(checkoutPkgId);
            setCheckoutPkgId(null);
            setUpiPendingUtr(null);
            setActivePurchaseId(null);
            refreshBalance();
          }
        } else if (data.status === "expired" || data.status === "rejected") {
          clearInterval(interval);
          if (isSubscribed) {
            setError("Payment verification was rejected or expired.");
            setUpiPendingUtr(null);
            setActivePurchaseId(null);
          }
        }
      } catch (e) {
        console.error("Error checking UPI payment status:", e);
      }
    }, 3000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activePurchaseId, upiPendingUtr, checkoutPkgId, refreshBalance]);

  const handleStripeBuy = async (pkgId: string) => {
    if (buying || !isAuthenticated) return;
    setBuying(pkgId);
    setError(null);
    try {
      const res = await fetch("/api/pixels/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id: pkgId, provider: "stripe" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Checkout failed. Try again.");
        setBuying(null);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Network error. Please try again.");
      setBuying(null);
    }
  };

  const handlePixBuy = async (pkgId: string) => {
    if (buying || !isAuthenticated) return;
    setBuying(pkgId);
    setError(null);
    try {
      const res = await fetch("/api/pixels/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id: pkgId, provider: "abacatepay" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Checkout failed. Try again.");
        setBuying(null);
        return;
      }
      if (data.brCode) {
        const pkg = packages.find((p) => p.id === pkgId);
        const totalPx = pkg ? pkg.pixels + pkg.bonus_pixels : 0;
        setPixModal({
          brCode: data.brCode,
          brCodeBase64: data.brCodeBase64,
          pixId: data.pixId,
          packageName: pkg?.name ?? pkgId,
          totalPx,
        });
        setCheckoutPkgId(null);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBuying(null);
    }
  };

  const handlePixClose = (purchased: boolean) => {
    setPixModal(null);
    if (purchased) {
      fetch("/api/pixels/balance")
        .then((r) => r.json())
        .then((d) => setCurrentBalance(d.balance ?? 0))
        .catch(() => {});
    }
  };

  const gitcEnabled = isGitcEnabled();
  const highlightId = "popular";
  const checkoutPkg = checkoutPkgId ? packages.find((p) => p.id === checkoutPkgId) : null;

  return (
    <div>
      {/* PIX Modal */}
      {pixModal && <PixModal data={pixModal} onClose={handlePixClose} />}

      {/* Success banner (post-Stripe redirect) */}
      {successPkg && (
        <div className="mb-6 border-[3px] border-lime/40 bg-lime/10 p-4 text-center">
          <p className="text-base text-lime font-bold mb-1">Purchase confirmed!</p>
          <p className="text-sm text-muted normal-case">
            Your Pixels have been added to your balance.
          </p>
        </div>
      )}

      {/* Not authenticated */}
      {!isAuthenticated && (
        <div className="mb-6 border-[3px] border-border bg-bg-raised p-6 text-center">
          <p className="text-base text-cream mb-2">Sign in to buy Pixels</p>
          <p className="text-sm text-muted normal-case mb-4">
            You need a claimed building in Git City to purchase Pixels.
          </p>
          <Link
            href="/"
            className="btn-press inline-block px-6 py-2.5 text-sm text-bg"
            style={{ backgroundColor: "#c8e64a", boxShadow: "2px 2px 0 0 #5a7a00" }}
          >
            Go to City & Sign In
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-4 border-2 border-red-500/40 bg-red-500/10 p-3 text-center">
          <p className="text-sm text-red-400 normal-case">{error}</p>
        </div>
      )}

      {/* Package grid — 1 col mobile, 2 col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {packages.map((pkg) => {
          const total = pkg.pixels + pkg.bonus_pixels;
          const isHighlight = pkg.id === highlightId;
          const badge = BADGES[pkg.id];
          const isBuying = buying === pkg.id;
          const bonusPercent =
            pkg.bonus_pixels > 0
              ? Math.round((pkg.bonus_pixels / pkg.pixels) * 100)
              : 0;

          return (
            <div
              key={pkg.id}
              className={[
                "relative border-[3px] p-6 sm:p-8 transition-all",
                isHighlight
                  ? "border-lime bg-lime/5"
                  : "border-border bg-bg-raised hover:border-border-light",
              ].join(" ")}
            >
              {/* Badge */}
              {badge && (
                <div
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-bold text-bg whitespace-nowrap"
                  style={{ backgroundColor: badge.color }}
                >
                  {badge.label}
                </div>
              )}

              {/* Top row: name + price */}
              <div className="flex items-center justify-between mb-6 mt-1">
                <p className="text-base text-muted">{pkg.name}</p>
                <p className="text-base text-cream font-bold font-mono">
                  ₹{Math.round((pkg.price_usd_cents / 100) * 85)}
                </p>
              </div>

              {/* Center: big PX number */}
              <div className="text-center mb-6">
                <p className="text-5xl sm:text-6xl text-cream font-bold leading-none">
                  {total.toLocaleString()}
                </p>
                <p className="text-lg text-lime/60 mt-2">PX</p>
              </div>

              {/* Bonus (or empty space to keep alignment) */}
              <div className="text-center mb-6 min-h-[30px] flex items-center justify-center">
                {pkg.bonus_pixels > 0 && (
                  <span
                    className="inline-block px-4 py-1.5 text-sm font-bold text-bg"
                    style={{ backgroundColor: "#39d353" }}
                  >
                    +{pkg.bonus_pixels} BONUS ({bonusPercent}%)
                  </span>
                )}
              </div>

              {/* Buy button — opens checkout modal */}
              <button
                onClick={() => {
                  setError(null);
                  setCheckoutPkgId(pkg.id);
                }}
                disabled={!!buying || !isAuthenticated}
                className="btn-press w-full py-3.5 text-sm font-bold text-bg disabled:opacity-40 transition-all cursor-pointer"
                style={{
                  backgroundColor: "#c8e64a",
                  boxShadow: "2px 2px 0 0 #5a7a00",
                }}
              >
                {isBuying ? "Processing..." : "Buy"}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Checkout Modal ── */}
      {checkoutPkg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !buying) {
              closeCheckoutModal();
            }
          }}
        >
          <div className="w-full max-w-sm border-[3px] border-border bg-bg p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base text-cream sm:text-lg">
                {checkoutPkg.name}{" "}
                <span className="text-sm text-muted">
                  · {(checkoutPkg.pixels + checkoutPkg.bonus_pixels).toLocaleString()} PX
                </span>
              </h3>
              <button
                onClick={() => {
                  if (buying) return;
                  closeCheckoutModal();
                }}
                className="text-sm text-muted transition-colors hover:text-cream cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="mt-2 text-[10px] text-dim normal-case">
              ₹{Math.round((checkoutPkg.price_usd_cents / 100) * 85)} via UPI
              {checkoutPkg.price_brl_cents && (
                <> · R${(checkoutPkg.price_brl_cents / 100).toFixed(2)} via PIX</>
              )}
              {` · $${(checkoutPkg.price_usd_cents / 100).toFixed(2)} via Card`}
            </p>

            {error && (
              <div className="mt-3 border-2 border-red-500/40 bg-red-500/10 p-2 text-center">
                <p className="text-[10px] text-red-400 normal-case">{error}</p>
              </div>
            )}

            <div className="mt-4">
              {upiPendingUtr ? (
                <div className="py-4 text-center">
                  <p className="mb-2 text-sm text-lime font-bold">Verification Submitted!</p>
                  <p className="text-[11px] text-muted normal-case mb-4">
                    Transaction UTR {upiPendingUtr} has been submitted. The admin will verify the payment and credit your Pixels soon.
                  </p>
                  <button
                    onClick={closeCheckoutModal}
                    className="border-2 border-border px-4 py-2 text-xs text-cream hover:border-border-light cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              ) : (() => {
                const methods: PaymentMethodOption<PayMethod>[] = [
                  { id: "upi", label: "UPI" },
                  { id: "card", label: "Card" },
                  { id: "pix", label: "PIX", visible: isBR && !!checkoutPkg.price_brl_cents },
                  { id: "gitc", label: "GITC", visible: gitcEnabled },
                ];
                const visibleIds = methods.filter((m) => m.visible !== false).map((m) => m.id);
                const safeSelected = visibleIds.includes(payMethod) ? payMethod : visibleIds[0];

                return (
                  <PaymentMethodTabs<PayMethod>
                    methods={methods}
                    selected={safeSelected}
                    onChange={setPayMethod}
                  >
                    {safeSelected === "upi" && (() => {
                      const priceInInr = Math.round((checkoutPkg.price_usd_cents / 100) * 85);
                      const upiId = PROJECT_CONFIG.upiId;
                      const upiName = PROJECT_CONFIG.upiName;
                      const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${priceInInr}&cu=INR&tn=${encodeURIComponent("Git City PX: " + checkoutPkg.name)}`;
                      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`;

                      if (upiTimeLeft === 0) {
                        return (
                          <div className="py-6 text-center">
                            <p className="mb-2 text-sm text-red-500 font-bold">QR Code Session Expired</p>
                            <p className="text-[10px] text-muted normal-case mb-4">
                              The 5-minute payment session has timed out. Please restart the session to generate a fresh QR code.
                            </p>
                            <button
                              onClick={() => {
                                setUpiTimeLeft(300);
                                closeCheckoutModal();
                              }}
                              className="border-2 border-border px-4 py-2 text-xs text-cream hover:border-border-light cursor-pointer font-bold"
                            >
                              Restart Session
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div className="flex flex-col items-center">
                          <p className="mb-3 text-[10px] text-muted normal-case text-center">
                            Scan the QR code with any UPI app (GPay, PhonePe, Paytm, BHIM) to pay ₹{priceInInr}
                          </p>

                          <div className="mb-4 flex justify-center bg-white p-2 border-2 border-border">
                            <img
                              src={qrUrl}
                              alt="UPI QR Code"
                              className="h-44 w-44"
                              style={{ imageRendering: "pixelated" }}
                            />
                          </div>

                          <div className="mb-4 w-full">
                            <p className="mb-1 text-[10px] text-muted">UPI ID:</p>
                            <div className="flex items-stretch gap-1">
                              <div className="flex-1 overflow-hidden border-2 border-border bg-bg-card px-2 py-1.5">
                                <p className="truncate text-[10px] text-cream normal-case font-mono font-bold">
                                  {upiId}
                                </p>
                              </div>
                              <button
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(upiId);
                                    alert("UPI ID copied!");
                                  } catch {}
                                }}
                                className="shrink-0 border-2 px-3 text-xs transition-colors cursor-pointer border-border text-cream hover:text-lime hover:border-lime"
                              >
                                Copy
                              </button>
                            </div>
                          </div>

                          <div className="mb-1 w-full border-t border-border/50 pt-3">
                            <p className="mb-2 text-[10px] text-muted normal-case">
                              Enter the 12-digit UTR/Ref No. after paying to request credit approval:
                            </p>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                maxLength={12}
                                value={utrInput}
                                onChange={(e) => setUtrInput(e.target.value.replace(/\D/g, ""))}
                                placeholder="12-digit UTR No."
                                className="flex-1 border-2 border-border bg-bg-card px-2 py-1.5 text-xs text-cream normal-case font-mono focus:border-lime outline-none"
                              />
                              <button
                                onClick={() => handleUpiSubmit(checkoutPkg.id)}
                                disabled={utrInput.length !== 12 || !!buying || !isAuthenticated}
                                className="btn-press px-4 text-xs font-bold text-bg disabled:opacity-40 transition-all cursor-pointer"
                                style={{
                                  backgroundColor: "#c8e64a",
                                  boxShadow: "2px 2px 0 0 #5a7a00",
                                }}
                              >
                                {buying === checkoutPkg.id ? "..." : "Submit"}
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 flex justify-between items-center text-[10px] text-muted normal-case w-full border-t border-border/30 pt-3">
                            <span>SESSION EXPIRES IN:</span>
                            <span className={`font-mono font-bold ${upiTimeLeft < 60 ? "text-red-500 animate-pulse" : "text-lime"}`}>
                              {Math.floor(upiTimeLeft / 60)}:{(upiTimeLeft % 60).toString().padStart(2, "0")}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {safeSelected === "card" && (
                      <button
                        onClick={() => handleStripeBuy(checkoutPkg.id)}
                        disabled={!!buying || !isAuthenticated}
                        className="btn-press w-full py-3 text-sm text-bg disabled:opacity-40 transition-all cursor-pointer"
                        style={{
                          backgroundColor: "#c8e64a",
                          boxShadow: "2px 2px 0 0 #5a7a00",
                        }}
                      >
                        {buying === checkoutPkg.id
                          ? "Redirecting..."
                          : `Pay $${(checkoutPkg.price_usd_cents / 100).toFixed(2)} with card`}
                      </button>
                    )}

                    {safeSelected === "pix" && checkoutPkg.price_brl_cents && (
                      <button
                        onClick={() => handlePixBuy(checkoutPkg.id)}
                        disabled={!!buying || !isAuthenticated}
                        className="btn-press w-full py-3 text-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                          backgroundColor: "transparent",
                          border: "2px solid #c8e64a",
                          color: "#c8e64a",
                          boxShadow: "2px 2px 0 0 #5a7a00",
                        }}
                      >
                        {buying === checkoutPkg.id
                          ? "Generating PIX..."
                          : `Pay R$${(checkoutPkg.price_brl_cents / 100).toFixed(2)} with PIX`}
                      </button>
                    )}

                    {safeSelected === "gitc" && (
                      <GitcPayButton
                        disabled={!!buying}
                        onError={(msg) => setError(msg)}
                        onRequestQuote={async (wallet) => {
                          const res = await fetch("/api/pixels/checkout/gitc-quote", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ package_id: checkoutPkg.id, wallet }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok) throw new Error(data.error || "Could not get a quote");
                          return {
                            quoteId: data.quoteId,
                            gitcAmountWei: data.gitcAmountWei,
                            usdAmountCents: data.usdQuoteCents,
                            redirectUrl: `/pixels?pixels_purchased=${encodeURIComponent(checkoutPkg.id)}`,
                          };
                        }}
                        onConfirm={async ({ quoteId, txHash }) => {
                          const res = await fetch("/api/pixels/checkout/gitc-confirm", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ quoteId, txHash }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (res.ok) {
                            setError(null);
                            setSuccessPkg(checkoutPkg.id);
                            setCheckoutPkgId(null);
                            refreshBalance();
                          }
                          return { ok: res.ok, error: data.error };
                        }}
                      />
                    )}
                  </PaymentMethodTabs>
                );
              })()}
            </div>

            <p className="mt-3 text-center text-[9px] text-muted normal-case">
              {payMethod === "upi" && "Manual UPI payment verification."}
              {payMethod === "card" && "One-time payment via Stripe."}
              {payMethod === "pix" && "Brazilian PIX via AbacatePay."}
              {payMethod === "gitc" && "GITC sent on Base."}
            </p>
          </div>
        </div>
      )}

      {/* Purchase History Section */}
      {purchases && purchases.length > 0 && (
        <div className="mt-12 border-[3px] border-border bg-bg-raised p-6">
          <h2 className="text-xl text-cream mb-4 text-center">
            Your Purchase History
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[10px] tracking-wider text-dim uppercase">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Package</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Provider</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-bg/40">
                    <td className="py-2.5 text-dim">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 text-cream capitalize">
                      {p.package_id} Pack
                    </td>
                    <td className="py-2.5 text-cream font-mono">
                      {p.currency === "inr" ? `₹${p.amount_cents / 100}` : `$${(p.amount_cents / 100).toFixed(2)}`}
                    </td>
                    <td className="py-2.5 text-dim uppercase">{p.provider}</td>
                    <td className="py-2.5">
                      {p.status === "completed" && (
                        <span className="text-lime font-bold">COMPLETED</span>
                      )}
                      {p.status === "pending" && (
                        <span className="text-yellow-500 animate-pulse">PENDING</span>
                      )}
                      {p.status === "expired" && (
                        <span className="text-red-500">REJECTED</span>
                      )}
                      {p.status !== "completed" && p.status !== "pending" && p.status !== "expired" && (
                        <span className="text-dim uppercase">{p.status}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {p.status === "completed" ? (
                        <button
                          onClick={() => setActiveReceipt(p)}
                          className="cursor-pointer border border-lime px-2.5 py-1 text-[10px] text-lime hover:bg-lime/10"
                        >
                          VIEW BILL
                        </button>
                      ) : (
                        <span className="text-[10px] text-dim">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {activeReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setActiveReceipt(null)}
        >
          <div
            className="w-full max-w-sm border-[3px] border-border bg-bg p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveReceipt(null)}
              className="absolute top-4 right-4 text-sm text-muted hover:text-cream cursor-pointer"
            >
              &times;
            </button>

            <h3 className="text-base text-cream sm:text-lg text-center mb-6">
              Official Bill Receipt
            </h3>

            <div className="border-2 border-dashed border-border bg-bg-card p-4 font-mono text-xs normal-case select-all">
              <div className="text-center font-bold text-cream mb-4">
                GIT CITY OFFICIAL RECEIPT
              </div>
              <div className="flex justify-between mb-1.5">
                <span className="text-muted">Order ID:</span>
                <span className="text-cream truncate max-w-[180px]">{activeReceipt.id}</span>
              </div>
              <div className="flex justify-between mb-1.5">
                <span className="text-muted">Date:</span>
                <span className="text-cream">{new Date(activeReceipt.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between mb-1.5">
                <span className="text-muted">Developer:</span>
                <span className="text-cream">@{githubLogin}</span>
              </div>
              <hr className="border-dashed border-border/60 my-3" />
              <div className="flex justify-between mb-1.5">
                <span className="text-muted">Item:</span>
                <span className="text-cream capitalize">{activeReceipt.package_id} Pack</span>
              </div>
              <div className="flex justify-between mb-1.5">
                <span className="text-muted">Payment:</span>
                <span className="text-cream uppercase">{activeReceipt.provider}</span>
              </div>
              <div className="flex justify-between mb-1.5">
                <span className="text-muted">Ref/UTR:</span>
                <span className="text-cream">{activeReceipt.provider_tx_id || "N/A"}</span>
              </div>
              <hr className="border-dashed border-border/60 my-3" />
              <div className="flex justify-between text-sm font-bold">
                <span className="text-muted">Total Paid:</span>
                <span className="text-lime font-mono">
                  {activeReceipt.currency === "inr" ? `₹${activeReceipt.amount_cents / 100}` : `$${(activeReceipt.amount_cents / 100).toFixed(2)}`}
                </span>
              </div>
              
              <div className="mt-6 flex justify-center">
                <span className="border-4 border-double border-lime/80 bg-lime/10 px-4 py-1 text-base text-lime font-bold uppercase tracking-wider rotate-[-5deg]">
                  PAID
                </span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setActiveReceipt(null)}
                className="flex-1 border-2 border-border py-2 text-xs text-muted hover:border-border-light cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handlePrintReceipt(activeReceipt)}
                className="flex-1 btn-press py-2 text-xs text-bg font-bold cursor-pointer"
                style={{
                  backgroundColor: "#c8e64a",
                  boxShadow: "2px 2px 0 0 #5a7a00",
                }}
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
