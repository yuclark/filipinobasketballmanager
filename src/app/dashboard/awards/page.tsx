"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { getSeasonAwardsAction } from "@/app/actions/awardsEngine";
import { initializePlayoffsAction } from "@/app/actions/playoffEngine";
import { Loader2, Award, Trophy, Users, Shield, Zap, Sparkles, ChevronRight } from "lucide-react";

interface AwardItem {
  id: string;
  seasonYear: number;
  type: string; // 'MVP' | 'ROY' | 'DPOY' | '6MOTY'
  playerId: string;
  playerName: string;
  teamName: string;
  position: string;
  overall: number;
}

interface AllLeagueItem {
  id: string;
  seasonYear: number;
  type: string; // 'All-League 1st' | 'All-League 2nd' | 'All-League 3rd' | 'All-Defensive'
  position: string; // 'G' | 'F' | 'C'
  playerId: string;
  playerName: string;
  teamName: string;
  playerOverall: number;
  playerPosition: string;
}

export default function AwardsCeremonyPage() {
  const router = useRouter();
  const { currentLeagueDay } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [individualAwards, setIndividualAwards] = useState<AwardItem[]>([]);
  const [allLeagueTeamsData, setAllLeagueTeamsData] = useState<AllLeagueItem[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadAwards = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch for 2026 season by default
      const res = await getSeasonAwardsAction(2026);
      if (res.success && res.awards && res.allLeague) {
        setIndividualAwards(res.awards as AwardItem[]);
        setAllLeagueTeamsData(res.allLeague as AllLeagueItem[]);
      } else {
        setError(res.error || "Failed to load season awards.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load awards.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      loadAwards();
    }
  }, [mounted]);

  const handleInitializePlayoffs = async () => {
    setActionLoading(true);
    try {
      const res = await initializePlayoffsAction();
      if (res.success) {
        router.push("/dashboard/playoffs");
      } else {
        alert(res.error || "Failed to initialize playoffs.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Error initializing playoffs: " + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  if (!mounted || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        <p className="text-zinc-400 text-sm font-semibold tracking-wide">Assembling the awards ceremony...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 bg-zinc-950/40 border border-zinc-900 rounded-3xl p-8 max-w-xl mx-auto">
        <Award className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Ceremony Postponed</h3>
        <p className="text-zinc-500 text-sm mb-6">{error}</p>
        <button
          onClick={loadAwards}
          className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 rounded-xl font-bold text-sm transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Group individual awards
  const mvp = individualAwards.find((a) => a.type === "MVP");
  const roy = individualAwards.find((a) => a.type === "ROY");
  const dpoy = individualAwards.find((a) => a.type === "DPOY");
  const sixman = individualAwards.find((a) => a.type === "6MOTY");

  // Group All-League teams
  const filterTeam = (teamType: string) => {
    return allLeagueTeamsData
      .filter((m) => m.type === teamType)
      .sort((a, b) => {
        const order: Record<string, number> = { G: 0, F: 1, C: 2 };
        return (order[a.position] ?? 9) - (order[b.position] ?? 9);
      });
  };

  const firstTeam = filterTeam("All-League 1st");
  const secondTeam = filterTeam("All-League 2nd");
  const thirdTeam = filterTeam("All-League 3rd");
  const defensiveTeam = filterTeam("All-Defensive");

  const getOvrColor = (ovr: number) => {
    if (ovr >= 90) return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    if (ovr >= 80) return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (ovr >= 70) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  };

  return (
    <div className="space-y-12 relative pb-12">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-orange-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header Banner */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 text-orange-400 text-xs font-extrabold uppercase tracking-widest rounded-full border border-orange-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          Season Awards Ceremony
        </span>
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
          FBM Regular Season Awards
        </h1>
        <p className="text-zinc-400 text-base leading-relaxed">
          Honoring the most outstanding individuals, rookies, defenders, and squad selections of Luzon and VisMin.
        </p>
      </div>

      {/* ─── INDIVIDUAL AWARDS SECTION ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* MVP */}
        <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-orange-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden group hover:border-orange-500/50 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-2xl rounded-full" />
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500">
              <Trophy className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/30">
              MVP
            </span>
          </div>
          {mvp ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-white group-hover:text-orange-400 transition-colors leading-tight">
                  {mvp.playerName}
                </h3>
                <p className="text-zinc-500 text-xs mt-1 font-semibold">{mvp.teamName}</p>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-900 pt-4">
                <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{mvp.position}</span>
                <span className="px-2 py-0.5 text-xs font-extrabold rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  OVR {mvp.overall}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-zinc-600 text-xs">No candidate selected</p>
          )}
        </div>

        {/* ROY */}
        <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-900 rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:border-zinc-800 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-500">
              <Zap className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30">
              ROY
            </span>
          </div>
          {roy ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-white group-hover:text-purple-400 transition-colors leading-tight">
                  {roy.playerName}
                </h3>
                <p className="text-zinc-500 text-xs mt-1 font-semibold">{roy.teamName}</p>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-900 pt-4">
                <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{roy.position}</span>
                <span className="px-2 py-0.5 text-xs font-extrabold rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  OVR {roy.overall}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-zinc-600 text-xs">No candidate selected</p>
          )}
        </div>

        {/* DPOY */}
        <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-900 rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:border-zinc-800 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
              <Shield className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
              DPOY
            </span>
          </div>
          {dpoy ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-white group-hover:text-emerald-400 transition-colors leading-tight">
                  {dpoy.playerName}
                </h3>
                <p className="text-zinc-500 text-xs mt-1 font-semibold">{dpoy.teamName}</p>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-900 pt-4">
                <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{dpoy.position}</span>
                <span className="px-2 py-0.5 text-xs font-extrabold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  OVR {dpoy.overall}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-zinc-600 text-xs">No candidate selected</p>
          )}
        </div>

        {/* 6MOTY */}
        <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-900 rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:border-zinc-800 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
              6MOTY
            </span>
          </div>
          {sixman ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-white group-hover:text-blue-400 transition-colors leading-tight">
                  {sixman.playerName}
                </h3>
                <p className="text-zinc-500 text-xs mt-1 font-semibold">{sixman.teamName}</p>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-900 pt-4">
                <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{sixman.position}</span>
                <span className="px-2 py-0.5 text-xs font-extrabold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  OVR {sixman.overall}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-zinc-600 text-xs">No candidate selected</p>
          )}
        </div>
      </div>

      {/* ─── ALL-LEAGUE TEAMS SECTION ─── */}
      <div className="space-y-8">
        <div className="border-b border-zinc-900 pb-4">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-zinc-500" />
            All-League Squad Selections
          </h2>
          <p className="text-zinc-500 text-sm mt-1">Representing the league's top positional selections across first, second, and defensive alignments.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* First Team */}
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-extrabold text-orange-500 flex items-center gap-2">
              🏆 All-League First Team
            </h3>
            <div className="divide-y divide-zinc-900/80">
              {firstTeam.map((m) => (
                <div key={m.id} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
                  <div>
                    <h4 className="font-bold text-zinc-100 text-sm">{m.playerName}</h4>
                    <p className="text-zinc-500 text-[10px] font-semibold mt-0.5">{m.teamName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-zinc-950 border border-zinc-900 rounded text-[10px] font-extrabold text-zinc-400">
                      {m.playerPosition} ({m.position})
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-extrabold rounded-md border ${getOvrColor(m.playerOverall)}`}>
                      {m.playerOverall}
                    </span>
                  </div>
                </div>
              ))}
              {firstTeam.length === 0 && <p className="text-zinc-600 text-xs py-4 text-center">No members listed</p>}
            </div>
          </div>

          {/* Second Team */}
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-extrabold text-zinc-300 flex items-center gap-2">
              🥈 All-League Second Team
            </h3>
            <div className="divide-y divide-zinc-900/80">
              {secondTeam.map((m) => (
                <div key={m.id} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
                  <div>
                    <h4 className="font-bold text-zinc-200 text-sm">{m.playerName}</h4>
                    <p className="text-zinc-500 text-[10px] font-semibold mt-0.5">{m.teamName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-zinc-950 border border-zinc-900 rounded text-[10px] font-extrabold text-zinc-400">
                      {m.playerPosition} ({m.position})
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-extrabold rounded-md border ${getOvrColor(m.playerOverall)}`}>
                      {m.playerOverall}
                    </span>
                  </div>
                </div>
              ))}
              {secondTeam.length === 0 && <p className="text-zinc-600 text-xs py-4 text-center">No members listed</p>}
            </div>
          </div>

          {/* Third Team */}
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-extrabold text-zinc-400 flex items-center gap-2">
              🥉 All-League Third Team
            </h3>
            <div className="divide-y divide-zinc-900/80">
              {thirdTeam.map((m) => (
                <div key={m.id} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
                  <div>
                    <h4 className="font-bold text-zinc-300 text-sm">{m.playerName}</h4>
                    <p className="text-zinc-500 text-[10px] font-semibold mt-0.5">{m.teamName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-zinc-950 border border-zinc-900 rounded text-[10px] font-extrabold text-zinc-400">
                      {m.playerPosition} ({m.position})
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-extrabold rounded-md border ${getOvrColor(m.playerOverall)}`}>
                      {m.playerOverall}
                    </span>
                  </div>
                </div>
              ))}
              {thirdTeam.length === 0 && <p className="text-zinc-600 text-xs py-4 text-center">No members listed</p>}
            </div>
          </div>

          {/* All-Defensive Team */}
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-extrabold text-emerald-500 flex items-center gap-2">
              🛡️ All-Defensive Team
            </h3>
            <div className="divide-y divide-zinc-900/80">
              {defensiveTeam.map((m) => (
                <div key={m.id} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
                  <div>
                    <h4 className="font-bold text-zinc-100 text-sm">{m.playerName}</h4>
                    <p className="text-zinc-500 text-[10px] font-semibold mt-0.5">{m.teamName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-zinc-950 border border-zinc-900 rounded text-[10px] font-extrabold text-zinc-400">
                      {m.playerPosition} ({m.position})
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-extrabold rounded-md border ${getOvrColor(m.playerOverall)}`}>
                      {m.playerOverall}
                    </span>
                  </div>
                </div>
              ))}
              {defensiveTeam.length === 0 && <p className="text-zinc-600 text-xs py-4 text-center">No members listed</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM CONTROL BANNER ─── */}
      <div className="bg-gradient-to-r from-orange-500/5 to-amber-500/5 border border-orange-500/20 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Trophy className="w-32 h-32 text-orange-500" />
        </div>
        <div>
          <h3 className="text-xl font-extrabold text-white tracking-tight">The Regular Season has Concluded</h3>
          <p className="text-zinc-400 text-sm mt-1 max-w-md">
            All 82 games have been simulated. The seeds are locked, and the awards are distributed. The playoffs await.
          </p>
        </div>
        <button
          onClick={handleInitializePlayoffs}
          disabled={actionLoading}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-black text-base shadow-[0_4px_25px_rgba(249,115,22,0.4)] hover:scale-[1.02] cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {actionLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Trophy className="w-5 h-5 text-white" />
          )}
          <span>🏆 Initialize Postseason Playoffs</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
