"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { DISTRICT_COLORS, DISTRICT_NAMES, DISTRICT_DESCRIPTIONS } from "@/lib/github";
import { tierFromLevel, rankFromLevel } from "@/lib/xp";

const ACCENT = "#c8e64a";
const SHADOW = "#5a7a00";

interface PlazaDeveloper {
  github_login: string;
  name: string | null;
  avatar_url: string | null;
  contributions: number;
  total_stars: number;
  public_repos: number;
  primary_language: string | null;
  xp_level: number;
  xp_total: number;
}

interface Mission {
  id: string;
  title: string;
  description: string;
  threshold: number;
  progress: number;
  completed: boolean;
}

interface DailiesData {
  missions: Mission[];
  completed_count: number;
  all_completed: boolean;
  reward_claimed: boolean;
  dailies_streak: number;
  dailies_completed: number;
}

export default function DeveloperPlazaPage() {
  const router = useRouter();

  // Plaza Developers state
  const [activeDevs, setActiveDevs] = useState<PlazaDeveloper[]>([]);
  const [topDevs, setTopDevs] = useState<PlazaDeveloper[]>([]);
  const [legendDevs, setLegendDevs] = useState<PlazaDeveloper[]>([]);
  const [langDevs, setLangDevs] = useState<PlazaDeveloper[]>([]);

  // Filtering & Search
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Current User state
  const [currentUserLogin, setCurrentUserLogin] = useState<string | null>(null);
  const [currentUserLanguage, setCurrentUserLanguage] = useState<string | null>(null);

  // Dailies & Rewards state
  const [dailies, setDailies] = useState<DailiesData | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [isClaimingDailies, setIsClaimingDailies] = useState(false);

  // Comparison Form State
  const [compDev1, setCompDev1] = useState("");
  const [compDev2, setCompDev2] = useState("");

  // Live Lobby Counts
  const [totalOnline, setTotalOnline] = useState(0);

  // Fetch Plaza Data
  const fetchPlazaData = useCallback(async () => {
    try {
      const res = await fetch("/api/arcade/plaza");
      if (res.ok) {
        const data = await res.json();
        setActiveDevs(data.active || []);
        setTopDevs(data.topContributors || []);
        setLegendDevs(data.trending || []);
        setLangDevs(data.sameLanguage || []);
        setCurrentUserLogin(data.currentUserLogin);
        setCurrentUserLanguage(data.currentUserLanguage);
        if (data.currentUserLogin) {
          setCompDev1(data.currentUserLogin);
        }
      }
    } catch (e) {
      console.error("Error loading plaza data:", e);
    }
  }, []);

  // Fetch Dailies State
  const fetchDailiesData = useCallback(async () => {
    try {
      const res = await fetch("/api/dailies");
      if (res.ok) {
        const data = await res.json();
        setDailies(data);
      }
    } catch (e) {
      console.error("Error loading dailies data:", e);
    }
  }, []);

  // Check In handler
  const handleCheckin = async () => {
    setIsCheckingIn(true);
    setCheckinMessage(null);
    try {
      const res = await fetch("/api/checkin", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setCheckinMessage(`Check-in successful! Streak: ${data.app_streak} days. +10 XP`);
        fetchDailiesData();
        fetchPlazaData();
      } else {
        setCheckinMessage(data.error || "Failed to check in. Claim your building first!");
      }
    } catch (e) {
      setCheckinMessage("Check-in failed. Try again.");
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Claim Dailies reward handler
  const handleClaimDailies = async () => {
    setIsClaimingDailies(true);
    try {
      const res = await fetch("/api/dailies/claim", { method: "POST" });
      if (res.ok) {
        alert("Daily rewards claimed successfully! You earned XP and Pixels!");
        fetchDailiesData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to claim rewards.");
      }
    } catch (e) {
      alert("Error claiming rewards.");
    } finally {
      setIsClaimingDailies(false);
    }
  };

  useEffect(() => {
    fetchPlazaData();
    fetchDailiesData();

    // Fetch live counts
    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    if (host) {
      const base = host.startsWith("http")
        ? host
        : `${host.includes("localhost") ? "http" : "https"}://${host}`;
      fetch(`${base}/parties/lobby/main/rooms`)
        .then((r) => r.json())
        .then((d: any) => {
          let online = 0;
          for (const r of d.rooms ?? []) {
            online += r.playerCount;
          }
          setTotalOnline(online);
        })
        .catch(() => {});
    }
  }, [fetchPlazaData, fetchDailiesData]);

  // Filters for developers based on selected district or search query
  const filterDevList = (list: PlazaDeveloper[]) => {
    return list.filter((dev) => {
      const matchesSearch =
        dev.github_login.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dev.name ?? "").toLowerCase().includes(searchQuery.toLowerCase());

      if (!selectedDistrict) return matchesSearch;

      // Map language or state to district
      if (selectedDistrict === "frontend" && ["TypeScript", "JavaScript", "Vue", "CSS", "Svelte"].includes(dev.primary_language || "")) {
        return matchesSearch;
      }
      if (selectedDistrict === "backend" && ["Java", "Go", "Rust", "C#", "C++", "Python", "Ruby"].includes(dev.primary_language || "")) {
        return matchesSearch;
      }
      if (selectedDistrict === "data_ai" && ["Python", "Jupyter Notebook", "R"].includes(dev.primary_language || "")) {
        return matchesSearch;
      }
      if (selectedDistrict === "devops" && ["Shell", "HCL", "Dockerfile"].includes(dev.primary_language || "")) {
        return matchesSearch;
      }
      return matchesSearch;
    });
  };

  // Trigger side-by-side compare
  const handleCompare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compDev1 || !compDev2) return;
    router.push(`/?compare=${compDev1.trim()},${compDev2.trim()}`);
  };

  // Helper to get color of district
  const getDistrictColor = (distKey: string) => {
    return DISTRICT_COLORS[distKey] ?? ACCENT;
  };

  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm selection:bg-lime/30 pb-20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Back navigation */}
        <div className="mb-6 flex justify-between items-center">
          <Link href="/" className="text-xs text-muted hover:text-cream transition-colors">
            &larr; Exit to City
          </Link>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-lime animate-pulse" />
            <span className="text-[10px] text-muted normal-case">{totalOnline} Devs in Lobbies</span>
          </div>
        </div>

        {/* Header Hero Section */}
        <div className="border-[3px] border-border bg-bg-raised p-6 mb-8 pixel-shadow relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 pointer-events-none select-none">
            <span className="text-9xl font-bold font-sans">GC</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl text-cream">
                Developer <span style={{ color: ACCENT }}>Plaza</span>
              </h1>
              <p className="mt-2 text-xs text-muted normal-case max-w-xl">
                The central hub of Git City. Meet online developers, compare your stats, complete daily coding challenges, and discover different tech districts.
              </p>
            </div>
            {/* Enter 3D Arcade Card */}
            <div className="shrink-0">
              <Link
                href="/arcade/lobby"
                className="btn-press flex items-center justify-center gap-3 px-6 py-3 border-2 border-lime text-xs text-bg font-bold animate-glow"
                style={{
                  backgroundColor: ACCENT,
                  boxShadow: `4px 4px 0 0 ${SHADOW}`,
                }}
              >
                <span>ENTER 3D MULTIPLAYER LOBBY</span>
                <span className="bg-bg text-lime px-2 py-0.5 text-[8px] rounded">JOIN</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Main Grid: Left Side Dailies & Plaza Cards, Right Side Comparison & District Navigator */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT 2 COLUMNS: Developer Hub */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Daily Rewards & Missions */}
            <div className="border-[3px] border-border bg-bg-card p-6 relative">
              <h2 className="text-sm font-bold text-cream mb-4 flex items-center gap-2">
                <span style={{ color: ACCENT }}>[!]</span> Daily Check-in & Missions
              </h2>

              {/* Checkin button */}
              <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-border/40">
                <button
                  onClick={handleCheckin}
                  disabled={isCheckingIn}
                  className="px-4 py-2 border-2 border-lime text-[10px] text-bg font-bold transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: ACCENT,
                    borderColor: ACCENT,
                    boxShadow: `3px 3px 0 0 ${SHADOW}`,
                  }}
                >
                  {isCheckingIn ? "Checking in..." : "DAILY PRESENCE CHECK-IN"}
                </button>
                {checkinMessage && (
                  <p className="text-[10px] text-cream bg-bg-raised px-3 py-1.5 border border-border normal-case">
                    {checkinMessage}
                  </p>
                )}
              </div>

              {/* Missions list */}
              {dailies ? (
                <div className="space-y-4">
                  <div className="flex justify-between text-[10px] text-muted mb-2">
                    <span>Active Missions ({dailies.completed_count}/3 Completed)</span>
                    <span>Streak: {dailies.dailies_streak} Days</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {dailies.missions.map((m) => (
                      <div key={m.id} className="border border-border/60 bg-bg p-3 flex flex-col justify-between">
                        <div>
                          <p className="text-[9px] font-bold text-cream truncate">{m.title}</p>
                          <p className="text-[7.5px] text-muted normal-case mt-1">{m.description}</p>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-[7px] text-muted mb-1">
                            <span>Progress</span>
                            <span>{m.progress}/{m.threshold}</span>
                          </div>
                          <div className="h-1.5 w-full bg-bg-raised border border-border/50">
                            <div
                              className="h-full"
                              style={{
                                width: `${Math.min(100, (m.progress / m.threshold) * 100)}%`,
                                backgroundColor: m.completed ? ACCENT : "#eab308",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Claim Reward Button */}
                  {dailies.all_completed && !dailies.reward_claimed && (
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={handleClaimDailies}
                        disabled={isClaimingDailies}
                        className="px-4 py-2 border-2 border-yellow-400 bg-yellow-400/20 text-yellow-300 text-[9px] font-bold animate-pulse"
                      >
                        {isClaimingDailies ? "Claiming..." : "CLAIM DAILY CHEST (XP + PIXELS)"}
                      </button>
                    </div>
                  )}
                  {dailies.reward_claimed && (
                    <p className="text-right text-[8px] text-muted mt-2">
                      All rewards claimed for today! Come back tomorrow.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted normal-case">Loading daily mission trackers...</p>
              )}
            </div>

            {/* Developer Plaza Feed / Grid */}
            <div className="space-y-6">
              
              {/* Search and District filters */}
              <div className="border-[3px] border-border bg-bg-raised p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                <input
                  type="text"
                  placeholder="Search plaza developers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full md:max-w-xs px-3 py-1.5 bg-bg border-2 border-border text-[10px] text-cream outline-none focus:border-lime normal-case"
                />
                
                {/* District filters */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedDistrict(null)}
                    className="px-2.5 py-1 text-[8px] border-2 transition-all"
                    style={{
                      borderColor: !selectedDistrict ? ACCENT : "var(--color-border)",
                      color: !selectedDistrict ? ACCENT : "var(--color-muted)",
                      backgroundColor: !selectedDistrict ? "rgba(200, 230, 74, 0.1)" : "transparent",
                    }}
                  >
                    ALL PLAZA
                  </button>
                  {["frontend", "backend", "data_ai", "devops"].map((dist) => (
                    <button
                      key={dist}
                      onClick={() => setSelectedDistrict(selectedDistrict === dist ? null : dist)}
                      className="px-2.5 py-1 text-[8px] border-2 transition-all"
                      style={{
                        borderColor: selectedDistrict === dist ? getDistrictColor(dist) : "var(--color-border)",
                        color: selectedDistrict === dist ? getDistrictColor(dist) : "var(--color-muted)",
                        backgroundColor: selectedDistrict === dist ? `${getDistrictColor(dist)}11` : "transparent",
                      }}
                    >
                      {DISTRICT_NAMES[dist]?.toUpperCase() || dist}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Active Devs */}
                <div className="border border-border/80 bg-bg-card p-4">
                  <h3 className="text-xs font-bold text-cream mb-3 flex items-center justify-between">
                    <span>Recently Active</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-lime animate-ping" />
                  </h3>
                  <div className="space-y-2">
                    {filterDevList(activeDevs).slice(0, 5).map((dev) => (
                      <DevPlazaCard key={dev.github_login} dev={dev} onCompare={() => setCompDev2(dev.github_login)} />
                    ))}
                    {filterDevList(activeDevs).length === 0 && (
                      <p className="text-[10px] text-muted py-4 text-center">No matching developers.</p>
                    )}
                  </div>
                </div>

                {/* Top Contributors */}
                <div className="border border-border/80 bg-bg-card p-4">
                  <h3 className="text-xs font-bold text-cream mb-3">Top Contributors</h3>
                  <div className="space-y-2">
                    {filterDevList(topDevs).slice(0, 5).map((dev) => (
                      <DevPlazaCard key={dev.github_login} dev={dev} onCompare={() => setCompDev2(dev.github_login)} />
                    ))}
                    {filterDevList(topDevs).length === 0 && (
                      <p className="text-[10px] text-muted py-4 text-center">No matching developers.</p>
                    )}
                  </div>
                </div>

                {/* Open Source Legends */}
                <div className="border border-border/80 bg-bg-card p-4">
                  <h3 className="text-xs font-bold text-cream mb-3">Open Source Legends</h3>
                  <div className="space-y-2">
                    {filterDevList(legendDevs).slice(0, 5).map((dev) => (
                      <DevPlazaCard key={dev.github_login} dev={dev} onCompare={() => setCompDev2(dev.github_login)} />
                    ))}
                    {filterDevList(legendDevs).length === 0 && (
                      <p className="text-[10px] text-muted py-4 text-center">No matching developers.</p>
                    )}
                  </div>
                </div>

                {/* Same language match */}
                <div className="border border-border/80 bg-bg-card p-4">
                  <h3 className="text-xs font-bold text-cream mb-3">
                    {currentUserLanguage ? `${currentUserLanguage} Developers` : "Recommended Profiles"}
                  </h3>
                  <div className="space-y-2">
                    {filterDevList(langDevs).slice(0, 5).map((dev) => (
                      <DevPlazaCard key={dev.github_login} dev={dev} onCompare={() => setCompDev2(dev.github_login)} />
                    ))}
                    {filterDevList(langDevs).length === 0 && (
                      <p className="text-[10px] text-muted py-4 text-center">No matching developers.</p>
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* RIGHT COLUMN: Comparison Tool & District Hubs */}
          <div className="space-y-8">
            
            {/* Side-by-side Comparison form */}
            <div className="border-[3px] border-border bg-bg-card p-6">
              <h2 className="text-sm font-bold text-cream mb-3 flex items-center gap-2">
                <span style={{ color: ACCENT }}>#</span> Developer Comparison
              </h2>
              <p className="text-[9px] text-muted normal-case mb-4">
                Compare stats side-by-side. Enter two logins to generate a visual comparison in the 3D City.
              </p>
              
              <form onSubmit={handleCompare} className="space-y-4">
                <div>
                  <label className="block text-[8px] text-muted mb-1">Developer 1</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HKaurani_01"
                    value={compDev1}
                    onChange={(e) => setCompDev1(e.target.value)}
                    className="w-full px-3 py-2 bg-bg border border-border text-[10px] text-cream outline-none focus:border-lime normal-case"
                  />
                </div>
                <div>
                  <label className="block text-[8px] text-muted mb-1">Developer 2</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. login"
                    value={compDev2}
                    onChange={(e) => setCompDev2(e.target.value)}
                    className="w-full px-3 py-2 bg-bg border border-border text-[10px] text-cream outline-none focus:border-lime normal-case"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 border-2 border-lime text-[9px] text-bg font-bold"
                  style={{
                    backgroundColor: ACCENT,
                    boxShadow: `3px 3px 0 0 ${SHADOW}`,
                  }}
                >
                  LAUNCH 3D VERSUS BATTLE
                </button>
              </form>
            </div>

            {/* Tech Districts Directory */}
            <div className="border-[3px] border-border bg-bg-card p-6">
              <h2 className="text-sm font-bold text-cream mb-4">Tech Districts</h2>
              <div className="space-y-4">
                {["frontend", "backend", "data_ai", "devops"].map((distKey) => {
                  const color = getDistrictColor(distKey);
                  return (
                    <div
                      key={distKey}
                      onClick={() => setSelectedDistrict(selectedDistrict === distKey ? null : distKey)}
                      className="border border-border/40 p-3 bg-bg hover:border-border-light transition-all cursor-pointer relative overflow-hidden"
                    >
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1"
                        style={{ backgroundColor: color }}
                      />
                      <div className="pl-2">
                        <p className="text-[10px] font-bold text-cream flex justify-between items-center">
                          <span>{DISTRICT_NAMES[distKey]}</span>
                          <span className="text-[8px]" style={{ color }}>DETAILS</span>
                        </p>
                        <p className="text-[8.5px] text-muted normal-case mt-1">
                          {DISTRICT_DESCRIPTIONS[distKey]}
                        </p>
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

// Sub-Component: Developer Plaza Card
function DevPlazaCard({ dev, onCompare }: { dev: PlazaDeveloper; onCompare: () => void }) {
  const tier = tierFromLevel(dev.xp_level ?? 1);
  const langColor = dev.primary_language ? DISTRICT_COLORS[dev.primary_language.toLowerCase()] ?? ACCENT : ACCENT;

  return (
    <div className="flex items-center justify-between border border-border/50 p-2.5 bg-bg hover:bg-bg-raised transition-all">
      <div className="flex items-center gap-3 min-w-0">
        {dev.avatar_url && (
          <Image
            src={dev.avatar_url}
            alt={dev.github_login}
            width={32}
            height={32}
            className="border border-border"
            style={{ imageRendering: "pixelated" }}
          />
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-cream truncate">
            {dev.name ?? dev.github_login}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[7px] text-muted truncate">@{dev.github_login}</span>
            <span
              className="text-[7px] font-bold px-1"
              style={{ backgroundColor: tier.color + "22", color: tier.color }}
            >
              LV {dev.xp_level}
            </span>
            {dev.primary_language && (
              <span className="text-[7px]" style={{ color: langColor }}>
                {dev.primary_language}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1.5 ml-2">
        <button
          onClick={onCompare}
          title="Compare Stats"
          className="px-2 py-1 border border-border text-[8px] text-muted hover:border-lime hover:text-lime transition-all"
        >
          COMP
        </button>
        <Link
          href={`/?user=${dev.github_login}`}
          className="px-2 py-1 border border-border text-[8px] text-cream hover:bg-lime hover:text-bg hover:border-lime transition-all"
        >
          VISIT
        </Link>
      </div>
    </div>
  );
}
