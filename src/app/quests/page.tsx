"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

const ACCENT = "#c8e64a";
const SHADOW = "#5a7a00";

interface Quest {
  quest_id: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
  quests: {
    title: string;
    description: string;
    threshold: number;
    reward_pixels: number;
    reward_xp: number;
  };
}

interface Streak {
  current_streak: number;
  longest_streak: number;
  claimed_today: boolean;
}

interface CrateInstance {
  id: string;
  crate_id: string;
  crates: {
    name: string;
    rarity: string;
  };
}

interface Customization {
  id: string;
  type: string;
  value: string;
  active: boolean;
}

export default function QuestsDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [crates, setCrates] = useState<CrateInstance[]>([]);
  const [customizations, setCustomizations] = useState<Customization[]>([]);
  const [balance, setBalance] = useState(0);
  const [authError, setAuthError] = useState<"not_authenticated" | "not_claimed" | null>(null);

  // Time remaining to reset
  const [resetTimeLeft, setResetTimeLeft] = useState("");

  // UI States
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState(false);
  const [isClaimingQuestId, setIsClaimingQuestId] = useState<string | null>(null);
  const [isOpeningCrateId, setIsOpeningCrateId] = useState<string | null>(null);
  const [openedReward, setOpenedReward] = useState<{ type: string; value: string } | null>(null);
  const [buyingCosmeticId, setBuyingCosmeticId] = useState<string | null>(null);
  const [togglingCosmeticId, setTogglingCosmeticId] = useState<string | null>(null);

  // Fetch Dashboard State
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/quests");
      if (res.ok) {
        const data = await res.json();
        setQuests(data.quests || []);
        setStreak(data.streak || null);
        setCrates(data.crates || []);
        setCustomizations(data.customizations || []);
        setBalance(data.balance || 0);
        setAuthError(null);
      } else if (res.status === 401) {
        setAuthError("not_authenticated");
      } else if (res.status === 403) {
        setAuthError("not_claimed");
      }
    } catch (e) {
      console.error("Error fetching quest data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update Countdown Timer
  useEffect(() => {
    fetchState();

    const interval = setInterval(() => {
      const now = new Date();
      const nextDay = new Date();
      nextDay.setUTCHours(24, 0, 0, 0);
      const diffMs = nextDay.getTime() - now.getTime();

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      setResetTimeLeft(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchState]);

  // Handle checkin
  const handleCheckin = async () => {
    setIsSubmittingCheckin(true);
    try {
      const res = await fetch("/api/quests/checkin", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert(`Logged in! Day ${data.streak.current_streak} streak! Received: +${data.rewards.pixels} PX, +${data.rewards.xp} XP`);
        fetchState();
      } else {
        alert(data.error || "Failed to check in.");
      }
    } catch {
      alert("Error checking in.");
    } finally {
      setIsSubmittingCheckin(false);
    }
  };

  // Handle claim quest
  const handleClaimQuest = async (questId: string) => {
    setIsClaimingQuestId(questId);
    try {
      const res = await fetch("/api/quests/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Quest claimed! +${data.rewards.pixels} Pixels, +${data.rewards.xp} XP!`);
        fetchState();
      } else {
        alert(data.error || "Failed to claim reward.");
      }
    } catch {
      alert("Error claiming reward.");
    } finally {
      setIsClaimingQuestId(null);
    }
  };

  // Handle open crate
  const handleOpenCrate = async (crateInstanceId: string) => {
    setIsOpeningCrateId(crateInstanceId);
    setOpenedReward(null);
    try {
      const res = await fetch("/api/crates/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crateInstanceId }),
      });
      const data = await res.json();
      if (res.ok) {
        setOpenedReward(data.reward);
        fetchState();
      } else {
        alert(data.error || "Failed to open crate.");
      }
    } catch {
      alert("Error opening crate.");
    } finally {
      setIsOpeningCrateId(null);
    }
  };

  // Handle buy cosmetic
  const handleBuyCosmetic = async (itemId: string) => {
    setBuyingCosmeticId(itemId);
    try {
      const res = await fetch("/api/customizations/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Purchased cosmetic successfully!`);
        fetchState();
      } else {
        alert(data.error || "Purchase failed.");
      }
    } catch {
      alert("Error purchasing cosmetic.");
    } finally {
      setBuyingCosmeticId(null);
    }
  };

  // Handle toggle cosmetic
  const handleToggleCosmetic = async (customizationId: string) => {
    setTogglingCosmeticId(customizationId);
    try {
      const res = await fetch("/api/customizations/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customizationId }),
      });
      if (res.ok) {
        fetchState();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to toggle item.");
      }
    } catch {
      alert("Error toggling item.");
    } finally {
      setTogglingCosmeticId(null);
    }
  };

  // Helper to generate a text progress bar: [█████░░░░░]
  const renderProgressBar = (progress: number, threshold: number) => {
    const totalBars = 10;
    const filledBars = Math.round((progress / threshold) * totalBars);
    const emptyBars = totalBars - filledBars;
    return `[${"█".repeat(filledBars)}${"░".repeat(emptyBars)}]`;
  };

  // Check if item is already owned
  const isCosmeticOwned = (itemId: string) => {
    return customizations.some((c) => c.value === itemId);
  };

  const getCustomizationByValue = (itemId: string) => {
    return customizations.find((c) => c.value === itemId);
  };

  const COSMETICS_LIST = [
    { id: "cyberpunk", type: "building_theme", price: 500, name: "Cyberpunk Theme", desc: "Pixel neon cyan and magenta overlay" },
    { id: "steampunk", type: "building_theme", price: 500, name: "Steampunk Theme", desc: "Copper, brass and gears overlay" },
    { id: "obsidian", type: "building_theme", price: 1000, name: "Obsidian Theme", desc: "Dark basalt with neon red lining" },
    { id: "crystal", type: "building_theme", price: 750, name: "Crystal Theme", desc: "Shimmering geometric crystal nodes" },
    { id: "ghost_glow", type: "glow_effect", price: 400, name: "Ghost Glow", desc: "Eerie white trail particles" },
    { id: "fire_trail", type: "glow_effect", price: 400, name: "Fire Trail", desc: "Volcanic spark trail particles" },
    { id: "rainbow_matrix", type: "glow_effect", price: 600, name: "Rainbow Matrix", desc: "Prismatic color-cycling matrix streams" },
    { id: "neon_border", type: "profile_frame", price: 200, name: "Neon Frame", desc: "Vibrant profile frame outline" },
    { id: "matrix_rain", type: "profile_frame", price: 200, name: "Matrix Rain Frame", desc: "Falling matrix digital code streams" },
    { id: "legend_shield", type: "profile_frame", price: 300, name: "Legend Shield", desc: "Ornate gold shields in profile UI" },
    { id: "citadel_lord", type: "special_title", price: 150, name: "Citadel Lord", desc: "Exclusive profile title badge" },
    { id: "code_wizard", type: "special_title", price: 150, name: "Code Wizard", desc: "Exclusive profile title badge" },
    { id: "star_catcher", type: "special_title", price: 150, name: "Star Catcher", desc: "Exclusive profile title badge" },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-bg flex items-center justify-center font-pixel uppercase text-muted">
        <div>Loading dashboard<span className="blink-dot">.</span><span className="blink-dot">.</span><span className="blink-dot">.</span></div>
      </main>
    );
  }

  if (authError === "not_authenticated") {
    return (
      <main className="min-h-screen bg-bg font-pixel uppercase text-warm flex flex-col items-center justify-center p-6 pb-20">
        <div className="max-w-md w-full border-[3px] border-border bg-bg-raised p-8 text-center pixel-shadow">
          <h1 className="text-xl text-cream mb-4">Guest Access Denied</h1>
          <p className="text-[10px] text-muted normal-case leading-relaxed mb-6">
            Sign in with your GitHub account to connect to the Metropolis network, unlock daily quest boards, streak multipliers, and buy customizations.
          </p>
          <Link
            href="/auth?redirect=/quests"
            className="inline-block px-8 py-3 text-sm text-bg font-bold border-2 transition-all hover:translate-y-[-2px]"
            style={{
              backgroundColor: ACCENT,
              borderColor: ACCENT,
              boxShadow: `4px 4px 0 0 ${SHADOW}`,
            }}
          >
            Sign In with GitHub
          </Link>
          <div className="mt-6">
            <Link href="/" className="text-[10px] text-muted underline hover:text-cream">
              Back to City
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (authError === "not_claimed") {
    return (
      <main className="min-h-screen bg-bg font-pixel uppercase text-warm flex flex-col items-center justify-center p-6 pb-20">
        <div className="max-w-md w-full border-[3px] border-border bg-bg-raised p-8 text-center pixel-shadow">
          <h1 className="text-xl text-cream mb-4">Metropolis Claim Required</h1>
          <p className="text-[10px] text-muted normal-case leading-relaxed mb-6">
            You have authenticated, but you must claim your developer building in the Git City grid before you can access quests and cosmetic shop features.
          </p>
          <Link
            href="/"
            className="inline-block px-8 py-3 text-sm text-bg font-bold border-2 transition-all hover:translate-y-[-2px]"
            style={{
              backgroundColor: ACCENT,
              borderColor: ACCENT,
              boxShadow: `4px 4px 0 0 ${SHADOW}`,
            }}
          >
            Find & Claim Building
          </Link>
          <div className="mt-6">
            <Link href="/" className="text-[10px] text-muted underline hover:text-cream">
              Back to City
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm selection:bg-lime/30 pb-20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Navigation header */}
        <div className="mb-6 flex justify-between items-center">
          <Link href="/" className="text-xs text-muted hover:text-cream transition-colors">
            &larr; Return to Metropolis
          </Link>
          <div className="border border-border/80 px-3 py-1 bg-bg-raised text-[10px] flex items-center gap-2">
            <span>MY WALLET:</span>
            <span style={{ color: ACCENT }}>{balance} PX</span>
          </div>
        </div>

        {/* Dashboard Title Hero */}
        <div className="border-[3px] border-border bg-bg-raised p-6 mb-8 pixel-shadow relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl text-cream">Quests & Rewards Panel</h1>
              <p className="mt-1 text-[10px] text-muted normal-case">
                Challenge yourself daily. Complete active quests to earn Pixels currency, XP levels, and cosmetic crates.
              </p>
            </div>
            {/* Reset countdown */}
            <div className="text-right shrink-0">
              <span className="text-[9px] text-dim block">QUESTS RESET IN</span>
              <span className="text-lg font-bold font-sans tracking-widest" style={{ color: ACCENT }}>
                {resetTimeLeft || "00:00:00"}
              </span>
            </div>
          </div>
        </div>

        {/* Main Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Streak + Crates */}
          <div className="space-y-8">
            
            {/* Daily Login Streak Card */}
            <div className="border-[3px] border-border bg-bg-card p-5">
              <h2 className="text-xs font-bold text-cream mb-4 flex items-center justify-between">
                <span>Consec. Login Streak</span>
                {streak && (
                  <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[8px] animate-pulse">
                    {streak.current_streak} DAYS
                  </span>
                )}
              </h2>

              {/* Streak animation flame */}
              <div className="flex flex-col items-center justify-center py-6 border border-border/40 bg-bg mb-4">
                <span className="text-4xl animate-bounce">🔥</span>
                <span className="text-[10px] text-muted mt-2">STREAK MULTIPLIER ACTIVE</span>
              </div>

              {/* Reward Track Progression indicator */}
              <div className="space-y-3 mb-6">
                <p className="text-[8px] text-dim">STREAK REWARDS TRACK:</p>
                <div className="grid grid-cols-5 gap-1 text-[8.5px] text-center">
                  {[1, 2, 3, 7, 30].map((day) => {
                    const isPassed = streak ? streak.current_streak >= day : false;
                    return (
                      <div
                        key={day}
                        className={`border p-1.5 flex flex-col justify-between ${
                          isPassed ? "border-lime bg-lime/10 text-lime" : "border-border/50 text-muted"
                        }`}
                      >
                        <span className="block font-bold">D{day}</span>
                        <span className="block text-[6.5px] truncate mt-1">
                          {day === 1 ? "10PX" : day === 2 ? "20PX" : day === 3 ? "50PX" : day === 7 ? "RARE" : "LEGEND"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleCheckin}
                disabled={isSubmittingCheckin || (streak?.claimed_today ?? false)}
                className="w-full py-2.5 border-2 text-[9px] font-bold transition-all"
                style={{
                  backgroundColor: streak?.claimed_today ? "transparent" : ACCENT,
                  borderColor: streak?.claimed_today ? "var(--color-border)" : ACCENT,
                  color: streak?.claimed_today ? "var(--color-muted)" : "var(--color-bg)",
                  boxShadow: streak?.claimed_today ? "none" : `3px 3px 0 0 ${SHADOW}`,
                }}
              >
                {isSubmittingCheckin
                  ? "CLAIMING..."
                  : streak?.claimed_today
                  ? "STREAK CLAIMED TODAY"
                  : "CLAIM TODAY'S STREAK REWARD"}
              </button>
            </div>

            {/* Owned Crates & Opener */}
            <div className="border-[3px] border-border bg-bg-card p-5">
              <h2 className="text-xs font-bold text-cream mb-4">Cosmetic Loot Crates ({crates.length})</h2>

              {openedReward && (
                <div className="border border-lime/50 bg-lime/5 p-3 mb-4 text-center">
                  <p className="text-[8px] text-lime font-bold">CRATE OPENED SUCCESSFULLY!</p>
                  <p className="text-[11px] text-cream mt-1 font-sans">{openedReward.value.toUpperCase()}</p>
                  <p className="text-[7.5px] text-muted normal-case mt-0.5">({openedReward.type}) added to customization inventory</p>
                  <button
                    onClick={() => setOpenedReward(null)}
                    className="mt-2 text-[8px] text-muted underline hover:text-cream"
                  >
                    DISMISS
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {crates.map((crate) => (
                  <div key={crate.id} className="border border-border/60 p-3 bg-bg flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-bold text-cream truncate">{crate.crates.name}</p>
                      <p className="text-[7.5px] text-muted tracking-wider mt-0.5">RARITY: {crate.crates.rarity.toUpperCase()}</p>
                    </div>
                    <button
                      onClick={() => handleOpenCrate(crate.id)}
                      disabled={isOpeningCrateId !== null}
                      className="px-3 py-1.5 border border-lime text-[8px] text-lime hover:bg-lime hover:text-bg transition-all"
                    >
                      {isOpeningCrateId === crate.id ? "OPENING..." : "OPEN CRATE"}
                    </button>
                  </div>
                ))}
                {crates.length === 0 && (
                  <p className="text-[9px] text-muted text-center py-6">No crates owned. Complete quests or buy from the shop below!</p>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT 2 COLUMNS: Quests & Shop */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Daily Quests Feed */}
            <div className="border-[3px] border-border bg-bg-card p-6">
              <h2 className="text-xs font-bold text-cream mb-4">Daily Quests</h2>
              <div className="space-y-4">
                {quests.map((q) => {
                  const percent = Math.min(100, (q.progress / q.quests.threshold) * 100);
                  return (
                    <div key={q.quest_id} className="border border-border p-4 bg-bg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold text-cream">{q.quests.title}</p>
                          {q.completed && (
                            <span className="px-1.5 py-0.5 bg-lime/10 text-lime text-[7px] font-bold">COMPLETED</span>
                          )}
                        </div>
                        <p className="text-[8.5px] text-muted normal-case mt-1">{q.quests.description}</p>
                        
                        {/* Custom visual progress bar: [██████░░░░] */}
                        <div className="mt-3 font-mono text-[9px] tracking-wider text-muted flex flex-wrap items-center gap-2">
                          <span>{renderProgressBar(q.progress, q.quests.threshold)}</span>
                          <span>{q.progress} / {q.quests.threshold}</span>
                        </div>
                      </div>

                      {/* Reward preview & action */}
                      <div className="shrink-0 flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-border/40">
                        <div className="text-right">
                          <span className="text-[7.5px] text-muted block">REWARD</span>
                          <span className="text-[9px] font-bold text-yellow-300">+{q.quests.reward_pixels} PX</span>
                        </div>
                        <button
                          onClick={() => handleClaimQuest(q.quest_id)}
                          disabled={!q.completed || q.claimed || isClaimingQuestId === q.quest_id}
                          className="px-4 py-2 border text-[8.5px] font-bold transition-all"
                          style={{
                            borderColor: q.claimed ? "var(--color-border)" : q.completed ? "var(--color-accent)" : "var(--color-border)",
                            color: q.claimed ? "var(--color-muted)" : q.completed ? "var(--color-accent)" : "var(--color-muted)",
                            backgroundColor: q.completed && !q.claimed ? "rgba(200, 230, 74, 0.1)" : "transparent",
                          }}
                        >
                          {q.claimed ? "CLAIMED" : isClaimingQuestId === q.quest_id ? "CLAIMING..." : "CLAIM REWARD"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {quests.length === 0 && (
                  <p className="text-xs text-muted text-center py-8">Generating today's quest challenges...</p>
                )}
              </div>
            </div>

            {/* Customization Cosmetics Shop */}
            <div className="border-[3px] border-border bg-bg-card p-6">
              <h2 className="text-xs font-bold text-cream mb-4">Cosmetics & Customization Shop</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {COSMETICS_LIST.map((item) => {
                  const isOwned = isCosmeticOwned(item.id);
                  const custObj = getCustomizationByValue(item.id);
                  const isActive = custObj ? custObj.active : false;

                  return (
                    <div key={item.id} className="border border-border/50 p-3 bg-bg flex flex-col justify-between hover:border-border transition-all">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-[9.5px] font-bold text-cream truncate">{item.name}</p>
                          <span className="text-[7px] text-muted tracking-wider">{item.type.replace("_", " ").toUpperCase()}</span>
                        </div>
                        <p className="text-[8px] text-muted normal-case mt-1">{item.desc}</p>
                      </div>

                      {/* Buy or Equip actions */}
                      <div className="mt-4 pt-2 border-t border-border/40 flex items-center justify-between">
                        {isOwned ? (
                          <>
                            <span className="text-[8px] text-lime">OWNED</span>
                            <button
                              onClick={() => handleToggleCosmetic(custObj!.id)}
                              disabled={togglingCosmeticId === custObj!.id}
                              className={`px-3 py-1 border text-[8px] font-bold transition-all ${
                                isActive
                                  ? "border-yellow-400 text-yellow-300 bg-yellow-400/10"
                                  : "border-border text-cream hover:border-lime hover:text-lime"
                              }`}
                            >
                              {togglingCosmeticId === custObj!.id ? "TOGGLING..." : isActive ? "ACTIVE" : "EQUIP"}
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-[9px] font-bold text-yellow-400">{item.price} PX</span>
                            <button
                              onClick={() => handleBuyCosmetic(item.id)}
                              disabled={balance < item.price || buyingCosmeticId === item.id}
                              className="px-3 py-1 border border-lime text-[8px] text-lime hover:bg-lime hover:text-bg transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-lime"
                            >
                              {buyingCosmeticId === item.id ? "BUYING..." : "BUY"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

      </div>
    </main>
  );
}
