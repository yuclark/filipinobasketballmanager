"use client";

import { useEffect, useState } from "react";
import { getLeagueLeadersAction, LeaderCategory } from "@/app/actions/leadersEngine";
import { useGameStore } from "@/store/useGameStore";
import { BarChart2, Loader2, Award, Sparkles } from "lucide-react";
import React from "react";

const CAT_COLORS: Record<string, { text: string; bg: string; border: string; bar: string }> = {
  PPG: { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", bar: "bg-orange-500" },
  RPG: { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", bar: "bg-purple-500" },
  APG: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", bar: "bg-blue-500" },
  SPG: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", bar: "bg-emerald-500" },
  BPG: { text: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20", bar: "bg-pink-500" },
  "FG%": { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", bar: "bg-amber-500" },
  "3P%": { text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", bar: "bg-sky-500" },
};

export default function LeadersPage() {
  const { userTeamId } = useGameStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seasonYear, setSeasonYear] = useState(0);
  const [categories, setCategories] = useState<LeaderCategory[]>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await getLeagueLeadersAction();
        if (res.success) {
          setSeasonYear(res.seasonYear);
          setCategories(res.categories);
          setPlayerCount(res.playerCount);
        } else {
          setError(res.error ?? "Failed to load leaders.");
        }
      } catch (err: any) {
        setError(err.message ?? "Unexpected error.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [mounted]);

  const fmt = (v: number, format: "decimal" | "pct") =>
    format === "pct" ? `${Math.round(v)}%` : v.toFixed(1);

  const getRankBadgeClass = (rank: number) => {
    if (rank === 1) return "bg-amber-500/20 text-amber-400 border border-amber-500/30 font-extrabold";
    if (rank === 2) return "bg-zinc-400/20 text-zinc-300 border border-zinc-400/30 font-extrabold";
    if (rank === 3) return "bg-orange-500/15 text-orange-400 border border-orange-500/25 font-bold";
    return "bg-zinc-950 text-zinc-500 border border-zinc-905/80";
  };

  if (!mounted || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-zinc-500 text-sm font-semibold">Loading league leaders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p className="mb-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-orange-500/10 rounded-2xl text-orange-500">
            <BarChart2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">League Leaders</h3>
            <p className="text-zinc-500 text-sm font-semibold tracking-wide">
              {seasonYear > 0 ? `Season ${seasonYear} · ` : ""}Regular Season Leaderboards · {playerCount} Qualified Players (min. 10 GP)
            </p>
          </div>
        </div>
      </div>

      {categories.length === 0 || categories.every((c) => c.leaders.length === 0) ? (
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-900 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-2xl">
          <BarChart2 className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h4 className="text-lg font-bold text-zinc-200">No Stats Available Yet</h4>
          <p className="text-zinc-500 text-xs mt-2 max-w-xs mx-auto">
            Simulate and complete at least 10 games of the regular season calendar to populate the stats leaderboards.
          </p>
        </div>
      ) : (
        /* Grid cards category view */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => {
            const config = CAT_COLORS[cat.key] || {
              text: "text-orange-400",
              bg: "bg-orange-500/10",
              border: "border-orange-500/20",
              bar: "bg-orange-500",
            };
            
            // Determine top value for scaling progress bar
            const topVal = cat.leaders.length > 0 ? cat.leaders[0].value : 1;

            return (
              <div key={cat.key} className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700/80 rounded-2xl overflow-hidden transition-all shadow-md relative group">
                
                {/* Category Header */}
                <div className="flex items-center justify-between p-4 bg-zinc-950/40 border-b border-zinc-900/60">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.emoji}</span>
                    <h4 className="font-extrabold text-white text-sm uppercase tracking-wider">
                      {cat.label}
                    </h4>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${config.bg} ${config.text} ${config.border}`}>
                    {cat.key}
                  </span>
                </div>

                {/* Leaders List */}
                <div className="p-4 space-y-4">
                  {cat.leaders.length === 0 ? (
                    <p className="text-zinc-600 text-xs py-4 text-center">Not enough data yet</p>
                  ) : (
                    cat.leaders.map((entry) => {
                      const isMyTeam = entry.teamId === userTeamId;
                      const pct = topVal > 0 ? (entry.value / topVal) * 100 : 0;

                      return (
                        <div key={entry.playerId} className="relative space-y-1.5 group/item">
                          
                          {/* Entry Top Row (Rank, Name, Team, Value) */}
                          <div className="flex items-center justify-between gap-3 relative z-10">
                            
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Ranks number badge */}
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0 ${getRankBadgeClass(entry.rank)}`}>
                                {entry.rank}
                              </span>
                              
                              <div className="min-w-0 leading-tight">
                                <span className="font-bold text-xs text-zinc-100 block truncate hover:text-white">
                                  {entry.playerName}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-semibold block truncate">
                                  {entry.teamName}
                                </span>
                              </div>
                              
                              {isMyTeam && (
                                <span className="inline-flex px-1.5 py-0.2 rounded bg-orange-500/10 border border-orange-500/20 text-[8px] text-orange-400 font-extrabold uppercase shrink-0">
                                  My Team
                                </span>
                              )}
                            </div>

                            <span className={`font-black text-sm text-right ${config.text}`}>
                              {fmt(entry.value, cat.format)}
                            </span>

                          </div>

                          {/* Progress Meter bar */}
                          <div className="pl-8.5">
                            <div className="bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-900/60">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${config.bar}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          {/* Highlight strip for user's team */}
                          {isMyTeam && (
                            <div className="absolute -inset-x-2 -inset-y-1 bg-orange-500/[0.015] border-l border-orange-500/30 pointer-events-none rounded-r-lg" />
                          )}

                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
