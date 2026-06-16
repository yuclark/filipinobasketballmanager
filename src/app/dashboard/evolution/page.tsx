"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/useGameStore";
import {
  getPlayerEvolutionsAction,
  getPlayerCareerOvrHistoryAction,
  getActivePlayersListAction
} from "@/app/actions/evolutionEngine";
import {
  Sparkles,
  TrendingUp,
  Search,
  Loader2,
  ChevronRight,
  Info,
  Calendar,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  User,
  Activity,
  History
} from "lucide-react";

interface EvolutionItem {
  id: string;
  playerId: string;
  seasonYear: number;
  gameDay: number;
  oldOverall: number;
  newOverall: number;
  attributeChangesJson: string;
  createdAt: Date;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  teamId: string | null;
  teamName: string | null;
  teamCity: string | null;
}

interface SearchPlayer {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  overall: number;
  teamId: string | null;
  teamName: string | null;
  teamCity: string | null;
}

interface CareerHistoryItem {
  seasonYear: number;
  gameDay: number;
  newOverall: number;
  oldOverall: number;
  createdAt: Date;
  attributeChangesJson: string;
}

export default function PlayerEvolutionPage() {
  const { userTeamId } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"team" | "player">("team");
  const [error, setError] = useState<string | null>(null);

  // Evolutions lists
  const [teamEvolutions, setTeamEvolutions] = useState<EvolutionItem[]>([]);

  // Player search & career history states
  const [playersList, setPlayersList] = useState<SearchPlayer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<SearchPlayer | null>(null);
  const [careerHistory, setCareerHistory] = useState<CareerHistoryItem[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch initial feeds and player list
  useEffect(() => {
    if (!mounted) return;

    const loadInitialData = async () => {
      try {
        setLoading(true);
        // 1. Fetch user team evolution logs if team exists
        if (userTeamId) {
          const teamRes = await getPlayerEvolutionsAction({ teamId: userTeamId, limit: 30 });
          if (teamRes.success && teamRes.evolutions) {
            setTeamEvolutions(teamRes.evolutions as unknown as EvolutionItem[]);
          }
        }

        // 2. Fetch search directory
        const dirRes = await getActivePlayersListAction();
        if (dirRes.success && dirRes.players) {
          setPlayersList(dirRes.players as SearchPlayer[]);
        }
      } catch (err) {
        console.error("Failed to load evolution feeds:", err);
        setError("Error loading data from the server.");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [mounted, userTeamId]);

  // Load selected player's career history
  useEffect(() => {
    if (!selectedPlayer) {
      setCareerHistory([]);
      return;
    }

    const loadCareerHistory = async () => {
      try {
        setChartLoading(true);
        const res = await getPlayerCareerOvrHistoryAction(selectedPlayer.id);
        if (res.success && res.history) {
          setCareerHistory(res.history as CareerHistoryItem[]);
        }
      } catch (err) {
        console.error("Failed to load player history:", err);
      } finally {
        setChartLoading(false);
      }
    };

    loadCareerHistory();
  }, [selectedPlayer]);

  // Refresh feeds action
  const handleRefreshFeed = async () => {
    try {
      setFeedLoading(true);
      if (userTeamId) {
        const teamRes = await getPlayerEvolutionsAction({ teamId: userTeamId, limit: 30 });
        if (teamRes.success && teamRes.evolutions) {
          setTeamEvolutions(teamRes.evolutions as unknown as EvolutionItem[]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFeedLoading(false);
    }
  };

  // Filter player list based on search query
  const filteredPlayers = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    return playersList
      .filter((p) => {
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        return fullName.includes(query) || p.position.toLowerCase().includes(query);
      })
      .slice(0, 5); // Limit search suggestion list
  }, [searchQuery, playersList]);

  // Helper to parse changes JSON
  const renderAttributeChanges = (jsonStr: string) => {
    try {
      const changes: Record<string, number> = JSON.parse(jsonStr);
      return (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(changes).map(([attr, delta]) => {
            const isPos = delta > 0;
            return (
              <span
                key={attr}
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                  isPos
                    ? "bg-green-500/10 text-green-400 border border-green-500/15"
                    : "bg-red-500/10 text-red-400 border border-red-500/15"
                }`}
              >
                {attr} {isPos ? `+${delta}` : delta}
              </span>
            );
          })}
        </div>
      );
    } catch (e) {
      return null;
    }
  };

  // Custom SVG line chart plotting rating developments chronologically
  const ratingChart = useMemo(() => {
    if (!selectedPlayer || careerHistory.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-500 italic text-sm">
          <History className="w-8 h-8 text-zinc-600 mb-2 animate-pulse" />
          <span>No rating adjustments recorded for this player yet.</span>
          <span className="text-[11px] text-zinc-650 mt-1">
            Progression will log here when in-season days are simulated.
          </span>
        </div>
      );
    }

    // Combine starting OVR and subsequent OVRs chronologically
    const pointsList: { label: string; overall: number }[] = [];
    const firstUpdate = careerHistory[0];
    pointsList.push({
      label: `Start (S${firstUpdate.seasonYear})`,
      overall: firstUpdate.oldOverall,
    });

    careerHistory.forEach((up) => {
      const dayLabel = up.gameDay === 0 ? "Offseason" : `Day ${up.gameDay}`;
      pointsList.push({
        label: `Season ${up.seasonYear} (${dayLabel})`,
        overall: up.newOverall,
      });
    });

    // Chart scale parameters
    const svgWidth = 600;
    const svgHeight = 240;
    const paddingLeft = 40;
    const paddingRight = 30;
    const paddingTop = 30;
    const paddingBottom = 40;

    const chartWidth = svgWidth - paddingLeft - paddingRight;
    const chartHeight = svgHeight - paddingTop - paddingBottom;

    const overalls = pointsList.map((p) => p.overall);
    const minVal = Math.min(...overalls);
    const maxVal = Math.max(...overalls);

    // Dynamic scale limits (give at least a 4-point span for aesthetics)
    const yMin = Math.max(0, Math.min(minVal - 1, maxVal - 3));
    const yMax = Math.min(99, Math.max(maxVal + 1, minVal + 3));
    const yRange = yMax - yMin;

    const getX = (index: number) => {
      if (pointsList.length <= 1) return paddingLeft + chartWidth / 2;
      return paddingLeft + (index / (pointsList.length - 1)) * chartWidth;
    };

    const getY = (val: number) => {
      return paddingTop + chartHeight - ((val - yMin) / yRange) * chartHeight;
    };

    // Construct SVG SVG paths
    let linePath = "";
    let areaPath = `M ${getX(0)} ${getY(yMin)} `;

    pointsList.forEach((pt, idx) => {
      const x = getX(idx);
      const y = getY(pt.overall);
      if (idx === 0) {
        linePath += `M ${x} ${y} `;
      } else {
        linePath += `L ${x} ${y} `;
      }
      areaPath += `L ${x} ${y} `;
    });

    areaPath += `L ${getX(pointsList.length - 1)} ${getY(yMin)} Z`;

    // Generate grid line positions (3 reference points)
    const gridYVals = [
      yMin + 0.1 * yRange,
      yMin + 0.5 * yRange,
      yMin + 0.9 * yRange,
    ].map((v) => Math.round(v));

    return (
      <div className="w-full">
        {/* SVG Drawing Canvas */}
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full min-w-[500px] h-auto select-none"
          >
            {/* Gradients */}
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0.00" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {gridYVals.map((val) => (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={getY(val)}
                  x2={svgWidth - paddingRight}
                  y2={getY(val)}
                  className="stroke-zinc-800/80 stroke-1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 10}
                  y={getY(val) + 4}
                  textAnchor="end"
                  className="text-[10px] font-bold fill-zinc-500 font-mono"
                >
                  {val}
                </text>
              </g>
            ))}

            {/* Area Fill */}
            {pointsList.length > 1 && (
              <path d={areaPath} fill="url(#areaGradient)" />
            )}

            {/* Line Path */}
            {pointsList.length > 1 && (
              <path
                d={linePath}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Node Points */}
            {pointsList.map((pt, idx) => (
              <g key={idx}>
                <circle
                  cx={getX(idx)}
                  cy={getY(pt.overall)}
                  r="5.5"
                  className="fill-orange-500 stroke-zinc-950 stroke-2 cursor-pointer hover:r-7 transition-all duration-150"
                />
                {/* Floating Rating Labels above nodes */}
                <text
                  x={getX(idx)}
                  y={getY(pt.overall) - 10}
                  textAnchor="middle"
                  className="text-xs font-black fill-zinc-100 font-mono"
                >
                  {pt.overall}
                </text>
              </g>
            ))}

            {/* Bottom Timeline Labels */}
            {pointsList.map((pt, idx) => {
              // Rotate slightly if list is long, or only render start/middle/end labels
              const renderLabel =
                pointsList.length <= 4 ||
                idx === 0 ||
                idx === pointsList.length - 1 ||
                idx === Math.floor(pointsList.length / 2);

              if (!renderLabel) return null;

              return (
                <text
                  key={idx}
                  x={getX(idx)}
                  y={svgHeight - 12}
                  textAnchor="middle"
                  className="text-[9px] font-extrabold fill-zinc-400 uppercase tracking-wider"
                >
                  {pt.label}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Career Timeline History Log Table */}
        <div className="mt-8 border border-zinc-900 rounded-2xl overflow-hidden bg-zinc-950/25">
          <div className="bg-zinc-950 px-4 py-3 border-b border-zinc-900 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Progression Log Timeline
            </span>
            <span className="text-[10px] font-semibold text-zinc-500">
              {careerHistory.length} evolutions logged
            </span>
          </div>
          <div className="divide-y divide-zinc-900/60 max-h-60 overflow-y-auto">
            {careerHistory.map((up, idx) => {
              const delta = up.newOverall - up.oldOverall;
              const isProg = delta > 0;
              const dateLabel = up.gameDay === 0 ? "Offseason Development" : `League Day ${up.gameDay}`;

              return (
                <div key={idx} className="p-4 flex items-start justify-between gap-4 hover:bg-zinc-900/10">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      Season {up.seasonYear} · {dateLabel}
                    </span>
                    <span className="text-sm font-bold text-zinc-200 block mt-1">
                      Overall Rating Adjusted: {up.oldOverall} ➜ {up.newOverall}
                    </span>
                    {renderAttributeChanges(up.attributeChangesJson)}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                      delta > 0
                        ? "bg-green-500/10 text-green-400 border-green-500/15"
                        : delta < 0
                        ? "bg-red-500/10 text-red-400 border-red-500/15"
                        : "bg-zinc-500/10 text-zinc-400 border-zinc-500/15"
                    }`}
                  >
                    {delta > 0 ? (
                      <>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>+{delta} OVR</span>
                      </>
                    ) : delta < 0 ? (
                      <>
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        <span>{delta} OVR</span>
                      </>
                    ) : (
                      <>
                        <Activity className="w-3.5 h-3.5 text-zinc-400" />
                        <span>0 OVR</span>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }, [careerHistory, selectedPlayer]);

  const activeEvolutions = teamEvolutions;

  return (
    <div className="flex flex-col gap-8">
      {/* Header and Refresh controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-900/60">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-orange-500 animate-pulse" />
            <span>Player Evolution Dashboard</span>
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Monitor real-time attribute progression, regression, and career timeline logs.
          </p>
        </div>

        <button
          onClick={handleRefreshFeed}
          disabled={feedLoading}
          className="self-start md:self-auto px-4 py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-50 text-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-sm"
        >
          {feedLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
          ) : (
            <Activity className="w-3.5 h-3.5 text-zinc-400" />
          )}
          <span>Refresh Live Feeds</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-950 p-1 rounded-2xl border border-zinc-900 self-start">
        <button
          onClick={() => setActiveTab("team")}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer ${
            activeTab === "team"
              ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          My Team Development
        </button>
        <button
          onClick={() => setActiveTab("player")}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer ${
            activeTab === "player"
              ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Player Career Charts
        </button>
      </div>

      {/* Main Views */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      ) : activeTab === "player" ? (
        /* --- PLAYER CAREER PROFILES VIEW --- */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left panel: Player Lookup Search */}
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-xl backdrop-blur-sm flex flex-col gap-4">
            <h3 className="text-lg font-bold text-white mb-1">Player Directory Lookup</h3>
            <p className="text-zinc-500 text-xs leading-relaxed">
              Search any active athlete across the league roster sheet to track his physical development and career curve.
            </p>

            <div className="relative mt-2">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search athlete by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all"
              />
            </div>

            {/* Suggestions search results */}
            {searchQuery && (
              <div className="border border-zinc-900 bg-zinc-950/80 rounded-2xl overflow-hidden mt-1 max-h-60 overflow-y-auto divide-y divide-zinc-900/70 shadow-lg">
                {filteredPlayers.length > 0 ? (
                  filteredPlayers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPlayer(p);
                        setSearchQuery("");
                      }}
                      className="w-full text-left p-3.5 hover:bg-zinc-900/60 transition-colors flex flex-col cursor-pointer"
                    >
                      <span className="font-bold text-zinc-200 text-sm">
                        {p.firstName} {p.lastName}
                      </span>
                      <span className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider">
                        {p.position} · OVR {p.overall} · {p.teamCity ? `${p.teamCity} ${p.teamName}` : "Free Agent"}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-zinc-650 italic">
                    No active players found.
                  </div>
                )}
              </div>
            )}

            {/* Selected Player Overview Card */}
            {selectedPlayer && (
              <div className="mt-4 p-4 border border-orange-500/10 bg-orange-500/5 rounded-2xl flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-black text-zinc-150">
                    {selectedPlayer.firstName} {selectedPlayer.lastName}
                  </h4>
                  <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest block mt-0.5">
                    {selectedPlayer.position} · OVR {selectedPlayer.overall}
                  </span>
                  <span className="text-xs text-zinc-500 block mt-1">
                    {selectedPlayer.teamCity ? `${selectedPlayer.teamCity} ${selectedPlayer.teamName}` : "Free Agent"}
                  </span>
                </div>
                <Link
                  href={`/dashboard/players/${selectedPlayer.id}`}
                  className="p-2.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-xl transition-all shadow-md"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>

          {/* Right panel: The interactive Line Chart */}
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-xl backdrop-blur-sm lg:col-span-2 flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3.5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                <span>Overall Rating Progression Curve</span>
              </h3>
              {selectedPlayer && (
                <span className="text-xs font-black px-3 py-1 bg-zinc-950 border border-zinc-850 rounded-xl text-zinc-400">
                  {selectedPlayer.firstName[0]}. {selectedPlayer.lastName} (OVR {selectedPlayer.overall})
                </span>
              )}
            </div>

            {chartLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
            ) : (
              ratingChart
            )}
          </div>
        </div>
      ) : (
        /* --- TIMELINE FEEDS --- */
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-900/60 pb-4 mb-6">
            <div>
              <h3 className="text-xl font-bold text-white">
                Franchise Development History
              </h3>
              <p className="text-zinc-500 text-xs mt-0.5">
                Track progressions for athletes assigned to your front-office roster.
              </p>
            </div>
          </div>

          {activeEvolutions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-550 italic text-sm border border-zinc-900 border-dashed rounded-2xl bg-zinc-950/10">
              <Flame className="w-10 h-10 text-zinc-700 mb-2 animate-bounce" />
              <span>No evolutions logged in this directory yet.</span>
              <span className="text-[11px] text-zinc-650 mt-1">
                Advance season days on the schedule page to trigger progression algorithms.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeEvolutions.map((item) => {
                const delta = item.newOverall - item.oldOverall;
                const isProgression = delta > 0;
                const dateString = item.gameDay === 0 ? "Offseason" : `Day ${item.gameDay}`;

                return (
                  <div
                    key={item.id}
                    className="bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 transition-all rounded-2xl p-5 flex flex-col justify-between gap-4 relative overflow-hidden group shadow-sm"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/3 blur-2xl rounded-full pointer-events-none group-hover:bg-orange-500/5 transition-all" />

                    <div>
                      {/* Top timeline label */}
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-900/40">
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Season {item.seasonYear} · {dateString}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                            item.gameDay === 0
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {item.gameDay === 0 ? "Offseason" : "In-Season"}
                        </span>
                      </div>

                      {/* Player Details */}
                      <div className="flex items-center justify-between gap-4 mt-2">
                        <div>
                          <Link
                            href={`/dashboard/players/${item.playerId}`}
                            className="font-bold text-zinc-150 hover:text-orange-400 transition-colors block text-sm"
                          >
                            {item.firstName} {item.lastName}
                          </Link>
                          <span className="text-[10px] text-zinc-550 uppercase tracking-widest font-semibold block mt-0.5">
                            {item.position} · Age {item.age} · {item.teamCity ? `${item.teamCity} ${item.teamName}` : "Free Agent"}
                          </span>
                        </div>

                        {/* Overall rating adjust badges */}
                        <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-900 px-3 py-1 rounded-xl shadow-md">
                          <span className="text-xs text-zinc-400 font-bold font-mono">{item.oldOverall}</span>
                          <span className="text-[10px] text-zinc-600">➜</span>
                          <span className="text-xs text-zinc-100 font-extrabold font-mono">{item.newOverall}</span>
                        </div>
                      </div>

                      {/* Specific Skill Changes */}
                      {renderAttributeChanges(item.attributeChangesJson)}
                    </div>

                    {/* Bottom delta percentage indicators */}
                    <div className="flex items-center justify-between mt-1 pt-2.5 border-t border-zinc-900/40 text-[11px] font-bold">
                      <span className="text-zinc-500">Overall Rating Adjustment</span>
                      <span
                        className={`inline-flex items-center gap-1 ${
                          delta > 0
                            ? "text-green-400"
                            : delta < 0
                            ? "text-red-400"
                            : "text-zinc-400"
                        }`}
                      >
                        {delta > 0 ? (
                          <>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>Progression (+{delta})</span>
                          </>
                        ) : delta < 0 ? (
                          <>
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            <span>Regression ({delta})</span>
                          </>
                        ) : (
                          <>
                            <Activity className="w-3.5 h-3.5 text-zinc-500" />
                            <span>No Net Change (0)</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
