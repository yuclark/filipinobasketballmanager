"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/useGameStore";
import { getStandingsDataAction } from "@/app/actions/leagueEngine";
import {
  Trophy,
  Loader2,
  RefreshCw,
  Award,
  Zap,
  TrendingUp,
  Shield,
  Star,
} from "lucide-react";

interface Team {
  id: string;
  name: string;
  city: string;
  conference: "Luzon" | "VisMin";
  budget: number;
}

interface CompletedGame {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  seasonYear: number;
  gameNumber: number;
  status: string;
  homeScore: number;
  awayScore: number;
}

interface TeamRecord extends Team {
  wins: number;
  losses: number;
  pct: number;
  pctString: string;
  streak: string;
}

export default function StandingsPage() {
  const { userTeamId } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<CompletedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"pct" | "wins" | "losses">("pct");

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadStandingsData = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const res = await getStandingsDataAction();
      if (res.success && res.teams && res.completedGames) {
        setTeams(res.teams as Team[]);
        setGames(res.completedGames as CompletedGame[]);
      } else {
        setError(res.error || "Failed to load standings data.");
      }
    } catch (err: any) {
      console.error(err);
      setError("An unexpected error occurred while fetching standings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      loadStandingsData();
    }
  }, [mounted]);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // Calculate team records and streaks in code
  const calculatedRecords: TeamRecord[] = teams.map((team) => {
    // Filter completed games involving this team
    const teamGames = games
      .filter((g) => g.homeTeamId === team.id || g.awayTeamId === team.id)
      .sort((a, b) => a.gameNumber - b.gameNumber);

    let wins = 0;
    let losses = 0;

    for (const g of teamGames) {
      const isHome = g.homeTeamId === team.id;
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;

      if (teamScore > oppScore) {
        wins++;
      } else {
        losses++;
      }
    }

    const totalGames = wins + losses;
    const pct = totalGames > 0 ? wins / totalGames : 0;
    
    // Format PCT as standard 3-decimal string (e.g. .500, .625, etc.)
    const pctString = totalGames > 0
      ? (wins / totalGames).toFixed(3).replace(/^0/, "")
      : ".000";

    // Calculate real streak
    let streak = "-";
    if (teamGames.length > 0) {
      let streakType: "W" | "L" | null = null;
      let streakCount = 0;

      // Walk backward from the most recent game
      for (let i = teamGames.length - 1; i >= 0; i--) {
        const g = teamGames[i];
        const isHome = g.homeTeamId === team.id;
        const teamScore = isHome ? g.homeScore : g.awayScore;
        const oppScore = isHome ? g.awayScore : g.homeScore;
        const won = teamScore > oppScore;
        const outcome = won ? "W" : "L";

        if (streakType === null) {
          streakType = outcome;
          streakCount = 1;
        } else if (streakType === outcome) {
          streakCount++;
        } else {
          break;
        }
      }
      streak = `${streakType}${streakCount}`;
    }

    return {
      ...team,
      wins,
      losses,
      pct,
      pctString,
      streak,
    };
  });

  // Sort function based on the selected sortBy mode
  const sortConference = (records: TeamRecord[]) => {
    return [...records].sort((a, b) => {
      if (sortBy === "pct") {
        if (b.pct !== a.pct) return b.pct - a.pct;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.city.localeCompare(b.city);
      } else if (sortBy === "wins") {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.pct !== a.pct) return b.pct - a.pct;
        return a.city.localeCompare(b.city);
      } else { // "losses"
        // Show team with highest losses first (rank 1)
        if (b.losses !== a.losses) return b.losses - a.losses;
        // Ties break by worse win percentage (lower win percentage first)
        if (a.pct !== b.pct) return a.pct - b.pct;
        return a.city.localeCompare(b.city);
      }
    });
  };

  const northConference = sortConference(
    calculatedRecords.filter((r) => r.conference === "Luzon")
  );
  
  const southConference = sortConference(
    calculatedRecords.filter((r) => r.conference === "VisMin")
  );

  return (
    <div className="space-y-8 relative">
      {/* Standings Banner & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3.5 bg-orange-500/10 rounded-2xl text-orange-500">
            <Trophy className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">League Standings</h3>
            <p className="text-zinc-500 text-sm font-semibold tracking-wide">
              Live Conference Seedings • {games.length} completed matches simulated
            </p>
          </div>
        </div>

        <button
          onClick={() => loadStandingsData(true)}
          disabled={refreshing}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl font-semibold cursor-pointer text-sm transition-all"
        >
          <RefreshCw className={`w-4 h-4 text-zinc-400 ${refreshing ? "animate-spin" : ""}`} />
          <span>Refresh Standings</span>
        </button>
      </div>

      {/* Ranking Mode Selector Segmented Control */}
      {!error && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/40 p-4 rounded-3xl border border-zinc-900/80 shadow-md">
          <div className="text-zinc-400 text-xs font-bold uppercase tracking-wider select-none flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            <span>Standing Sorting Mode</span>
          </div>
          <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-900 w-full sm:w-auto">
            <button
              onClick={() => setSortBy("pct")}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all duration-200 cursor-pointer ${
                sortBy === "pct"
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Win Percentage
            </button>
            <button
              onClick={() => setSortBy("wins")}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all duration-200 cursor-pointer ${
                sortBy === "wins"
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Most Wins
            </button>
            <button
              onClick={() => setSortBy("losses")}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all duration-200 cursor-pointer ${
                sortBy === "losses"
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Most Losses
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div className="text-center py-12 text-zinc-500">
          <p className="mb-4">{error}</p>
          <button
            onClick={() => loadStandingsData()}
            className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-all text-white"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* North Conference (Luzon) */}
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6 px-2">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-red-500/10 rounded-lg text-red-400 border border-red-500/20">
                  <Shield className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-lg font-bold text-white">North Conference</h4>
                  <p className="text-zinc-500 text-xs">Luzon Division</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full uppercase tracking-wider">
                Luzon
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-900">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-400 font-bold text-xs uppercase tracking-wider select-none">
                    <th className="py-4 px-4 text-center w-12">Rank</th>
                    <th className="py-4 px-6">Team</th>
                    <th className="py-4 px-3 text-center">W</th>
                    <th className="py-4 px-3 text-center">L</th>
                    <th className="py-4 px-4 text-center">PCT</th>
                    <th className="py-4 px-4 text-center">Streak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/50 bg-zinc-950/20">
                  {northConference.map((team, index) => {
                    const rank = index + 1;
                    const isUserTeam = team.id === userTeamId;
                    const isStreakWin = team.streak.startsWith("W");

                    return (
                      <tr
                        key={team.id}
                        className={`transition-all duration-150 relative ${
                          isUserTeam
                            ? "bg-orange-500/10 border-l-4 border-l-orange-500 border-y border-y-orange-500/25 text-white"
                            : "hover:bg-zinc-900/30 border-b border-zinc-900"
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-4 px-4 text-center font-bold">
                          <span
                            className={`inline-flex items-center justify-center text-xs w-6 h-6 rounded-md ${
                              rank <= 8
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : "text-zinc-500"
                            }`}
                          >
                            {rank}
                          </span>
                        </td>

                        {/* Team Name */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            {isUserTeam && (
                              <Star className="w-3.5 h-3.5 text-orange-500 fill-orange-500 shrink-0" />
                            )}
                            <div>
                              <Link
                                href={`/dashboard/teams/${team.id}`}
                                className="font-bold text-zinc-200 block hover:text-orange-400 transition-colors"
                              >
                                {team.city}{" "}
                                <span className="text-zinc-400 font-semibold">{team.name}</span>
                              </Link>
                              {isUserTeam && (
                                <span className="text-[9px] font-extrabold text-orange-500 uppercase tracking-widest block mt-0.5">
                                  Your Franchise
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* W */}
                        <td className="py-4 px-3 text-center font-bold text-zinc-300">
                          {team.wins}
                        </td>

                        {/* L */}
                        <td className="py-4 px-3 text-center font-medium text-zinc-500">
                          {team.losses}
                        </td>

                        {/* PCT */}
                        <td className="py-4 px-4 text-center font-extrabold text-zinc-200">
                          {team.pctString}
                        </td>

                        {/* Streak */}
                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                              team.streak === "-"
                                ? "text-zinc-600 bg-zinc-900/50"
                                : isStreakWin
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                            }`}
                          >
                            {team.streak}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* South Conference (VisMin) */}
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6 px-2">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400 border border-cyan-500/20">
                  <Shield className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-lg font-bold text-white">South Conference</h4>
                  <p className="text-zinc-500 text-xs">VisMin Division</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full uppercase tracking-wider">
                VisMin
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-900">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-400 font-bold text-xs uppercase tracking-wider select-none">
                    <th className="py-4 px-4 text-center w-12">Rank</th>
                    <th className="py-4 px-6">Team</th>
                    <th className="py-4 px-3 text-center">W</th>
                    <th className="py-4 px-3 text-center">L</th>
                    <th className="py-4 px-4 text-center">PCT</th>
                    <th className="py-4 px-4 text-center">Streak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/50 bg-zinc-950/20">
                  {southConference.map((team, index) => {
                    const rank = index + 1;
                    const isUserTeam = team.id === userTeamId;
                    const isStreakWin = team.streak.startsWith("W");

                    return (
                      <tr
                        key={team.id}
                        className={`transition-all duration-150 relative ${
                          isUserTeam
                            ? "bg-orange-500/10 border-l-4 border-l-orange-500 border-y border-y-orange-500/25 text-white"
                            : "hover:bg-zinc-900/30 border-b border-zinc-900"
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-4 px-4 text-center font-bold">
                          <span
                            className={`inline-flex items-center justify-center text-xs w-6 h-6 rounded-md ${
                              rank <= 8
                                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                : "text-zinc-500"
                            }`}
                          >
                            {rank}
                          </span>
                        </td>

                        {/* Team Name */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            {isUserTeam && (
                              <Star className="w-3.5 h-3.5 text-orange-500 fill-orange-500 shrink-0" />
                            )}
                            <div>
                              <Link
                                href={`/dashboard/teams/${team.id}`}
                                className="font-bold text-zinc-200 block hover:text-orange-400 transition-colors"
                              >
                                {team.city}{" "}
                                <span className="text-zinc-400 font-semibold">{team.name}</span>
                              </Link>
                              {isUserTeam && (
                                <span className="text-[9px] font-extrabold text-orange-500 uppercase tracking-widest block mt-0.5">
                                  Your Franchise
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* W */}
                        <td className="py-4 px-3 text-center font-bold text-zinc-300">
                          {team.wins}
                        </td>

                        {/* L */}
                        <td className="py-4 px-3 text-center font-medium text-zinc-500">
                          {team.losses}
                        </td>

                        {/* PCT */}
                        <td className="py-4 px-4 text-center font-extrabold text-zinc-200">
                          {team.pctString}
                        </td>

                        {/* Streak */}
                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                              team.streak === "-"
                                ? "text-zinc-600 bg-zinc-900/50"
                                : isStreakWin
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                            }`}
                          >
                            {team.streak}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
