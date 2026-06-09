"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import {
  checkRegularSeasonCompleteAction,
  initializePlayoffsAction,
  getPlayoffBracketAction,
  simulatePlayoffDayAction,
  getSeriesGamesAction,
  simulateUntilGrandFinalsAction,
} from "@/app/actions/playoffEngine";
import { getStandingsDataAction, getGameBoxScore } from "@/app/actions/leagueEngine";
import {
  Trophy,
  Loader2,
  Play,
  Sparkles,
  Award,
  Shield,
  Star,
  Calendar,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  X,
  FastForward,
} from "lucide-react";

interface Team {
  id: string;
  name: string;
  city: string;
  conference: "Luzon" | "VisMin";
  budget: number;
}

interface TeamRecord extends Team {
  wins: number;
  losses: number;
  pct: number;
  pctString: string;
}

interface BracketNode {
  seriesId: string;
  round: "Quarterfinals" | "Semifinals" | "ConferenceFinals" | "GrandFinals";
  conference: "Luzon" | "VisMin" | "Cross";
  teamA: { id: string; city: string; name: string; conference: string; seed: number; wins: number };
  teamB: { id: string; city: string; name: string; conference: string; seed: number; wins: number };
  status: "Scheduled" | "In Progress" | "Completed";
  winnerId: string | null;
}

export default function PlayoffsPage() {
  const { userTeamId } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Standings projected seeds state (for regular season ongoing)
  const [projectedNorth, setProjectedNorth] = useState<TeamRecord[]>([]);
  const [projectedSouth, setProjectedSouth] = useState<TeamRecord[]>([]);

  // Playoff state
  const [isSeasonComplete, setIsSeasonComplete] = useState(false);
  const [totalGames, setTotalGames] = useState(0);
  const [scheduledGames, setScheduledGames] = useState(0);
  const [bracket, setBracket] = useState<BracketNode[]>([]);
  const [activeTab, setActiveTab] = useState<"luzon" | "vismin" | "finals">("luzon");

  // Playoff Box Score Modal State
  const [selectedSeries, setSelectedSeries] = useState<BracketNode | null>(null);
  const [seriesGames, setSeriesGames] = useState<any[]>([]);
  const [loadingSeriesGames, setLoadingSeriesGames] = useState(false);
  const [activeBoxScoreGame, setActiveBoxScoreGame] = useState<any | null>(null);
  const [boxScoreStats, setBoxScoreStats] = useState<any[]>([]);
  const [loadingBoxScore, setLoadingBoxScore] = useState(false);
  const [isMacroSimGrandFinals, setIsMacroSimGrandFinals] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadPlayoffData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Check if season is complete
      const checkRes = await checkRegularSeasonCompleteAction();
      if (checkRes.success) {
        setIsSeasonComplete(checkRes.complete);
        setTotalGames(checkRes.totalGames ?? 0);
        setScheduledGames(checkRes.scheduledGames ?? 0);
      }

      // 2. Fetch bracket games
      const bracketRes = await getPlayoffBracketAction();
      if (bracketRes.success && bracketRes.bracket) {
        setBracket(bracketRes.bracket as BracketNode[]);
        if (bracketRes.bracket.length > 0) {
          // If playoffs are active, check if Grand Finals are scheduled or played to default tab
          const hasGF = bracketRes.bracket.some((n) => n.round === "GrandFinals");
          const hasCF = bracketRes.bracket.some((n) => n.round === "ConferenceFinals");
          if (hasGF) {
            setActiveTab("finals");
          } else if (hasCF) {
            // Find which conference the user is in to default
            const userNode = bracketRes.bracket.find((n) => n.teamA.id === userTeamId || n.teamB.id === userTeamId);
            if (userNode && userNode.conference === "VisMin") {
              setActiveTab("vismin");
            } else {
              setActiveTab("luzon");
            }
          }
        }
      }

      // 3. Fetch regular season standings for projection
      const standingsRes = await getStandingsDataAction();
      if (standingsRes.success && standingsRes.teams && standingsRes.completedGames) {
        const calculated = (standingsRes.teams as Team[]).map((team) => {
          const teamGames = (standingsRes.completedGames as any[]).filter(
            (g) => g.homeTeamId === team.id || g.awayTeamId === team.id
          );
          let wins = 0;
          let losses = 0;
          for (const g of teamGames) {
            const isHome = g.homeTeamId === team.id;
            const tScore = isHome ? g.homeScore : g.awayScore;
            const oScore = isHome ? g.awayScore : g.homeScore;
            if (tScore > oScore) wins++; else losses++;
          }
          const total = wins + losses;
          const pct = total > 0 ? wins / total : 0;
          const pctString = total > 0 ? (wins / total).toFixed(3).replace(/^0/, "") : ".000";
          return { ...team, wins, losses, pct, pctString };
        });

        const sortConf = (recs: typeof calculated) => {
          return [...recs].sort((a, b) => {
            if (b.pct !== a.pct) return b.pct - a.pct;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return a.city.localeCompare(b.city);
          });
        };

        setProjectedNorth(sortConf(calculated.filter((r) => r.conference === "Luzon")));
        setProjectedSouth(sortConf(calculated.filter((r) => r.conference === "VisMin")));
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to load postseason dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      loadPlayoffData();
    }
  }, [mounted]);

  // Handle Playoff Seeding Initialization
  const handleInitializePlayoffs = async () => {
    try {
      setLoading(true);
      const res = await initializePlayoffsAction();
      if (res.success) {
        await loadPlayoffData();
      } else {
        alert(res.error || "Failed to seed playoff matchups.");
      }
    } catch (err) {
      console.error(err);
      alert("Error initializing postseason.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Playoff Day Simulation
  const handleSimulatePlayoffDay = async () => {
    setIsMacroSimGrandFinals(false);
    try {
      setSimulating(true);
      const res = await simulatePlayoffDayAction();
      if (res.success) {
        if (res.complete) {
          alert("Playoff Grand Finals concluded! We have crowned a PBA Champion!");
        } else if (res.advancedRound) {
          alert("All series in the current round are completed! Progression to the next round seeded.");
        }
        await loadPlayoffData();
      } else {
        alert(res.error || "Failed to simulate playoff Day.");
      }
    } catch (err) {
      console.error(err);
      alert("Error simulating postseason matchups.");
    } finally {
      setSimulating(false);
    }
  };

  const handleSimulateUntilGrandFinals = async () => {
    setIsMacroSimGrandFinals(true);
    try {
      setSimulating(true);
      const res = await simulateUntilGrandFinalsAction();
      if (res.success) {
        alert("Playoffs advanced to the Grand Finals! Matchups generated.");
        await loadPlayoffData();
      } else {
        alert(res.error || "Failed to fast-forward playoffs.");
      }
    } catch (err) {
      console.error(err);
      alert("Error fast-forwarding playoffs.");
    } finally {
      setSimulating(false);
      setIsMacroSimGrandFinals(false);
    }
  };

  const handleViewSeriesGames = async (node: BracketNode) => {
    setSelectedSeries(node);
    setLoadingSeriesGames(true);
    try {
      const res = await getSeriesGamesAction(node.seriesId);
      if (res.success && res.games) {
        setSeriesGames(res.games);
      } else {
        alert(res.error || "Failed to load series games.");
      }
    } catch (err) {
      console.error(err);
      alert("Error loading series games.");
    } finally {
      setLoadingSeriesGames(false);
    }
  };

  const handleViewGameBoxScore = async (game: any) => {
    setActiveBoxScoreGame(game);
    setLoadingBoxScore(true);
    try {
      const stats = await getGameBoxScore(game.id);
      // Sort players by points descending
      const sorted = (stats as any[]).sort((a, b) => b.points - a.points);
      setBoxScoreStats(sorted);
    } catch (err) {
      console.error(err);
      alert("Error loading box score.");
    } finally {
      setLoadingBoxScore(false);
    }
  };

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // Pre-calculate eliminated teams list
  const eliminatedTeamIds = new Set<string>();
  bracket.forEach((series) => {
    if (series.status === "Completed" && series.winnerId) {
      const loserId = series.teamA.id === series.winnerId ? series.teamB.id : series.teamA.id;
      eliminatedTeamIds.add(loserId);
    }
  });

  // Find Grand Finals winner for champion card
  const gfSeries = bracket.find((n) => n.round === "GrandFinals");
  const championTeam = gfSeries && gfSeries.status === "Completed" && gfSeries.winnerId
    ? (gfSeries.winnerId === gfSeries.teamA.id ? gfSeries.teamA : gfSeries.teamB)
    : null;

  const isPlayoffsActive = bracket.length > 0;
  const hasProgressedPastQuarterfinals = bracket.some(
    (n) => n.round === "Semifinals" || n.round === "ConferenceFinals" || n.round === "GrandFinals"
  );

  // Renders a series card inside the bracket layout
  const renderSeriesCard = (seriesId: string) => {
    const node = bracket.find((n) => n.seriesId === seriesId);
    if (!node) {
      return (
        <div className="bg-zinc-950/40 border border-zinc-900/60 rounded-2xl p-4 text-center text-zinc-600 text-xs">
          TBD
        </div>
      );
    }

    const { teamA, teamB, status, winnerId } = node;
    const isUserTeamA = teamA.id === userTeamId;
    const isUserTeamB = teamB.id === userTeamId;
    const isEliminatedA = eliminatedTeamIds.has(teamA.id);
    const isEliminatedB = eliminatedTeamIds.has(teamB.id);

    const isWinnerA = winnerId === teamA.id;
    const isWinnerB = winnerId === teamB.id;

    // Series description string
    let seriesDesc = "Series Scheduled";
    if (status === "In Progress") {
      if (teamA.wins > teamB.wins) {
        seriesDesc = `${teamA.city} leads ${teamA.wins}-${teamB.wins}`;
      } else if (teamB.wins > teamA.wins) {
        seriesDesc = `${teamB.city} leads ${teamB.wins}-${teamA.wins}`;
      } else {
        seriesDesc = `Series Tied ${teamA.wins}-${teamB.wins}`;
      }
    } else if (status === "Completed") {
      const winnerName = isWinnerA ? teamA.city : teamB.city;
      const wWins = isWinnerA ? teamA.wins : teamB.wins;
      const lWins = isWinnerA ? teamB.wins : teamA.wins;
      seriesDesc = `${winnerName} wins series ${wWins}-${lWins}`;
    }

    return (
      <div
        onClick={() => handleViewSeriesGames(node)}
        className={`bg-zinc-900/40 border rounded-2xl p-4 shadow-md transition-all relative cursor-pointer hover:border-zinc-700 hover:scale-[1.01] ${
          isUserTeamA || isUserTeamB
            ? "border-orange-500/40 bg-orange-500/5 shadow-orange-500/5 ring-1 ring-orange-500/20"
            : "border-zinc-905"
        }`}
      >
        {isUserTeamA || isUserTeamB ? (
          <span className="absolute -top-2 -right-2 p-1 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full text-white shadow-md">
            <Star className="w-3 h-3 fill-white" />
          </span>
        ) : null}

        {/* Team A */}
        <div className={`flex justify-between items-center mb-2.5 ${isEliminatedA ? "opacity-35" : ""}`}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-500 px-1.5 py-0.5 bg-zinc-950 rounded">
              {teamA.seed}
            </span>
            <span className={`text-sm font-bold ${isWinnerA ? "text-orange-400" : isUserTeamA ? "text-white" : "text-zinc-200"}`}>
              {teamA.city} <span className="text-zinc-400 font-semibold">{teamA.name}</span>
            </span>
          </div>
          <span className={`text-base font-extrabold ${isWinnerA ? "text-orange-400" : "text-zinc-300"}`}>
            {teamA.wins}
          </span>
        </div>

        {/* Team B */}
        <div className={`flex justify-between items-center mb-3 ${isEliminatedB ? "opacity-35" : ""}`}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-500 px-1.5 py-0.5 bg-zinc-950 rounded">
              {teamB.seed}
            </span>
            <span className={`text-sm font-bold ${isWinnerB ? "text-orange-400" : isUserTeamB ? "text-white" : "text-zinc-200"}`}>
              {teamB.city} <span className="text-zinc-400 font-semibold">{teamB.name}</span>
            </span>
          </div>
          <span className={`text-base font-extrabold ${isWinnerB ? "text-orange-400" : "text-zinc-300"}`}>
            {teamB.wins}
          </span>
        </div>

        {/* Series status banner */}
        <div className="pt-2 border-t border-zinc-950 flex justify-between items-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
          <span>{node.round === "GrandFinals" ? "Best of 7" : "Best of 5"}</span>
          <span className={status === "Completed" ? "text-orange-500" : status === "In Progress" ? "text-zinc-400" : ""}>
            {seriesDesc}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 relative">
      {/* Simulation Overlay */}
      {simulating && (
        <div className="fixed inset-0 bg-zinc-950/70 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
          <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl text-center shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            <h3 className="text-xl font-bold text-white">
              {isMacroSimGrandFinals ? "Simulating Postseason Rounds..." : "Simulating Playoff Day..."}
            </h3>
            <p className="text-zinc-400 text-sm max-w-xs">
              {isMacroSimGrandFinals 
                ? "Fast-forwarding through Quarterfinals, Semifinals, and Conference Finals series..." 
                : "Simulating active series match-ups and evaluating clinching matches."}
            </p>
          </div>
        </div>
      )}

      {/* Playoff Banner controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-orange-500/10 rounded-2xl text-orange-500">
            <Trophy className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">Postseason Playoffs</h3>
            <p className="text-zinc-500 text-sm font-semibold tracking-wide">
              {!isSeasonComplete
                ? "Regular Season Ongoing • Lock standing seeds to enter postseason"
                : !isPlayoffsActive
                ? "Regular Season Finished • Awaiting standings confirmation"
                : championTeam
                ? `Postseason Concluded • Champion crowned!`
                : "Postseason Active • Simulate matches and climb the bracket"}
            </p>
          </div>
        </div>

        {isPlayoffsActive && !championTeam && (
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={handleSimulatePlayoffDay}
              disabled={simulating}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl font-semibold cursor-pointer text-xs transition-all active:scale-[0.98]"
            >
              <Play className="w-3.5 h-3.5 fill-zinc-400 text-zinc-400" />
              <span>Simulate Playoff Day</span>
            </button>

            {!hasProgressedPastQuarterfinals && (
              <button
                onClick={handleSimulateUntilGrandFinals}
                disabled={simulating}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-extrabold text-xs shadow-[0_4px_12px_rgba(249,115,22,0.25)] hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer ring-1 ring-orange-500/20"
              >
                <FastForward className="w-3.5 h-3.5 text-white" />
                <span>🔥 Fast-Forward to Grand Finals</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* STATE 1: Regular season in progress */}
      {!isSeasonComplete && !isPlayoffsActive && (
        <div className="space-y-8">
          {/* Progress bar banner */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-8 max-w-3xl mx-auto shadow-2xl text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-500/5 blur-[80px] rounded-full pointer-events-none" />
            <Calendar className="w-14 h-14 text-zinc-700 mx-auto mb-5" />
            <h3 className="text-2xl font-extrabold text-white tracking-tight mb-2">Lock-In for the Postseason</h3>
            <p className="text-zinc-400 text-sm max-w-md mx-auto mb-6">
              There are scheduled regular season games remaining. Play through the regular season schedule to secure your seeding and unlock the bracket.
            </p>

            {/* Progress bar */}
            <div className="max-w-md mx-auto space-y-2">
              <div className="flex justify-between text-xs font-bold text-zinc-500">
                <span>Games Played: {totalGames - scheduledGames} / {totalGames}</span>
                <span>{Math.round(((totalGames - scheduledGames) / totalGames) * 100)}%</span>
              </div>
              <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-900">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                  style={{ width: `${((totalGames - scheduledGames) / totalGames) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Current Projected Standings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* North Conference (Luzon) */}
            <div className="bg-zinc-900/20 border border-zinc-900 rounded-3xl p-6">
              <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-4 px-2 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Luzon Playoff Race (Projected Seeds)
              </h4>
              <div className="space-y-2">
                {projectedNorth.slice(0, 10).map((team, idx) => {
                  const seed = idx + 1;
                  const isUser = team.id === userTeamId;
                  const inPlayoffs = seed <= 8;

                  return (
                    <div
                      key={team.id}
                      className={`flex justify-between items-center px-4 py-3 rounded-xl border text-xs font-semibold ${
                        isUser
                          ? "bg-orange-500/10 border-orange-500/35 text-white"
                          : inPlayoffs
                          ? "bg-zinc-950/40 border-zinc-900 text-zinc-300"
                          : "bg-zinc-950/10 border-zinc-900/40 text-zinc-500 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-extrabold ${inPlayoffs ? "bg-zinc-900 text-zinc-300" : "bg-zinc-950/20 text-zinc-600"}`}>
                          {seed}
                        </span>
                        <span>{team.city} {team.name}</span>
                      </div>
                      <span>{team.wins} - {team.losses} ({team.pctString})</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* South Conference (VisMin) */}
            <div className="bg-zinc-900/20 border border-zinc-900 rounded-3xl p-6">
              <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4 px-2 flex items-center gap-2">
                <Shield className="w-4 h-4" /> VisMin Playoff Race (Projected Seeds)
              </h4>
              <div className="space-y-2">
                {projectedSouth.slice(0, 10).map((team, idx) => {
                  const seed = idx + 1;
                  const isUser = team.id === userTeamId;
                  const inPlayoffs = seed <= 8;

                  return (
                    <div
                      key={team.id}
                      className={`flex justify-between items-center px-4 py-3 rounded-xl border text-xs font-semibold ${
                        isUser
                          ? "bg-orange-500/10 border-orange-500/35 text-white"
                          : inPlayoffs
                          ? "bg-zinc-950/40 border-zinc-900 text-zinc-300"
                          : "bg-zinc-950/10 border-zinc-900/40 text-zinc-500 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-extrabold ${inPlayoffs ? "bg-zinc-900 text-zinc-300" : "bg-zinc-950/20 text-zinc-600"}`}>
                          {seed}
                        </span>
                        <span>{team.city} {team.name}</span>
                      </div>
                      <span>{team.wins} - {team.losses} ({team.pctString})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 2: Season complete, playoffs awaiting initialization */}
      {isSeasonComplete && !isPlayoffsActive && (
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-10 text-center max-w-3xl mx-auto shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-500/5 blur-[80px] rounded-full pointer-events-none" />
          <Award className="w-16 h-16 text-orange-500 mx-auto mb-6 animate-pulse" />
          <h3 className="text-3xl font-extrabold text-white tracking-tight mb-3">Regular Season Concluded</h3>
          <p className="text-zinc-400 text-base max-w-md mx-auto mb-8">
            Standings are officially locked. Seed the playoff brackets and prepare your franchise for the road to the PBA Championship!
          </p>

          {/* Seeds check box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left max-w-xl mx-auto mb-10">
            <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4">
              <span className="text-red-400 text-xs font-bold uppercase tracking-wider block mb-2">Luzon Top Seed</span>
              <span className="text-base font-extrabold text-white">
                [1] {projectedNorth[0]?.city} {projectedNorth[0]?.name}
              </span>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4">
              <span className="text-cyan-400 text-xs font-bold uppercase tracking-wider block mb-2">VisMin Top Seed</span>
              <span className="text-base font-extrabold text-white">
                [1] {projectedSouth[0]?.city} {projectedSouth[0]?.name}
              </span>
            </div>
          </div>

          <button
            onClick={handleInitializePlayoffs}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-extrabold text-sm shadow-[0_4px_20px_rgba(249,115,22,0.3)] hover:scale-[1.02] cursor-pointer transition-all active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Lock Standings & Begin Playoffs</span>
          </button>
        </div>
      )}

      {/* STATE 3: Playoffs are active */}
      {isPlayoffsActive && (
        <div className="space-y-8">
          
          {/* Tab Navigation */}
          <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-900 self-start max-w-md mx-auto">
            <button
              onClick={() => setActiveTab("luzon")}
              className={`flex-1 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === "luzon"
                  ? "bg-red-500/10 text-red-400 border border-red-500/20 shadow-md"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Luzon Bracket
            </button>
            <button
              onClick={() => setActiveTab("vismin")}
              className={`flex-1 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === "vismin"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              VisMin Bracket
            </button>
            <button
              onClick={() => setActiveTab("finals")}
              className={`flex-1 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === "finals"
                  ? "bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-md"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Grand Finals
            </button>
          </div>

          {/* Luzon tab */}
          {activeTab === "luzon" && (
            <div className="bg-zinc-905 border border-zinc-900 rounded-3xl p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="p-2 bg-red-500/10 rounded-lg text-red-400">
                  <Shield className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-lg font-bold text-white">Luzon Postseason Tournament</h4>
                  <p className="text-zinc-500 text-xs">North Division Playoff bracket rounds</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                {/* Column 1: Quarterfinals */}
                <div className="space-y-6">
                  <h5 className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center py-1 bg-zinc-950/40 rounded border border-zinc-900/30 mb-2">
                    Quarterfinals
                  </h5>
                  {renderSeriesCard("Q_Luzon_1v8")}
                  {renderSeriesCard("Q_Luzon_4v5")}
                  {renderSeriesCard("Q_Luzon_2v7")}
                  {renderSeriesCard("Q_Luzon_3v6")}
                </div>

                {/* Column 2: Semifinals */}
                <div className="space-y-12">
                  <h5 className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center py-1 bg-zinc-950/40 rounded border border-zinc-900/30 mb-2">
                    Semifinals
                  </h5>
                  {renderSeriesCard("S_Luzon_1v8_vs_4v5")}
                  {renderSeriesCard("S_Luzon_2v7_vs_3v6")}
                </div>

                {/* Column 3: Conference Finals */}
                <div className="space-y-24">
                  <h5 className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center py-1 bg-zinc-950/40 rounded border border-zinc-900/30 mb-2">
                    Conference Finals
                  </h5>
                  {renderSeriesCard("CF_Luzon")}
                </div>
              </div>
            </div>
          )}

          {/* VisMin tab */}
          {activeTab === "vismin" && (
            <div className="bg-zinc-905 border border-zinc-900 rounded-3xl p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
                  <Shield className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-lg font-bold text-white">VisMin Postseason Tournament</h4>
                  <p className="text-zinc-500 text-xs">South Division Playoff bracket rounds</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                {/* Column 1: Quarterfinals */}
                <div className="space-y-6">
                  <h5 className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center py-1 bg-zinc-950/40 rounded border border-zinc-900/30 mb-2">
                    Quarterfinals
                  </h5>
                  {renderSeriesCard("Q_VisMin_1v8")}
                  {renderSeriesCard("Q_VisMin_4v5")}
                  {renderSeriesCard("Q_VisMin_2v7")}
                  {renderSeriesCard("Q_VisMin_3v6")}
                </div>

                {/* Column 2: Semifinals */}
                <div className="space-y-12">
                  <h5 className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center py-1 bg-zinc-950/40 rounded border border-zinc-900/30 mb-2">
                    Semifinals
                  </h5>
                  {renderSeriesCard("S_VisMin_1v8_vs_4v5")}
                  {renderSeriesCard("S_VisMin_2v7_vs_3v6")}
                </div>

                {/* Column 3: Conference Finals */}
                <div className="space-y-24">
                  <h5 className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center py-1 bg-zinc-950/40 rounded border border-zinc-900/30 mb-2">
                    Conference Finals
                  </h5>
                  {renderSeriesCard("CF_VisMin")}
                </div>
              </div>
            </div>
          )}

          {/* Finals & Champion tab */}
          {activeTab === "finals" && (
            <div className="space-y-8">
              {/* Grand Finals Card */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-8 max-w-xl mx-auto shadow-2xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                  <Trophy className="w-48 h-48 text-white" />
                </div>

                <div className="text-center">
                  <span className="inline-flex px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/25 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                    PBA League Finals
                  </span>
                  <h4 className="text-xl font-extrabold text-white">Grand Finals Showdown</h4>
                  <p className="text-zinc-500 text-xs mt-1">Luzon Champion vs VisMin Champion (Best of 7)</p>
                </div>

                {renderSeriesCard("GF_GrandFinals")}
              </div>

              {/* Champion Card */}
              {championTeam && (
                <div className="bg-gradient-to-b from-orange-500/10 to-amber-500/20 border-2 border-orange-500/40 rounded-3xl p-10 max-w-lg mx-auto text-center shadow-2xl relative overflow-hidden">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-orange-500/10 blur-[90px] rounded-full pointer-events-none" />
                  <Trophy className="w-20 h-20 text-amber-400 mx-auto mb-6 drop-shadow-[0_4px_12px_rgba(251,191,36,0.3)] animate-pulse" />
                  <span className="text-amber-400 text-xs font-bold uppercase tracking-widest block mb-2">
                    🏆 PBA Season Champion 🏆
                  </span>
                  <h3 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
                    {championTeam.city}{" "}
                    <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                      {championTeam.name}
                    </span>
                  </h3>
                  <p className="text-zinc-400 text-sm font-medium mt-3">
                    Congratulations! The championship trophy has been claimed. Lock standings next season to run another campaign!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Playoff Series Details & Box Score Modal */}
      {selectedSeries && (
        <div className="fixed inset-0 bg-zinc-950/85 flex items-center justify-center z-40 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-y-auto flex flex-col shadow-2xl">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900 z-10">
              <div>
                {activeBoxScoreGame ? (
                  <div>
                    <h4 className="text-xl font-bold text-white flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setActiveBoxScoreGame(null);
                          setBoxScoreStats([]);
                        }}
                        className="text-orange-500 hover:text-orange-400 font-bold text-sm bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 mr-2"
                      >
                        ← Back to Series
                      </button>
                      Box Score: Game {activeBoxScoreGame.gameNumber - 82}
                    </h4>
                    <p className="text-xs text-zinc-400 mt-2">
                      {activeBoxScoreGame.homeTeam?.city} {activeBoxScoreGame.homeTeam?.name} ({activeBoxScoreGame.homeScore}) vs{" "}
                      {activeBoxScoreGame.awayTeam?.city} {activeBoxScoreGame.awayTeam?.name} ({activeBoxScoreGame.awayScore})
                    </p>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-xl font-bold text-white flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-orange-500" />
                      {selectedSeries.round}: {selectedSeries.teamA.city} vs {selectedSeries.teamB.city}
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      Division: {selectedSeries.conference === "Cross" ? "Grand Finals" : selectedSeries.conference} • Best-of-{selectedSeries.round === "GrandFinals" ? 7 : 5} Series
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedSeries(null);
                  setSeriesGames([]);
                  setActiveBoxScoreGame(null);
                  setBoxScoreStats([]);
                }}
                className="p-1.5 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {activeBoxScoreGame ? (
                /* Box Score Table View */
                loadingBoxScore ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Home Team Stats */}
                    <div>
                      <h5 className="font-bold text-sm text-orange-500 uppercase tracking-wider mb-3 px-2">
                        {activeBoxScoreGame.homeTeam?.city} {activeBoxScoreGame.homeTeam?.name} Stats
                      </h5>
                      <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-950/40">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-zinc-950 text-zinc-400 font-bold border-b border-zinc-800 uppercase tracking-wider text-[10px]">
                              <th className="py-3 px-4">Player</th>
                              <th className="py-3 px-2 text-center">Pos</th>
                              <th className="py-3 px-2 text-center">MIN</th>
                              <th className="py-3 px-2 text-center">PTS</th>
                              <th className="py-3 px-2 text-center">REB</th>
                              <th className="py-3 px-2 text-center">AST</th>
                              <th className="py-3 px-2 text-center">STL</th>
                              <th className="py-3 px-2 text-center">BLK</th>
                              <th className="py-3 px-2 text-center">TO</th>
                              <th className="py-3 px-4 text-center">FG (M-A)</th>
                              <th className="py-3 px-4 text-center">3P (M-A)</th>
                              <th className="py-3 px-4 text-center">FT (M-A)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800 font-medium text-zinc-300">
                            {boxScoreStats
                              .filter((s) => s.player && (s.player as any).teamId === activeBoxScoreGame.homeTeamId)
                              .map((stat) => (
                                <tr key={stat.id} className="hover:bg-zinc-800/40">
                                  <td className="py-3 px-4 font-bold text-zinc-200">
                                    {stat.player.firstName} {stat.player.lastName}
                                    {stat.player.isFilAm && (
                                      <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-extrabold bg-cyan-500/10 text-cyan-400">
                                        Fil-Am
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-2 text-center text-zinc-400 font-bold">{stat.player.position}</td>
                                  <td className="py-3 px-2 text-center text-zinc-400 font-semibold">{stat.minutes || 0}</td>
                                  <td className="py-3 px-2 text-center font-bold text-white">{stat.points}</td>
                                  <td className="py-3 px-2 text-center text-zinc-300">{stat.rebounds}</td>
                                  <td className="py-3 px-2 text-center text-zinc-300">{stat.assists}</td>
                                  <td className="py-3 px-2 text-center text-zinc-400">{stat.steals}</td>
                                  <td className="py-3 px-2 text-center text-zinc-400">{stat.blocks}</td>
                                  <td className="py-3 px-2 text-center text-red-400">{stat.turnovers}</td>
                                  <td className="py-3 px-4 text-center text-zinc-400 font-mono">
                                    {stat.fieldGoalsMade}-{stat.fieldGoalsAttempted}
                                  </td>
                                  <td className="py-3 px-4 text-center text-zinc-400 font-mono">
                                    {stat.threePointMade || 0}-{stat.threePointAttempted || 0}
                                  </td>
                                  <td className="py-3 px-4 text-center text-zinc-400 font-mono">
                                    {stat.freeThrowsMade || 0}-{stat.freeThrowsAttempted || 0}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Away Team Stats */}
                    <div>
                      <h5 className="font-bold text-sm text-orange-500 uppercase tracking-wider mb-3 px-2">
                        {activeBoxScoreGame.awayTeam?.city} {activeBoxScoreGame.awayTeam?.name} Stats
                      </h5>
                      <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-950/40">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-zinc-950 text-zinc-400 font-bold border-b border-zinc-800 uppercase tracking-wider text-[10px]">
                              <th className="py-3 px-4">Player</th>
                              <th className="py-3 px-2 text-center">Pos</th>
                              <th className="py-3 px-2 text-center">MIN</th>
                              <th className="py-3 px-2 text-center">PTS</th>
                              <th className="py-3 px-2 text-center">REB</th>
                              <th className="py-3 px-2 text-center">AST</th>
                              <th className="py-3 px-2 text-center">STL</th>
                              <th className="py-3 px-2 text-center">BLK</th>
                              <th className="py-3 px-2 text-center">TO</th>
                              <th className="py-3 px-4 text-center">FG (M-A)</th>
                              <th className="py-3 px-4 text-center">3P (M-A)</th>
                              <th className="py-3 px-4 text-center">FT (M-A)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800 font-medium text-zinc-300">
                            {boxScoreStats
                              .filter((s) => s.player && (s.player as any).teamId === activeBoxScoreGame.awayTeamId)
                              .map((stat) => (
                                <tr key={stat.id} className="hover:bg-zinc-800/40">
                                  <td className="py-3 px-4 font-bold text-zinc-200">
                                    {stat.player.firstName} {stat.player.lastName}
                                    {stat.player.isFilAm && (
                                      <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-extrabold bg-cyan-500/10 text-cyan-400">
                                        Fil-Am
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-2 text-center text-zinc-400 font-bold">{stat.player.position}</td>
                                  <td className="py-3 px-2 text-center text-zinc-400 font-semibold">{stat.minutes || 0}</td>
                                  <td className="py-3 px-2 text-center font-bold text-white">{stat.points}</td>
                                  <td className="py-3 px-2 text-center text-zinc-300">{stat.rebounds}</td>
                                  <td className="py-3 px-2 text-center text-zinc-300">{stat.assists}</td>
                                  <td className="py-3 px-2 text-center text-zinc-400">{stat.steals}</td>
                                  <td className="py-3 px-2 text-center text-zinc-400">{stat.blocks}</td>
                                  <td className="py-3 px-2 text-center text-red-400">{stat.turnovers}</td>
                                  <td className="py-3 px-4 text-center text-zinc-400 font-mono">
                                    {stat.fieldGoalsMade}-{stat.fieldGoalsAttempted}
                                  </td>
                                  <td className="py-3 px-4 text-center text-zinc-400 font-mono">
                                    {stat.threePointMade || 0}-{stat.threePointAttempted || 0}
                                  </td>
                                  <td className="py-3 px-4 text-center text-zinc-400 font-mono">
                                    {stat.freeThrowsMade || 0}-{stat.freeThrowsAttempted || 0}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                /* Series Games List View */
                loadingSeriesGames ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h5 className="text-sm font-bold text-zinc-400 px-1">Games in this Series</h5>
                    <div className="grid grid-cols-1 gap-3">
                      {seriesGames.map((game, idx) => {
                        const isCompleted = game.status === "Completed";
                        return (
                          <div 
                            key={game.id} 
                            className="bg-zinc-950/40 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-zinc-700 transition-colors"
                          >
                            <div>
                              <span className="text-[10px] bg-zinc-950 px-2 py-1 rounded text-zinc-500 font-bold uppercase tracking-wider block w-max mb-1.5">
                                Game {idx + 1}
                              </span>
                              <div className="text-sm font-bold text-zinc-200">
                                {game.homeTeam?.city} {game.homeTeam?.name}{" "}
                                <span className={isCompleted && game.homeScore > game.awayScore ? "text-orange-500 font-extrabold" : ""}>
                                  {isCompleted ? game.homeScore : ""}
                                </span>{" "}
                                vs{" "}
                                {game.awayTeam?.city} {game.awayTeam?.name}{" "}
                                <span className={isCompleted && game.awayScore > game.homeScore ? "text-orange-500 font-extrabold" : ""}>
                                  {isCompleted ? game.awayScore : ""}
                                </span>
                              </div>
                            </div>
                            <div>
                              {isCompleted ? (
                                <button
                                  onClick={() => handleViewGameBoxScore(game)}
                                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-750 text-orange-500 hover:text-orange-400 rounded-xl font-extrabold text-xs transition-colors cursor-pointer animate-pulse-slow"
                                >
                                  View Box Score
                                </button>
                              ) : (
                                <span className="text-xs text-zinc-600 font-bold uppercase tracking-wider px-3 py-1.5 border border-zinc-900 bg-zinc-950/20 rounded-xl">
                                  Scheduled
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {seriesGames.length === 0 && (
                        <div className="py-10 text-center text-zinc-500 italic text-sm">
                          No games have been scheduled for this series yet.
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
