"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import {
  generateScheduleAction,
  getLeagueDayGames,
  simulateGameAction,
  simulateRemainingDayGames,
  getGameBoxScore,
  simulateBatchDaysAction,
} from "@/app/actions/leagueEngine";
import {
  Calendar,
  Play,
  Users,
  Award,
  TrendingUp,
  Loader2,
  Sparkles,
  ChevronRight,
  MapPin,
  Trophy,
  X,
} from "lucide-react";

interface Team {
  id: string;
  name: string;
  city: string;
  conference: "Luzon" | "VisMin";
  budget: number;
}

interface Game {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  seasonYear: number;
  gameNumber: number;
  status: string;
  homeScore: number;
  awayScore: number;
  homeTeam: Team;
  awayTeam: Team;
}

interface BoxScoreStat {
  id: string;
  gameId: string;
  playerId: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  player: {
    id: string;
    firstName: string;
    lastName: string;
    isFilAm: boolean;
    position: string;
  };
}

export default function SchedulePage() {
  const { userTeamId, currentLeagueDay, advanceDay, isSimulating, setSimulating, setTradeDeadlinePassed, setLeagueDay } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);

  // Box score modal state
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [boxScoreStats, setBoxScoreStats] = useState<BoxScoreStat[]>([]);
  const [loadingBoxScore, setLoadingBoxScore] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadDayGames = async () => {
    if (!userTeamId) return;
    try {
      setLoading(true);
      const data = (await getLeagueDayGames(currentLeagueDay)) as unknown as Game[];
      setGamesList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      loadDayGames();
    }
  }, [mounted, currentLeagueDay, userTeamId]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // Handle schedule generation
  const handleGenerateSchedule = async () => {
    setActionLoading(true);
    try {
      const res = await generateScheduleAction();
      if (res.success) {
        alert("Full 82-game schedule generated successfully!");
        loadDayGames();
      } else {
        alert(res.error || "Failed to generate schedule.");
      }
    } catch (err) {
      console.error(err);
      alert("Error generating schedule.");
    } finally {
      setActionLoading(false);
    }
  };

  // Simulate User Match
  const handleSimulateUserGame = async (gameId: string) => {
    setSimulating(true);
    try {
      const res = await simulateGameAction(gameId);
      if (res.success) {
        loadDayGames();
      } else {
        alert("Simulation failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Error simulating game.");
    } finally {
      setSimulating(false);
    }
  };

  // Simulate All Remaining Matches
  const handleSimulateRestOfDay = async () => {
    setSimulating(true);
    try {
      const res = await simulateRemainingDayGames(currentLeagueDay);
      if (res.success) {
        advanceDay();
      } else {
        alert("Simulation failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Error simulating remaining games.");
    } finally {
      setSimulating(false);
    }
  };

  const handleBatchSimulation = async (days: number) => {
    setSimulating(true);
    try {
      const res = await simulateBatchDaysAction(days);
      if (res.currentDay) {
        setLeagueDay(res.currentDay);
      }
      if (res.status === "DEADLINE_REACHED") {
        setTradeDeadlinePassed(true);
        setShowDeadlineModal(true);
      }
    } catch (err) {
      console.error(err);
      alert("Error executing batch simulation.");
    } finally {
      setSimulating(false);
    }
  };

  // View Box Score Modal Trigger
  const handleViewBoxScore = async (game: Game) => {
    setSelectedGame(game);
    setLoadingBoxScore(true);
    try {
      const stats = (await getGameBoxScore(game.id)) as unknown as BoxScoreStat[];
      // Sort players by points descending
      const sorted = stats.sort((a, b) => b.points - a.points);
      setBoxScoreStats(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBoxScore(false);
    }
  };

  const hasSchedule = gamesList.length > 0;
  const userGame = gamesList.find(
    (g) => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId
  );
  const otherGames = gamesList.filter(
    (g) => g.homeTeamId !== userTeamId && g.awayTeamId !== userTeamId
  );

  const isUserGamePlayed = userGame?.status === "Completed";
  const areAllGamesPlayed = gamesList.every((g) => g.status === "Completed");
  const hasRemainingCpuGames = gamesList.some(
    (g) => g.status === "Scheduled" && g.id !== userGame?.id
  );

  return (
    <div className="space-y-8 relative">
      {/* Simulation Overlay */}
      {isSimulating && (
        <div className="fixed inset-0 bg-zinc-950/70 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
          <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl text-center shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            <h3 className="text-xl font-bold text-white">Simulating Matchups...</h3>
            <p className="text-zinc-400 text-sm max-w-xs">Running core game engine algorithms and generating individual player box scores.</p>
          </div>
        </div>
      )}

      {/* Main Header / Status Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-orange-500/10 rounded-2xl text-orange-500">
            <Calendar className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">League Calendar</h3>
            <p className="text-zinc-500 text-sm font-semibold tracking-wide">
              {hasSchedule ? `Regular Season Schedule • Day ${currentLeagueDay} of 82` : "No schedule active"}
            </p>
          </div>
        </div>

        {hasSchedule && (
          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            {/* Advance day button */}
            {areAllGamesPlayed && (
              <button
                onClick={() => advanceDay()}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-sm shadow-[0_4px_15px_rgba(249,115,22,0.2)] hover:scale-[1.01] cursor-pointer transition-all"
              >
                <span>Advance to Day {currentLeagueDay + 1}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {/* Simulate Day */}
            {!areAllGamesPlayed && (
              <button
                onClick={() => handleBatchSimulation(1)}
                disabled={isSimulating}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl font-semibold cursor-pointer text-sm transition-all"
              >
                <Play className="w-4 h-4 text-zinc-400" />
                <span>Simulate Day</span>
              </button>
            )}

            {/* Simulate Week */}
            <button
              onClick={() => handleBatchSimulation(7)}
              disabled={isSimulating}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl font-semibold cursor-pointer text-sm transition-all"
            >
              <Calendar className="w-4 h-4 text-zinc-400" />
              <span>Simulate Week (7 Days)</span>
            </button>

            {/* Simulate Month */}
            <button
              onClick={() => handleBatchSimulation(30)}
              disabled={isSimulating}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl font-semibold cursor-pointer text-sm transition-all"
            >
              <TrendingUp className="w-4 h-4 text-zinc-400" />
              <span>Simulate Month (30 Days)</span>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      ) : !hasSchedule ? (
        /* Empty State Schedule Generation Banner */
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-12 text-center max-w-3xl mx-auto shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-500/5 blur-[80px] rounded-full pointer-events-none" />
          <Trophy className="w-16 h-16 text-zinc-700 mx-auto mb-6" />
          <h3 className="text-3xl font-extrabold text-white tracking-tight mb-3">Season Scaffolding Pending</h3>
          <p className="text-zinc-400 text-base max-w-md mx-auto mb-8">
            The PBA season calendar is blank. Generate the full 82-game schedule to start playing games, managing rosters, and simulating matchups.
          </p>
          <button
            onClick={handleGenerateSchedule}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-extrabold text-sm shadow-[0_4px_20px_rgba(249,115,22,0.3)] hover:scale-[1.02] cursor-pointer transition-all active:scale-[0.98]"
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>Generate 82-Game Schedule</span>
          </button>
        </div>
      ) : (
        /* Schedule views */
        <div className="space-y-8">
          {/* 1. Featured User Game Card */}
          {userGame && (
            <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-orange-500/30 rounded-3xl p-6 md:p-8 shadow-2xl shadow-orange-500/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 px-3 py-1 bg-orange-500/10 text-orange-400 text-[10px] uppercase font-bold tracking-widest rounded-bl-2xl border-l border-b border-orange-500/20">
                Franchise Matchup
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                {/* Home Team */}
                <div className="text-center md:text-right flex-1">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide mb-2 ${
                      userGame.homeTeam.conference === "Luzon"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    }`}
                  >
                    {userGame.homeTeam.conference}
                  </span>
                  <h4 className="text-2xl font-bold text-white">{userGame.homeTeam.city}</h4>
                  <p className="text-xl text-zinc-400 font-extrabold">{userGame.homeTeam.name}</p>
                  {userGame.homeTeamId === userTeamId && (
                    <span className="text-[10px] font-bold text-orange-500 mt-1 block">Your Franchise (Home)</span>
                  )}
                </div>

                {/* Score / Simulation Controls */}
                <div className="text-center px-6 min-w-[200px] flex flex-col items-center">
                  {isUserGamePlayed ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex items-center gap-6 font-extrabold text-4xl tracking-tight text-white">
                        <span className={userGame.homeScore > userGame.awayScore ? "text-orange-500" : ""}>
                          {userGame.homeScore}
                        </span>
                        <span className="text-zinc-600 text-2xl font-semibold">VS</span>
                        <span className={userGame.awayScore > userGame.homeScore ? "text-orange-500" : ""}>
                          {userGame.awayScore}
                        </span>
                      </div>
                      <button
                        onClick={() => handleViewBoxScore(userGame)}
                        className="px-4 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        View Box Score
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <span className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold text-[10px] uppercase rounded-full">
                        Scheduled
                      </span>
                      <button
                        onClick={() => handleSimulateUserGame(userGame.id)}
                        className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm shadow-[0_4px_15px_rgba(249,115,22,0.3)] hover:scale-[1.02] cursor-pointer transition-all active:scale-[0.98]"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Simulate Match</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Away Team */}
                <div className="text-center md:text-left flex-1">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide mb-2 ${
                      userGame.awayTeam.conference === "Luzon"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    }`}
                  >
                    {userGame.awayTeam.conference}
                  </span>
                  <h4 className="text-2xl font-bold text-white">{userGame.awayTeam.city}</h4>
                  <p className="text-xl text-zinc-400 font-extrabold">{userGame.awayTeam.name}</p>
                  {userGame.awayTeamId === userTeamId && (
                    <span className="text-[10px] font-bold text-orange-500 mt-1 block">Your Franchise (Away)</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. Other Matches List */}
          <div className="space-y-4">
            <h4 className="text-lg font-bold text-white px-2">Other Games Around the PBA</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {otherGames.map((game) => {
                const isPlayed = game.status === "Completed";
                return (
                  <div
                    key={game.id}
                    className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 hover:border-zinc-800 transition-colors flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-3 font-semibold">
                      <span>Day {game.gameNumber}</span>
                      <span className={isPlayed ? "text-orange-500 font-bold" : "text-zinc-600"}>
                        {game.status}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-zinc-300">{game.homeTeam.city} {game.homeTeam.name}</span>
                        {isPlayed ? (
                          <span className={`font-extrabold ${game.homeScore > game.awayScore ? "text-orange-500" : "text-zinc-500"}`}>
                            {game.homeScore}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600">Home</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-zinc-300">{game.awayTeam.city} {game.awayTeam.name}</span>
                        {isPlayed ? (
                          <span className={`font-extrabold ${game.awayScore > game.homeScore ? "text-orange-500" : "text-zinc-500"}`}>
                            {game.awayScore}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600">Away</span>
                        )}
                      </div>
                    </div>

                    {isPlayed && (
                      <div className="mt-4 pt-3 border-t border-zinc-900 flex justify-end">
                        <button
                          onClick={() => handleViewBoxScore(game)}
                          className="text-[10px] font-bold text-zinc-400 hover:text-orange-500 transition-colors cursor-pointer"
                        >
                          View Stats
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. Box Score Modal */}
      {selectedGame && (
        <div className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center z-40 p-4 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-zinc-850 rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-y-auto flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-850 flex justify-between items-center sticky top-0 bg-zinc-900 z-10">
              <div>
                <h4 className="text-xl font-bold text-white">Box Score & Individual Player Stats</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  {selectedGame.homeTeam.city} {selectedGame.homeTeam.name} ({selectedGame.homeScore}) vs{" "}
                  {selectedGame.awayTeam.city} {selectedGame.awayTeam.name} ({selectedGame.awayScore})
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedGame(null);
                  setBoxScoreStats([]);
                }}
                className="p-1.5 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-850 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {loadingBoxScore ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Home Team Box Score */}
                  <div>
                    <h5 className="font-bold text-sm text-orange-500 uppercase tracking-wider mb-3 px-2">
                      {selectedGame.homeTeam.city} {selectedGame.homeTeam.name} Stats
                    </h5>
                    <div className="overflow-x-auto border border-zinc-850 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-950 text-zinc-400 font-bold border-b border-zinc-850 uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-4">Player</th>
                            <th className="py-3 px-2 text-center">Pos</th>
                            <th className="py-3 px-2 text-center">PTS</th>
                            <th className="py-3 px-2 text-center">REB</th>
                            <th className="py-3 px-2 text-center">AST</th>
                            <th className="py-3 px-2 text-center">STL</th>
                            <th className="py-3 px-2 text-center">BLK</th>
                            <th className="py-3 px-2 text-center">TO</th>
                            <th className="py-3 px-4 text-center">FG (M-A)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-850">

                          {/* Let's render the list properly */}
                          {boxScoreStats
                            .filter((s) => s.player && (s.player as any).teamId === selectedGame.homeTeamId)
                            .map((stat) => (
                              <tr key={stat.id} className="hover:bg-zinc-850/40">
                                <td className="py-3 px-4 font-bold text-zinc-200">
                                  {stat.player.firstName} {stat.player.lastName}
                                  {stat.player.isFilAm && (
                                    <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-extrabold bg-amber-500/10 text-amber-400">
                                      Fil-Am
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-2 text-center text-zinc-400 font-bold">{stat.player.position}</td>
                                <td className="py-3 px-2 text-center font-bold text-white">{stat.points}</td>
                                <td className="py-3 px-2 text-center font-semibold text-zinc-300">{stat.rebounds}</td>
                                <td className="py-3 px-2 text-center font-semibold text-zinc-300">{stat.assists}</td>
                                <td className="py-3 px-2 text-center text-zinc-400">{stat.steals}</td>
                                <td className="py-3 px-2 text-center text-zinc-400">{stat.blocks}</td>
                                <td className="py-3 px-2 text-center text-red-400">{stat.turnovers}</td>
                                <td className="py-3 px-4 text-center text-zinc-400 font-medium">
                                  {stat.fieldGoalsMade} - {stat.fieldGoalsAttempted}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Away Team Box Score */}
                  <div>
                    <h5 className="font-bold text-sm text-orange-500 uppercase tracking-wider mb-3 px-2">
                      {selectedGame.awayTeam.city} {selectedGame.awayTeam.name} Stats
                    </h5>
                    <div className="overflow-x-auto border border-zinc-850 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-950 text-zinc-400 font-bold border-b border-zinc-850 uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-4">Player</th>
                            <th className="py-3 px-2 text-center">Pos</th>
                            <th className="py-3 px-2 text-center">PTS</th>
                            <th className="py-3 px-2 text-center">REB</th>
                            <th className="py-3 px-2 text-center">AST</th>
                            <th className="py-3 px-2 text-center">STL</th>
                            <th className="py-3 px-2 text-center">BLK</th>
                            <th className="py-3 px-2 text-center">TO</th>
                            <th className="py-3 px-4 text-center">FG (M-A)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-850">
                          {boxScoreStats
                            .filter((s) => s.player && (s.player as any).teamId === selectedGame.awayTeamId)
                            .map((stat) => (
                              <tr key={stat.id} className="hover:bg-zinc-850/40">
                                <td className="py-3 px-4 font-bold text-zinc-200">
                                  {stat.player.firstName} {stat.player.lastName}
                                  {stat.player.isFilAm && (
                                    <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-extrabold bg-amber-500/10 text-amber-400">
                                      Fil-Am
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-2 text-center text-zinc-400 font-bold">{stat.player.position}</td>
                                <td className="py-3 px-2 text-center font-bold text-white">{stat.points}</td>
                                <td className="py-3 px-2 text-center font-semibold text-zinc-300">{stat.rebounds}</td>
                                <td className="py-3 px-2 text-center font-semibold text-zinc-300">{stat.assists}</td>
                                <td className="py-3 px-2 text-center text-zinc-400">{stat.steals}</td>
                                <td className="py-3 px-2 text-center text-zinc-400">{stat.blocks}</td>
                                <td className="py-3 px-2 text-center text-red-400">{stat.turnovers}</td>
                                <td className="py-3 px-4 text-center text-zinc-400 font-medium">
                                  {stat.fieldGoalsMade} - {stat.fieldGoalsAttempted}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Trade Deadline Interruption Modal */}
      {showDeadlineModal && (
        <div className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-500/5 blur-[60px] rounded-full pointer-events-none" />
            <span className="text-red-500 text-4xl block animate-bounce">🚨</span>
            <div>
              <h4 className="text-xl font-extrabold text-white tracking-tight">TRADE DEADLINE REACHED!</h4>
              <p className="text-zinc-400 text-sm mt-3 leading-relaxed">
                All trading windows across Luzon and VisMin will lock after today. Make your final front-office moves now.
              </p>
            </div>
            <button
              onClick={() => setShowDeadlineModal(false)}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-extrabold text-sm shadow-[0_4px_15px_rgba(249,115,22,0.3)] hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer"
            >
              Enter Front Office
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
