"use client";

import { useEffect, useState } from "react";
import { getLeagueHistoryAction } from "@/app/actions/awardsEngine";
import { BookOpen, Trophy, Loader2, Star, Shield, Award, Calendar } from "lucide-react";
import React from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type SeasonData = {
  year: number;
  champion: {
    championTeam: string;
    runnerUpTeam: string;
    finalsMvp: string;
    finalsMvpTeam: string;
    seriesScore: string;
  } | null;
  awards: { type: string; playerName: string; teamName: string; position: string }[];
  allLeagueTeams: { type: string; members: { position: string; playerName: string }[] }[];
};

const AWARD_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  MVP:     { label: "Most Valuable Player",     bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  ROY:     { label: "Rookie of the Year",       bg: "bg-cyan-500/10",  text: "text-cyan-400",  border: "border-cyan-500/20" },
  DPOY:    { label: "Defensive Player of Year", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  "6MOTY": { label: "Sixth Man of the Year",    bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
};

const TIER_COLORS: Record<string, string> = {
  "All-League 1st":  "text-amber-400",
  "All-League 2nd":  "text-zinc-400",
  "All-League 3rd":  "text-orange-400/80",
  "All-Defensive":   "text-emerald-400",
};

export default function HistoryPage() {
  const [seasons, setSeasons] = useState<SeasonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result = await getLeagueHistoryAction();
        if (result.success) {
          setSeasons(result.seasons as SeasonData[]);
        } else {
          setError(result.error || "Failed to load league history.");
        }
      } catch (err: any) {
        setError(err.message || "Unexpected error.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-zinc-500 text-sm font-semibold">Loading league archive...</p>
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
    <div className="space-y-8">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-orange-500/10 rounded-2xl text-orange-500">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">League History Hub</h3>
            <p className="text-zinc-500 text-sm font-semibold tracking-wide">
              Historical archive of FBM Philippine Champions, Individual Trophy Winners, and All-League honorees
            </p>
          </div>
        </div>
      </div>

      {seasons.length === 0 ? (
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-900 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-2xl">
          <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h4 className="text-lg font-bold text-zinc-200">No History Recorded Yet</h4>
          <p className="text-zinc-500 text-xs mt-2 max-w-xs mx-auto">
            Complete the postseason tournament and crown a champion to begin populating the league history archive.
          </p>
        </div>
      ) : (
        <div className="space-y-10 max-w-6xl mx-auto">
          {seasons.map((season) => (
            <div key={season.year} className="bg-zinc-900/30 border border-zinc-900 hover:border-zinc-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-sm">
              
              {/* Season Banner Header */}
              <div className="flex items-center justify-between border-b border-zinc-900/80 pb-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-5 h-5 text-orange-500" />
                  <h4 className="text-xl font-black text-white uppercase tracking-wider">
                    Season {season.year}
                  </h4>
                </div>
                <span className="px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/25 rounded-xl text-xs font-bold uppercase tracking-wider">
                  Postseason Completed
                </span>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Championship Card */}
                <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-500 block mb-2">
                      🏆 FBM Philippine Champion
                    </span>
                    {season.champion ? (
                      <div className="space-y-4">
                        <div>
                          <h2 className="text-2xl font-black text-white leading-tight">
                            {season.champion.championTeam}
                          </h2>
                          <p className="text-xs font-semibold text-zinc-400 mt-1">
                            Defeated <span className="text-zinc-200 font-bold">{season.champion.runnerUpTeam}</span> ({season.champion.seriesScore})
                          </p>
                        </div>

                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
                          <div className="p-2 bg-amber-500/15 rounded-lg text-amber-500">
                            <Star className="w-4 h-4 fill-amber-500" />
                          </div>
                          <div>
                            <span className="text-[9px] font-extrabold uppercase text-zinc-500 block">
                              Finals MVP
                            </span>
                            <span className="font-bold text-xs text-white">
                              {season.champion.finalsMvp}
                            </span>
                            <span className="text-[10px] text-zinc-500 block">
                              {season.champion.finalsMvpTeam}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-zinc-500 text-xs py-8 text-center">
                        Championship details pending.
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Individual Awards Card */}
                <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-500 block mb-3">
                    🏅 Individual Awards
                  </span>
                  {season.awards.length > 0 ? (
                    <div className="space-y-3">
                      {season.awards.map((award) => {
                        const meta = AWARD_META[award.type] || {
                          label: award.type,
                          bg: "bg-zinc-500/10",
                          text: "text-zinc-400",
                          border: "border-zinc-500/20",
                        };

                        return (
                          <div
                            key={award.type}
                            className="flex items-center justify-between p-2.5 bg-zinc-900/30 border border-zinc-900 hover:border-zinc-800/60 rounded-xl transition-all"
                          >
                            <div>
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider border mb-1 ${meta.bg} ${meta.text} ${meta.border}`}>
                                {award.type}
                              </span>
                              <h5 className="font-bold text-zinc-200 text-xs leading-none">
                                {award.playerName}
                              </h5>
                              <span className="text-[10px] text-zinc-500 mt-1 block">
                                {award.teamName}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 bg-zinc-950 border border-zinc-900 rounded-md text-[9px] font-extrabold text-zinc-400">
                              {award.position}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-zinc-500 text-xs py-8 text-center">
                      No individual awards calculated.
                    </div>
                  )}
                </div>

                {/* 3. All-League Teams Card */}
                <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-500 block mb-3">
                    🛡️ All-League selections
                  </span>
                  {season.allLeagueTeams.length > 0 ? (
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                      {season.allLeagueTeams.map((tier) => (
                        <div key={tier.type} className="space-y-1.5">
                          <h6 className={`text-[10px] font-extrabold uppercase tracking-wider ${TIER_COLORS[tier.type] || "text-zinc-400"}`}>
                            {tier.type}
                          </h6>
                          <div className="grid grid-cols-1 gap-1">
                            {tier.members.map((m, i) => (
                              <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-zinc-900/20 border border-zinc-900 rounded-lg text-xs">
                                <span className="font-semibold text-zinc-300">
                                  {m.playerName}
                                </span>
                                <span className="px-1.5 py-0.2 bg-zinc-950 border border-zinc-900 rounded text-[9px] font-bold text-zinc-500">
                                  {m.position}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-zinc-500 text-xs py-8 text-center">
                      No All-League teams selected.
                    </div>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
