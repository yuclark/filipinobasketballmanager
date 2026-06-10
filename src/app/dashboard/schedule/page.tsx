"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import {
  generateScheduleAction,
  getLeagueDayGames,
  simulateGameAction,
  simulateRemainingDayGames,
  getGameBoxScore,
  simulateBatchDaysAction,
  simulateUntilPlayoffsAction,
  simulateWeekChunkAction,
} from "@/app/actions/leagueEngine";
import { initializePlayoffsAction } from "@/app/actions/playoffEngine";
import { getGameBoxScoreAction, getTeamScheduleAction } from "@/app/actions/statsEngine";

import {
  Calendar,
  Play,
  Users,
  Award,
  TrendingUp,
  Loader2,
  Sparkles,
  ChevronRight,
  ChevronLeft,

  MapPin,
  Trophy,
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
  const router = useRouter();
  const [isSimulating, setIsSimulating] = useState(false);
  const stopSimulationRef = useRef(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { userTeamId, currentLeagueDay, advanceDay, setSimulating: storeSetSimulating, setTradeDeadlinePassed, setLeagueDay } = useGameStore();

  const setSimulating = (val: boolean) => {
    setIsSimulating(val);
    storeSetSimulating(val);
  };

  const [mounted, setMounted] = useState(false);
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [hasConfirmedDeadline, setHasConfirmedDeadline] = useState(false);
  const [pendingDays, setPendingDays] = useState<number>(0);
  const [isMacroSimPlayoffs, setIsMacroSimPlayoffs] = useState<boolean>(false);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Box score modal state
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [boxScoreStats, setBoxScoreStats] = useState<BoxScoreStat[]>([]);
  const [loadingBoxScore, setLoadingBoxScore] = useState(false);
  const [teamSchedule, setTeamSchedule] = useState<any[]>([]);
  const [viewingDay, setViewingDay] = useState(currentLeagueDay);
  const [viewingDayGames, setViewingDayGames] = useState<Game[]>([]);
  const [loadingViewingDay, setLoadingViewingDay] = useState(false);



  useEffect(() => {
    setMounted(true);
  }, []);

  const loadDayGames = async () => {
    if (!userTeamId) return;
    try {
      setLoading(true);
      const data = (await getLeagueDayGames(currentLeagueDay)) as unknown as Game[];
      setGamesList(data);

      const schedule = await getTeamScheduleAction(userTeamId);
      setTeamSchedule(schedule);

      const vData = (await getLeagueDayGames(viewingDay)) as unknown as Game[];
      setViewingDayGames(vData);
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

  useEffect(() => {
    setViewingDay(currentLeagueDay);
  }, [currentLeagueDay]);

  const loadViewingDayGames = async () => {
    if (!userTeamId) return;
    try {
      setLoadingViewingDay(true);
      const data = (await getLeagueDayGames(viewingDay)) as unknown as Game[];
      setViewingDayGames(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingViewingDay(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      loadViewingDayGames();
    }
  }, [mounted, viewingDay, userTeamId]);


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
        alert("Failed to generate schedule. Please try again.");
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

  const handleBatchSimulation = async (days: number, bypass: boolean = false) => {
    setIsMacroSimPlayoffs(false);
    setPendingDays(days);
    setSimulating(true);
    stopSimulationRef.current = false;
    let daysSimulated = 0;
    try {
      while (daysSimulated < days) {
        if (stopSimulationRef.current) {
          setToastMessage("Simulation paused by manager.");
          break;
        }

        const res = await simulateBatchDaysAction(1, bypass || hasConfirmedDeadline, userTeamId);
        
        if (res.currentDay) {
          setLeagueDay(res.currentDay);
        }

        if (res.status === "REGULAR_SEASON_COMPLETE") {
          router.push("/dashboard/awards");
          return;
        }

        if (res.status === "DEADLINE_REACHED") {
          setTradeDeadlinePassed(true);
          setShowDeadlineModal(true);
          setPendingDays(days - daysSimulated - 1);
          break;
        }

        if (res.status === "ERROR") {
          alert("Simulation failed. Please check team states and try again.");
          break;
        }

        daysSimulated++;

        // Refresh games list in client
        const currentDay = res.currentDay ?? currentLeagueDay;
        const data = (await getLeagueDayGames(currentDay)) as unknown as Game[];
        setGamesList(data);
        setViewingDay(currentDay);


        // Small yield to allow React to re-render and detect state changes
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (userTeamId) {
        const schedule = await getTeamScheduleAction(userTeamId);
        setTeamSchedule(schedule);
      }
    } catch (err) {

      console.error(err);
      alert("Error executing batch simulation.");
    } finally {
      setSimulating(false);
    }
  };

  const handleFastForwardSimulation = async (bypass: boolean = false) => {
    setSimulating(true);
    stopSimulationRef.current = false;
    let currentDay = currentLeagueDay;
    const seasonYear = gamesList[0]?.seasonYear ?? 2026;

    try {
      while (currentDay <= 82) {
        if (stopSimulationRef.current) {
          setToastMessage("Simulation paused by manager.");
          break;
        }

        const res = await simulateWeekChunkAction(
          currentDay,
          seasonYear,
          bypass || hasConfirmedDeadline,
          userTeamId
        );

        if (res.status === "REGULAR_SEASON_COMPLETE") {
          setLeagueDay(82);
          router.push("/dashboard/awards");
          return;
        }

        if (res.status === "DEADLINE_REACHED") {
          setTradeDeadlinePassed(true);
          setShowDeadlineModal(true);
          setPendingDays(82 - currentDay + 1);
          break;
        }

        if (res.status === "ERROR") {
          alert("Simulation failed. Please check team states and try again.");
          break;
        }

        if (res.status === "CHUNK_COMPLETE" && res.nextDay) {
          currentDay = res.nextDay;
          setLeagueDay(currentDay);
          const data = (await getLeagueDayGames(currentDay)) as unknown as Game[];
          setGamesList(data);
          setViewingDay(currentDay);
        } else {

          break;
        }

        // Small yield to allow React to re-render and detect state changes
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (userTeamId) {
        const schedule = await getTeamScheduleAction(userTeamId);
        setTeamSchedule(schedule);
      }
    } catch (err) {
      console.error(err);
      alert("Error executing simulation.");
    } finally {
      setSimulating(false);
    }
  };

  const handleAdvanceToPlayoffs = async () => {
    setActionLoading(true);
    try {
      const res = await initializePlayoffsAction();
      if (res.success) {
        alert("Playoffs initialized successfully! Redirecting to Postseason Tournament.");
        router.push("/dashboard/playoffs");
      } else {
        alert("Failed to initialize playoffs. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Error initializing playoffs.");
    } finally {
      setActionLoading(false);
    }
  };

  // View Box Score Trigger
  const handleGameClick = async (game: any) => {
    if (game.status !== 'Completed') return;

    setSelectedGame(game);
    setLoadingBoxScore(true);
    try {
      const boxScore = await getGameBoxScoreAction(game.id);

      const isHome = game.homeTeamId === userTeamId;
      const userTeamName = game.userTeamName || (isHome ? (game.homeTeam?.name || "Home Team") : (game.awayTeam?.name || "Away Team"));
      const opponentName = game.opponentName || (isHome ? (game.awayTeam?.name || "Away Team") : (game.homeTeam?.name || "Home Team"));
      const userScore = game.userScore !== undefined ? game.userScore : (isHome ? game.homeScore : game.awayScore);
      const opponentScore = game.opponentScore !== undefined ? game.opponentScore : (isHome ? game.awayScore : game.homeScore);
      const userWon = game.userWon !== undefined ? game.userWon : (isHome ? (game.homeScore > game.awayScore) : (game.awayScore > game.homeScore));

      setSelectedGame({
        ...game,
        userTeamName,
        opponentName,
        userScore,
        opponentScore,
        userWon,
        userBoxScore: isHome ? boxScore.userTeam : boxScore.opponentTeam,
        opponentBoxScore: isHome ? boxScore.opponentTeam : boxScore.userTeam,
      });
    } catch (err) {
      console.error('Failed to load box score:', err);
    } finally {
      setLoadingBoxScore(false);
    }
  };


  const hasSchedule = gamesList.length > 0;
  const userGame = gamesList.find(
    (g) => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId
  );
  const otherGames = viewingDayGames.filter(
    (g) => g.homeTeamId !== userTeamId && g.awayTeamId !== userTeamId
  );


  const isUserGamePlayed = userGame?.status === "Completed";
  const areAllGamesPlayed = gamesList.every((g) => g.status === "Completed");
  const hasRemainingCpuGames = gamesList.some(
    (g) => g.status === "Scheduled" && g.id !== userGame?.id
  );

  return (
    <div className="space-y-8 relative">
      {/* Simulation Overlay Blocker */}
      {isSimulating && (
        <div className="fixed inset-0 bg-black/15 z-40 cursor-wait backdrop-blur-[1px]" />
      )}

      {/* Main Header / Status Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-xl relative z-50">
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
            {isSimulating ? (
              <div className="flex items-center gap-3">
                <button
                  disabled
                  className="flex items-center gap-2 px-5 py-3 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-xl font-bold text-sm animate-pulse cursor-not-allowed"
                >
                  <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                  <span>Simulating Calendar (Day {currentLeagueDay} / 82)...</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopSimulationRef.current = true;
                  }}
                  disabled={!isSimulating}
                  className="flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(220,38,38,0.2)] hover:scale-[1.01] active:scale-[0.98] cursor-pointer transition-all"
                >
                  <span>🛑 Stop Simulating</span>
                </button>
              </div>
            ) : currentLeagueDay === 82 && areAllGamesPlayed ? (
              <button
                onClick={handleAdvanceToPlayoffs}
                disabled={actionLoading}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-extrabold text-sm shadow-[0_4px_20px_rgba(249,115,22,0.3)] hover:scale-[1.01] cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Trophy className="w-4 h-4 text-white" />
                <span>🏆 Advance to Postseason Playoffs</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <>
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

                {/* Simulate Until Playoffs */}
                <button
                  onClick={() => {
                    setIsMacroSimPlayoffs(true);
                    handleFastForwardSimulation();
                  }}
                  disabled={isSimulating}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-xl font-bold cursor-pointer text-sm transition-all shadow-[0_2px_8px_rgba(249,115,22,0.1)] hover:scale-[1.01] active:scale-[0.98]"
                >
                  <FastForward className="w-4 h-4 text-orange-400" />
                  <span>Simulate Until Playoffs</span>
                </button>
              </>
            )}
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
            The FBM season calendar is blank. Generate the full 82-game schedule to start playing games, managing rosters, and simulating matchups.
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
                        onClick={() => handleGameClick(userGame)}
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
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-[13px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">
                Other Games Around the FBM
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingDay(d => Math.max(1, d - 1))}
                  disabled={viewingDay <= 1 || loadingViewingDay}
                  className="p-1.5 rounded-md hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[12px] font-medium text-[var(--color-text-muted)] min-w-[50px] text-center">
                  Day {viewingDay}
                </span>
                <button
                  type="button"
                  onClick={() => setViewingDay(d => Math.min(82, d + 1))}
                  disabled={viewingDay >= 82 || loadingViewingDay}
                  className="p-1.5 rounded-md hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {otherGames.map((game) => {
                const isPlayed = game.status === "Completed";
                return (
                  <div
                    key={game.id}
                    onClick={() => game.status === 'Completed' && handleGameClick(game)}
                    className={`bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 hover:border-zinc-800 transition-colors flex flex-col justify-between ${
                      game.status === 'Completed' ? 'cursor-pointer hover:border-[var(--color-border-strong)]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-3 font-semibold">
                      <span>Day {game.gameNumber}</span>
                      {game.status === 'Completed' ? (
                        <span className="text-[11px] font-bold text-[var(--color-text-muted)]">
                          {game.homeScore} – {game.awayScore}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--color-text-faint)]">Scheduled</span>
                      )}
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

                    {game.status === 'Completed' && (
                      <div className="flex items-center gap-1 mt-2 text-[var(--color-primary)]">
                        <span className="text-[10px] font-medium">Box Score</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>


          {/* 3. Team Season Schedule */}
          <div className="space-y-4">
            <h4 className="text-lg font-bold text-white px-2">Team Season Schedule & Results</h4>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)] text-[10px] font-bold tracking-wider uppercase text-[var(--color-text-faint)]">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Opponent</th>
                      <th className="px-4 py-3">Score / Status</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamSchedule.map((game) => {
                      const isCompleted = game.status === 'Completed';
                      return (
                        <tr
                          key={game.id}
                          className={`
                            border-b border-[var(--color-border)] last:border-0 transition-colors duration-100
                            ${isCompleted
                              ? 'hover:bg-[var(--color-surface-2)] cursor-pointer'
                              : 'opacity-60'
                            }
                          `}
                          onClick={() => isCompleted && handleGameClick(game)}
                        >
                          {/* Date cell */}
                          <td className="px-4 py-3 text-[13px] text-[var(--color-text-muted)]">{game.date}</td>

                          {/* Opponent cell */}
                          <td className="px-4 py-3 text-[13px] font-semibold text-[var(--color-text)]">{game.opponentName}</td>

                          {/* Score cell — show actual score for completed, "vs" for upcoming */}
                          <td className="px-4 py-3">
                            {isCompleted ? (
                              <div className="flex items-center gap-2">
                                <span className={`text-[13px] font-bold font-display ${game.userWon ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                                  {game.userScore} – {game.opponentScore}
                                </span>
                                <span className={`text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded ${
                                  game.userWon
                                    ? 'bg-[var(--color-success-dim)] text-[var(--color-success)]'
                                    : 'bg-[var(--color-error-dim)] text-[var(--color-error)]'
                                }`}>
                                  {game.userWon ? 'W' : 'L'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[13px] text-[var(--color-text-faint)]">Upcoming</span>
                            )}
                          </td>

                          {/* Arrow for completed games */}
                          <td className="px-4 py-3 text-right">
                            {isCompleted ? (
                              <div className="flex items-center justify-end gap-1 text-[var(--color-primary)]">
                                <span className="text-[11px] font-medium">Box Score</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <span className="text-[11px] text-[var(--color-text-faint)]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Box Score Modal */}
      {selectedGame && (
        <div className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center z-40 p-4 backdrop-blur-xs">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
            onClick={() => setSelectedGame(null)}
          />

          {/* Modal panel */}
          <div className="relative z-10 w-full max-w-4xl max-h-[85vh] overflow-y-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-surface)] z-10">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-[var(--color-text-muted)]">{selectedGame.date}</span>
                  <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded ${
                    selectedGame.userWon
                      ? 'bg-[var(--color-success-dim)] text-[var(--color-success)]'
                      : 'bg-[var(--color-error-dim)] text-[var(--color-error)]'
                  }`}>
                    {selectedGame.userWon ? 'WIN' : 'LOSS'}
                  </span>
                </div>
                <h2 className="font-display text-xl font-bold tracking-tight mt-1 text-white">
                  {selectedGame.userTeamName} <span className="text-[var(--color-primary)]">{selectedGame.userScore}</span>
                  <span className="text-[var(--color-text-faint)] mx-2">—</span>
                  <span className="text-[var(--color-primary)]">{selectedGame.opponentScore}</span> {selectedGame.opponentName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGame(null)}
                className="p-2 rounded-lg hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingBoxScore ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
            ) : (
              <>
                {/* Box Score — User Team */}
                <div className="px-6 py-4">
                  <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--color-text-faint)] mb-3">
                    {selectedGame.userTeamName}
                  </p>
                  <BoxScoreTable players={selectedGame.userBoxScore} />
                </div>

                <div className="border-t border-[var(--color-border)]" />

                {/* Box Score — Opponent Team */}
                <div className="px-6 py-4">
                  <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--color-text-faint)] mb-3">
                    {selectedGame.opponentName}
                  </p>
                  <BoxScoreTable players={selectedGame.opponentBoxScore} />
                </div>
              </>
            )}
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
                All trading windows across Luzon and VisMin will lock after today. Make your final front-office moves now, or confirm to bypass and lock trades.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  setShowDeadlineModal(false);
                  setHasConfirmedDeadline(true);
                  setTradeDeadlinePassed(true);
                  // Re-trigger with bypass flag set to true
                  if (isMacroSimPlayoffs) {
                    await handleFastForwardSimulation(true);
                  } else {
                    await handleBatchSimulation(pendingDays, true);
                  }
                }}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-extrabold text-sm shadow-[0_4px_15px_rgba(249,115,22,0.3)] hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer"
              >
                Confirm & Proceed to Simulation
              </button>
              <button
                onClick={() => setShowDeadlineModal(false)}
                className="w-full py-3 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 rounded-xl font-bold text-sm border border-zinc-850 transition-all cursor-pointer"
              >
                Review Trade Options
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-in custom toast alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-zinc-950 border border-zinc-800 text-zinc-100 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50 animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />
          <span className="font-bold text-sm">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

function BoxScoreTable({ players }: { players: any[] }) {
  if (!players || players.length === 0) {
    return <p className="text-[13px] text-[var(--color-text-faint)]">No box score data available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            {['Player', 'POS', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TO', 'FGM/A', '3PM/A', 'FTM/A'].map(col => (
              <th key={col} className="text-left px-3 py-2 text-[10px] font-semibold tracking-[0.1em] uppercase text-[var(--color-text-faint)] whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player, i) => (
            <tr key={i} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)] transition-colors">
              <td className="px-3 py-2">
                <span className="text-[13px] font-semibold text-white">{player.name}</span>
                {player.isFilAm && (
                  <span className="ml-1.5 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                    FIL-AM
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-[12px] text-[var(--color-text-muted)]">{player.position}</td>
              <td className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">{player.minutes ?? 0}</td>
              <td className="px-3 py-2 text-[13px] font-bold text-[var(--color-text)]">{player.points ?? 0}</td>
              <td className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">{player.rebounds ?? 0}</td>
              <td className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">{player.assists ?? 0}</td>
              <td className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">{player.steals ?? 0}</td>
              <td className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">{player.blocks ?? 0}</td>
              <td className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">{player.turnovers ?? 0}</td>
              <td className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">{player.fgm ?? 0}/{player.fga ?? 0}</td>
              <td className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">{player.threepm ?? 0}/{player.threepa ?? 0}</td>
              <td className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">{player.ftm ?? 0}/{player.fta ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

