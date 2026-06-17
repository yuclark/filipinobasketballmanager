"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { getPlayoffBracketAction } from "@/app/actions/playoffEngine";
import { getStandingsDataAction } from "@/app/actions/leagueEngine";
import { getTeamSalarySpace } from "@/app/actions/transactions";
import {
  generateRookiePoolAction,
  processPlayerEvolutionAction,
  executeDraftPickAction,
  getDraftProspectsAction,
  getUserDraftPicksAction,
  runOffseasonFreeAgencyAction,
  getDraftSessionPicksAction,
  simulateCpuPicksAction,
  autoCompleteDraftAction,
  initializeDraftSessionAction,
  getDraftHistoryAction,
} from "@/app/actions/offseasonEngine";
import {
  getExpiringPlayersAction,
  reSignPlayerAction,
  runCpuReSigningsAction,
  getDraftLotteryPicksAction,
  finalizeOffseasonAction,
  finalizeLotteryAction,
  getCurrentOffseasonStateAction,
  updateOffseasonPhaseAction,
} from "@/app/actions/offseasonWizard";
import {
  Trophy,
  Loader2,
  Sparkles,
  Award,
  Users,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Coins,
  ChevronRight,
  Shield,
  HelpCircle,
  CheckCircle,
  Briefcase,
  UserPlus,
  Flame,
  X,
} from "lucide-react";
import { getTeamRoster } from "@/app/actions";
import PlayerAvatar from "@/components/PlayerAvatar";

interface Team {
  id: string;
  name: string;
  city: string;
  conference: "Luzon" | "VisMin";
  budget: number;
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  overall: number;
  position: string;
  salary: number;
  contractYearsRemaining: number;
  status: string;
  yearsPlayed?: number;
  demand?: number;
}

interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  hometown: string;
  isFilAm: boolean;
  overall: number;
  salary: number;
  position: string;
  threePoint: number;
  insideScoring: number;
  playmaking: number;
  perimeterDefense: number;
  interiorDefense: number;
  rebounding: number;
  speed: number;
  stamina: number;
}

interface DraftPick {
  team: { id: string; name: string; city: string; conference?: "Luzon" | "VisMin"; budget?: number };
  player: { firstName: string; lastName: string; position: string; overall: number; id?: string };
  pickNumber: number;
}

const SALARY_CAP = 50000000;

export default function OffseasonWizardPage() {
  const router = useRouter();
  const { userTeamId, setLeagueDay, triggerAutosave } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playoffs completeness validation
  const [isPlayoffsConcluded, setIsPlayoffsConcluded] = useState(false);
  const [championTeam, setChampionTeam] = useState<any>(null);

  // 5-Phase Wizard State
  const [currentPhase, setCurrentPhase] = useState<number>(1);
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);

  // Phase 1: Re-Signings State
  const [expiringPlayers, setExpiringPlayers] = useState<Player[]>([]);
  const [reSignedPlayerIds, setReSignedPlayerIds] = useState<string[]>([]);
  const [declinedPlayerIds, setDeclinedPlayerIds] = useState<string[]>([]);
  const [totalSalaries, setTotalSalaries] = useState<number>(0);
  const [userBudget, setUserBudget] = useState<number>(50000000);
  const [userDeadCap, setUserDeadCap] = useState<number>(0);
  const [cpuReSignLogs, setCpuReSignLogs] = useState<string[]>([]);
  const [cpuReSignSimulated, setCpuReSignSimulated] = useState<boolean>(false);
  const [submittingExtensions, setSubmittingExtensions] = useState<boolean>(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardSuccess, setWizardSuccess] = useState<string | null>(null);
  const [userTeamDetails, setUserTeamDetails] = useState<any>(null);
  const [dbRoster, setDbRoster] = useState<any[]>([]);

  // Phase 2: Evolution State
  const [evolutionLogs, setEvolutionLogs] = useState<string[]>([]);
  const [evolutionSimulated, setEvolutionSimulated] = useState<boolean>(false);
  const [evolving, setEvolving] = useState<boolean>(false);

  // Phase 3: Draft Lottery State
  const [lotteryOddsList, setLotteryOddsList] = useState<any[]>([]);
  const [lotteryDraws, setLotteryDraws] = useState<Team[]>([]);
  const [draftOrder, setDraftOrder] = useState<Team[]>([]);
  const [lotteryRun, setLotteryRun] = useState<boolean>(false);
  const [lotteryRunning, setLotteryRunning] = useState<boolean>(false);
  const [revealedLotteryPicks, setRevealedLotteryPicks] = useState<Record<number, Team>>({});
  const [lotteryRevealIndex, setLotteryRevealIndex] = useState<number>(14);

  // Phase 5: Launching state
  const [launching, setLaunching] = useState<boolean>(false);

  // Phase 4: Rookie Draft State
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspectId, setSelectedProspectId] = useState<string>("");
  const [currentPickIndex, setCurrentPickIndex] = useState<number>(0);
  const [pickHistory, setPickHistory] = useState<DraftPick[]>([]);
  const [draftingActive, setDraftingActive] = useState<boolean>(false);
  const [draftInitializing, setDraftInitializing] = useState<boolean>(false);
  const [draftInitError, setDraftInitError] = useState<string | null>(null);
  const [draftSessionActive, setDraftSessionActive] = useState<boolean>(false);

  // Phase 5: Launch State
  const [nextSeasonYear, setNextSeasonYear] = useState<number>(2027);

  // Draft Picks State
  const [userDraftPicks, setUserDraftPicks] = useState<any[]>([]);
  const [evolutionResults, setEvolutionResults] = useState<any>(null);
  const [showRegressions, setShowRegressions] = useState(false);
  const [sessionPicks, setSessionPicks] = useState<any[]>([]);
  const [evolutionTab, setEvolutionTab] = useState<"my-team" | "league-wide">("my-team");
  const [myTeamFilter, setMyTeamFilter] = useState<"all" | "improved" | "declined">("all");

  // Phase 5: Free Agency State
  const [freeAgencySimulated, setFreeAgencySimulated] = useState<boolean>(false);
  const [freeAgencyLogs, setFreeAgencyLogs] = useState<string[]>([]);
  const [freeAgencyRunning, setFreeAgencyRunning] = useState<boolean>(false);
  const [freeAgentsCount, setFreeAgentsCount] = useState<number>(0);

  // Derived state for offseason re-signings
  const pendingExpiringSalary = expiringPlayers
    .filter(p => !reSignedPlayerIds.includes(p.id))
    .reduce((sum, p) => sum + p.salary, 0);
  const displayTotalSalaries = totalSalaries - pendingExpiringSalary;

  const guaranteedCount = dbRoster.filter(p => p.contractYearsRemaining > 1).length;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Save state to localStorage to prevent losing progress on refresh
  const saveWizardState = (updates: any = {}) => {
    const state = {
      seasonYear: nextSeasonYear,
      draftSessionId: updates.draftSessionId !== undefined ? updates.draftSessionId : draftSessionId,
      currentPhase: updates.currentPhase ?? currentPhase,
      reSignedPlayerIds: updates.reSignedPlayerIds ?? reSignedPlayerIds,
      declinedPlayerIds: updates.declinedPlayerIds ?? declinedPlayerIds,
      cpuReSignLogs: updates.cpuReSignLogs ?? cpuReSignLogs,
      cpuReSignSimulated: updates.cpuReSignSimulated ?? cpuReSignSimulated,
      evolutionLogs: updates.evolutionLogs ?? evolutionLogs,
      evolutionSimulated: updates.evolutionSimulated ?? evolutionSimulated,
      draftOrder: updates.draftOrder ?? draftOrder,
      lotteryOddsList: updates.lotteryOddsList ?? lotteryOddsList,
      lotteryDraws: updates.lotteryDraws ?? lotteryDraws,
      lotteryRun: updates.lotteryRun ?? lotteryRun,
      currentPickIndex: updates.currentPickIndex ?? currentPickIndex,
      pickHistory: updates.pickHistory ?? pickHistory,
      freeAgencySimulated: updates.freeAgencySimulated !== undefined ? updates.freeAgencySimulated : freeAgencySimulated,
      freeAgencyLogs: updates.freeAgencyLogs !== undefined ? updates.freeAgencyLogs : freeAgencyLogs,
      evolutionResults: updates.evolutionResults !== undefined ? updates.evolutionResults : evolutionResults,
    };
    localStorage.setItem("filipino-basketball-manager-offseason-wizard", JSON.stringify(state));
  };

  const refreshDraftState = async (resolvedYear?: number) => {
    const targetYear = resolvedYear ?? nextSeasonYear;
    try {
      // 1. Reload offseason state from server
      const stateRes = await getCurrentOffseasonStateAction(targetYear, userTeamId);
      let serverSessionId: string | null = null;
      if (stateRes.success) {
        setCurrentPhase(stateRes.offseasonPhase);
        setDraftSessionActive(stateRes.hasActiveDraftSession);
        if (stateRes.draftSessionId) {
          setDraftSessionId(stateRes.draftSessionId);
          serverSessionId = stateRes.draftSessionId;
        }
      }

      // 2. Reload prospects
      const prospectsRes = await getDraftProspectsAction(targetYear);
      if (prospectsRes.success && prospectsRes.prospects) {
        setProspects(prospectsRes.prospects as Prospect[]);
        if (prospectsRes.prospects.length > 0) {
          setSelectedProspectId(prospectsRes.prospects[0].id);
        }
      }

      // 3. Reload session picks
      const sessionRes = await getDraftSessionPicksAction(targetYear);
      if (sessionRes.success && sessionRes.picks) {
        setSessionPicks(sessionRes.picks);
        const usedPicks = sessionRes.picks.filter((p: any) => p.isUsed);
        setCurrentPickIndex(usedPicks.length);
      }

      // 4. Reload draft history
      const historyRes = await getDraftHistoryAction(targetYear);
      if (historyRes.success && historyRes.history) {
        setPickHistory(historyRes.history);
        saveWizardState({
          currentPickIndex: sessionPicks.filter((p: any) => p.isUsed).length,
          pickHistory: historyRes.history,
          draftSessionId: serverSessionId ?? undefined
        });
      }

      // 5. Reload user draft picks
      if (userTeamId) {
        const userPicksRes = await getUserDraftPicksAction(userTeamId);
        if (userPicksRes.success && userPicksRes.picks) {
          setUserDraftPicks(userPicksRes.picks);
        }
      }

      // 6. Router refresh
      router.refresh();
    } catch (e) {
      console.error("Failed to refresh draft state:", e);
    }
  };

  const loadWizardState = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Verify if playoffs are complete
      const bracketRes = await getPlayoffBracketAction();
      if (bracketRes.success && bracketRes.bracket) {
        const gfSeries = bracketRes.bracket.find((n: any) => n.round === "GrandFinals");
        const clinched = gfSeries && gfSeries.status === "Completed";
        
        if (clinched) {
          setIsPlayoffsConcluded(true);
          const champ = gfSeries.winnerId === gfSeries.teamA.id ? gfSeries.teamA : gfSeries.teamB;
          setChampionTeam(champ);
        } else {
          setIsPlayoffsConcluded(false);
          setLoading(false);
          return;
        }
      } else {
        setIsPlayoffsConcluded(false);
        setLoading(false);
        return;
      }

      // Check upcoming season year
      let upcomingYear = 2027;
      const standingsRes = await getStandingsDataAction();
      if (standingsRes.success && standingsRes.completedGames && standingsRes.completedGames.length > 0) {
        const yr = standingsRes.completedGames[0].seasonYear;
        upcomingYear = yr + 1;
      }
      setNextSeasonYear(upcomingYear);

      // Load server offseason state
      const serverStateRes = await getCurrentOffseasonStateAction(upcomingYear, userTeamId);
      let serverPhase = 1;
      let serverSessionId: string | null = null;
      if (serverStateRes.success) {
        serverPhase = serverStateRes.offseasonPhase;
        serverSessionId = serverStateRes.draftSessionId || null;
        setDraftSessionActive(serverStateRes.hasActiveDraftSession);
      }

      // Load from localStorage if present
      const saved = localStorage.getItem("filipino-basketball-manager-offseason-wizard");
      let loadedState: any = {};
      if (saved) {
        try {
          loadedState = JSON.parse(saved);
          
          const isStaleSession = serverSessionId && (!loadedState.draftSessionId || loadedState.draftSessionId !== serverSessionId);
          const isStaleYear = loadedState.seasonYear !== upcomingYear;
          
          if (isStaleYear || isStaleSession) {
            console.log(`[Offseason] Stale season/session wizard state in localStorage. Resetting. (isStaleYear: ${isStaleYear}, isStaleSession: ${isStaleSession})`);
            localStorage.removeItem("filipino-basketball-manager-offseason-wizard");
            loadedState = {};
            
            // Reset React state variables to default values
            setCpuReSignSimulated(false);
            setCpuReSignLogs([]);
            setEvolutionSimulated(false);
            setEvolutionLogs([]);
            setLotteryRun(false);
            setFreeAgencySimulated(false);
            setFreeAgencyLogs([]);
            setReSignedPlayerIds([]);
            setDeclinedPlayerIds([]);
            setEvolutionResults(null);
            setLotteryDraws([]);
            setDraftOrder([]);
            setLotteryOddsList([]);
            setCurrentPickIndex(0);
            setPickHistory([]);
          }
        } catch (e) {
          console.error("Failed to parse saved wizard state:", e);
        }
      }

      const resolvedPhase = serverStateRes.success ? serverPhase : (loadedState.currentPhase || 1);
      setCurrentPhase(resolvedPhase);

      if (serverSessionId) {
        setDraftSessionId(serverSessionId);
      } else if (loadedState.draftSessionId) {
        setDraftSessionId(loadedState.draftSessionId);
      }

      if (loadedState.reSignedPlayerIds) setReSignedPlayerIds(loadedState.reSignedPlayerIds);
      if (loadedState.declinedPlayerIds) setDeclinedPlayerIds(loadedState.declinedPlayerIds);
      if (loadedState.cpuReSignLogs) setCpuReSignLogs(loadedState.cpuReSignLogs);
      if (loadedState.cpuReSignSimulated) setCpuReSignSimulated(loadedState.cpuReSignSimulated);
      if (loadedState.evolutionLogs) setEvolutionLogs(loadedState.evolutionLogs);
      if (loadedState.evolutionSimulated) setEvolutionSimulated(loadedState.evolutionSimulated);
      if (loadedState.draftOrder) setDraftOrder(loadedState.draftOrder);
      if (loadedState.lotteryOddsList) setLotteryOddsList(loadedState.lotteryOddsList);
      if (loadedState.lotteryDraws) setLotteryDraws(loadedState.lotteryDraws);
      if (loadedState.lotteryRun) setLotteryRun(loadedState.lotteryRun);
      if (loadedState.currentPickIndex !== undefined) setCurrentPickIndex(loadedState.currentPickIndex);
      if (loadedState.freeAgencySimulated !== undefined) setFreeAgencySimulated(loadedState.freeAgencySimulated);
      if (loadedState.freeAgencyLogs) setFreeAgencyLogs(loadedState.freeAgencyLogs);
      if (loadedState.evolutionResults) setEvolutionResults(loadedState.evolutionResults);

      // Database-derived state overrides
      if (resolvedPhase >= 2) setCpuReSignSimulated(true);
      if (resolvedPhase >= 3) setEvolutionSimulated(true);
      if (resolvedPhase >= 4) setLotteryRun(true);
      if (resolvedPhase >= 6) setFreeAgencySimulated(true);

      // 2. Load context based on active phase
      if (userTeamId) {
        const rosterRes = await getTeamRoster(userTeamId);
        if (rosterRes) {
          setUserTeamDetails(rosterRes.team);
          setDbRoster(rosterRes.players);
        }
        // Fetch expiring players
        const expRes = await getExpiringPlayersAction(userTeamId);
        if (expRes.success && expRes.players) {
          setExpiringPlayers(expRes.players as Player[]);
        }

        // Fetch user salary space and budget
        const capRes = await getTeamSalarySpace(userTeamId);
        if (capRes.success) {
          setUserBudget(capRes.budget!);
          setTotalSalaries(capRes.totalSalaries!);
          setUserDeadCap(capRes.deadCap!);
        }

        // Load prospects if we are on draft phase
        const prospectsRes = await getDraftProspectsAction(upcomingYear);
        if (prospectsRes.success && prospectsRes.prospects) {
          setProspects(prospectsRes.prospects as Prospect[]);
          if (prospectsRes.prospects.length > 0) {
            setSelectedProspectId(prospectsRes.prospects[0].id);
          }
        }

        // Fetch user draft picks
        const picksRes = await getUserDraftPicksAction(userTeamId);
        if (picksRes.success && picksRes.picks) {
          setUserDraftPicks(picksRes.picks);
        }
      }

      // Fetch draft session picks
      const sessionRes = await getDraftSessionPicksAction(upcomingYear);
      if (sessionRes.success && sessionRes.picks) {
        setSessionPicks(sessionRes.picks);
        const usedPicks = sessionRes.picks.filter((p: any) => p.isUsed);
        setCurrentPickIndex(usedPicks.length);
      }

      // Fetch draft history from database
      const historyRes = await getDraftHistoryAction(upcomingYear);
      let resolvedHistory = [];
      if (historyRes.success && historyRes.history) {
        setPickHistory(historyRes.history);
        resolvedHistory = historyRes.history;
      } else if (loadedState.pickHistory) {
        setPickHistory(loadedState.pickHistory);
        resolvedHistory = loadedState.pickHistory;
      }

      // Sync state back to localStorage immediately
      saveWizardState({
        draftSessionId: serverSessionId,
        currentPhase: resolvedPhase,
        reSignedPlayerIds: loadedState.reSignedPlayerIds || [],
        declinedPlayerIds: loadedState.declinedPlayerIds || [],
        cpuReSignLogs: loadedState.cpuReSignLogs || [],
        cpuReSignSimulated: loadedState.cpuReSignSimulated || false,
        evolutionLogs: loadedState.evolutionLogs || [],
        evolutionSimulated: loadedState.evolutionSimulated || false,
        draftOrder: loadedState.draftOrder || [],
        lotteryOddsList: loadedState.lotteryOddsList || [],
        lotteryDraws: loadedState.lotteryDraws || [],
        lotteryRun: loadedState.lotteryRun || false,
        currentPickIndex: loadedState.currentPickIndex !== undefined ? loadedState.currentPickIndex : 0,
        freeAgencySimulated: loadedState.freeAgencySimulated !== undefined ? loadedState.freeAgencySimulated : false,
        freeAgencyLogs: loadedState.freeAgencyLogs || [],
        evolutionResults: loadedState.evolutionResults || null,
        pickHistory: resolvedHistory
      });
    } catch (err: any) {
      console.error(err);
      setError("Failed to load offseason wizard context.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      loadWizardState();
    }
  }, [mounted]);

  // Auto-initialize draft session when entering Phase 4
  useEffect(() => {
    if (mounted && currentPhase === 4 && !draftSessionActive && !draftInitializing && !draftInitError) {
      const initDraft = async () => {
        setDraftInitializing(true);
        setDraftInitError(null);
        try {
          const res = await initializeDraftSessionAction(nextSeasonYear);
          if (res.success) {
            setDraftSessionActive(true);
            console.log(`[Offseason] Draft session initialized for season ${nextSeasonYear}`);
            // Refresh session picks after initialization
            const sessionRes = await getDraftSessionPicksAction(nextSeasonYear);
            if (sessionRes.success && sessionRes.picks) {
              setSessionPicks(sessionRes.picks);
              const usedPicks = sessionRes.picks.filter((p: any) => p.isUsed);
              setCurrentPickIndex(usedPicks.length);
            }
          } else {
            setDraftInitError("Draft session initialization failed. Please try again.");
          }
        } catch (err: any) {
          console.error("[Offseason] Draft init error:", err);
          setDraftInitError(err.message || "Failed to initialize draft session.");
        } finally {
          setDraftInitializing(false);
        }
      };
      initDraft();
    }
  }, [mounted, currentPhase, nextSeasonYear, draftSessionActive, draftInitializing, draftInitError]);

  // Phase 1 Actions: Re-signing User Players
  const handleReSignPlayer = async (playerId: string, years: number, salary: number) => {
    try {
      setSubmittingExtensions(true);
      const res = await reSignPlayerAction(playerId, years, salary);
      if (res.success) {
        setReSignedPlayerIds((prev) => {
          const next = [...prev, playerId];
          saveWizardState({ reSignedPlayerIds: next });
          return next;
        });
        // Reload user salary space details to reflect the updated contract
        if (userTeamId) {
          const capRes = await getTeamSalarySpace(userTeamId);
          if (capRes.success) {
            setUserBudget(capRes.budget!);
            setTotalSalaries(capRes.totalSalaries!);
            setUserDeadCap(capRes.deadCap!);
            setDbRoster(capRes.roster || []);
          }
        }
        setWizardSuccess("Player re-signed successfully!");
        triggerAutosave();
      } else {
        setWizardError("Failed to re-sign player. Please verify that your team has enough budget or roster space.");
      }
    } catch (e: any) {
      console.error(e);
      setWizardError("Error re-signing player.");
    } finally {
      setSubmittingExtensions(false);
    }
  };

  const handleDeclinePlayer = (playerId: string) => {
    setDeclinedPlayerIds((prev) => {
      const next = [...prev, playerId];
      saveWizardState({ declinedPlayerIds: next });
      return next;
    });
  };

  const handleRunCpuExtensions = async () => {
    try {
      setSubmittingExtensions(true);
      const res = await runCpuReSigningsAction();
      if (res.success && res.logs) {
        setCpuReSignLogs(res.logs);
        setCpuReSignSimulated(true);
        saveWizardState({
          cpuReSignLogs: res.logs,
          cpuReSignSimulated: true
        });
        triggerAutosave();
      } else {
        setWizardError("Failed to run CPU extensions. Please try again.");
      }
    } catch (e: any) {
      console.error(e);
      setWizardError("Error running CPU extensions.");
    } finally {
      setSubmittingExtensions(false);
    }
  };

  const proceedToPhase2 = async () => {
    try {
      setLoading(true);
      const res = await updateOffseasonPhaseAction(nextSeasonYear, 2);
      if (res.success) {
        setCurrentPhase(2);
        saveWizardState({ currentPhase: 2 });
        triggerAutosave();
      } else {
        setWizardError(res.error || "Failed to proceed to Phase 2 on server.");
      }
    } catch (e: any) {
      console.error(e);
      setWizardError("Error proceeding to Phase 2.");
    } finally {
      setLoading(false);
    }
  };

  // Phase 2 Actions: Progression & Retirements
  const handleRunEvolution = async () => {
    try {
      setEvolving(true);
      const res = await processPlayerEvolutionAction();
      if (res.success && res.logs) {
        setEvolutionLogs(res.logs);
        if (res.evolutionResults) {
          setEvolutionResults(res.evolutionResults);
        }
        
        // B. Generate Rookie pool for the draft
        const poolRes = await generateRookiePoolAction(nextSeasonYear);
        if (!poolRes.success) {
          throw new Error(poolRes.error || "Failed to generate rookie pool.");
        }

        // C. Load prospects
        const prospectsRes = await getDraftProspectsAction();
        if (prospectsRes.success && prospectsRes.prospects) {
          setProspects(prospectsRes.prospects as Prospect[]);
          if (prospectsRes.prospects.length > 0) {
            setSelectedProspectId(prospectsRes.prospects[0].id);
          }
        }

        setEvolutionSimulated(true);
        saveWizardState({
          evolutionLogs: res.logs,
          evolutionSimulated: true,
          evolutionResults: res.evolutionResults,
        });
        triggerAutosave();
      } else {
        setWizardError("Failed to run player evolution. Please try again.");
      }
    } catch (e: any) {
      console.error(e);
      setWizardError("Error during evolution run.");
    } finally {
      setEvolving(false);
    }
  };

  const proceedToPhase3 = async () => {
    try {
      setLoading(true);
      const res = await updateOffseasonPhaseAction(nextSeasonYear, 3);
      if (res.success) {
        setCurrentPhase(3);
        saveWizardState({ currentPhase: 3 });
        triggerAutosave();
      } else {
        setWizardError(res.error || "Failed to proceed to Phase 3 on server.");
      }
    } catch (e: any) {
      console.error(e);
      setWizardError("Error proceeding to Phase 3.");
    } finally {
      setLoading(false);
    }
  };

  // Phase 3 Actions: Draft Lottery Draw
  const loadLotteryOdds = async () => {
    try {
      setLoading(true);
      const res = await getDraftLotteryPicksAction();
      if (res.success && res.lotteryOddsList && res.draftOrder && res.lotteryDraws) {
        setLotteryOddsList(res.lotteryOddsList);
        // We will store the final sequence in memory, but won't apply until drawing completes
        setDraftOrder(res.draftOrder as Team[]);
        setLotteryDraws(res.lotteryDraws as Team[]);
        saveWizardState({
          lotteryOddsList: res.lotteryOddsList,
          draftOrder: res.draftOrder,
          lotteryDraws: res.lotteryDraws,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentPhase === 3 && lotteryOddsList.length === 0) {
      loadLotteryOdds();
    }
  }, [currentPhase]);

  const handleRunLotteryDraw = () => {
    if (lotteryRunning || lotteryRun) return;
    setLotteryRunning(true);
    setLotteryRevealIndex(14);
    setRevealedLotteryPicks({});

    // Weighted drawing reveals from pick 14 down to pick 1
    // Picks 5-14 are determined by reverse record of non-drawn lottery teams
    // Picks 1-4 are the lottery draws.
    // Let's reveal them one-by-one with a visual animation delay
    let currentReveal = 14;
    
    // Determine the teams occupying picks 1 to 14 in the final draftOrder
    const finalLotteryPicks = draftOrder.slice(0, 14);

    const interval = setInterval(() => {
      if (currentReveal >= 1) {
        const teamForPick = finalLotteryPicks[currentReveal - 1];
        setRevealedLotteryPicks((prev) => ({
          ...prev,
          [currentReveal]: teamForPick,
        }));
        setLotteryRevealIndex(currentReveal - 1);
        currentReveal--;
      } else {
        clearInterval(interval);
        setLotteryRunning(false);
        setLotteryRun(true);
        saveWizardState({ lotteryRun: true });
      }
    }, 900);
  };

  const proceedToPhase4 = async () => {
    try {
      setLoading(true);
      setWizardError(null);
      const draftOrderIds = draftOrder.map((t) => t.id);
      const res = await finalizeLotteryAction(draftOrderIds, nextSeasonYear);
      if (res.success) {
        const sessionRes = await getDraftSessionPicksAction(nextSeasonYear);
        if (sessionRes.success && sessionRes.picks) {
          setSessionPicks(sessionRes.picks);
        }
        setDraftSessionActive(false);
        setDraftInitError(null);
        setCurrentPhase(4);
        saveWizardState({ currentPhase: 4 });
        triggerAutosave();
      } else {
        setWizardError(res.error || "Failed to finalize lottery picks in database.");
      }
    } catch (e: any) {
      console.error(e);
      setWizardError("Error finalizing lottery database order.");
    } finally {
      setLoading(false);
    }
  };

  // Phase 4 Actions: Rookie Draft Room
  const handleStartCpuPicks = async () => {
    if (draftingActive || !userTeamId) return;
    setDraftingActive(true);
    setWizardError(null);
    setWizardSuccess(null);
    try {
      const res = (await simulateCpuPicksAction(userTeamId, nextSeasonYear)) as any;
      if (res.success) {
        await refreshDraftState();
        if (res.status === "USER_ON_CLOCK") {
          setWizardSuccess("Simulation paused — your team is now on the clock.");
        } else if (res.status === "COMPLETED") {
          setWizardSuccess("Draft completed successfully.");
        }
        triggerAutosave();
      } else {
        setWizardError(res.error || res.message || "Simulation failed.");
      }
    } catch (e: any) {
      console.error(e);
      setWizardError(e.message || "Failed to run CPU draft simulation.");
    } finally {
      setDraftingActive(false);
    }
  };

  const handleCpuDraftForUser = async () => {
    if (draftingActive || !userTeamId) return;
    const currentPick = sessionPicks[currentPickIndex];
    if (!currentPick || currentPick.ownerTeamId !== userTeamId) return;

    if (prospects.length === 0) return;
    const bestPlayer = prospects.reduce((best, cur) => (cur.overall > best.overall ? cur : best), prospects[0]);

    setDraftingActive(true);
    setWizardError(null);
    setWizardSuccess(null);
    try {
      const res = await executeDraftPickAction(userTeamId, bestPlayer.id, currentPick.pickNumber!, nextSeasonYear);
      if (res.success) {
        await refreshDraftState();

        setDraftingActive(true);
        const cpuRes = (await simulateCpuPicksAction(userTeamId, nextSeasonYear)) as any;
        if (cpuRes.success) {
          await refreshDraftState();
          if (cpuRes.status === "USER_ON_CLOCK") {
            setWizardSuccess("Simulation paused — your team is now on the clock.");
          } else if (cpuRes.status === "COMPLETED") {
            setWizardSuccess("Draft completed successfully.");
          }
        }
        triggerAutosave();
      } else {
        setWizardError(res.error || "Failed to execute auto-draft pick.");
      }
    } catch (e: any) {
      console.error(e);
      setWizardError(e.message || "Failed to let CPU draft.");
    } finally {
      setDraftingActive(false);
    }
  };

  const handleAutoDraftEntireRemaining = async () => {
    if (draftingActive || !userTeamId) return;
    setDraftingActive(true);
    setWizardError(null);
    setWizardSuccess(null);
    try {
      const res = (await autoCompleteDraftAction(userTeamId, nextSeasonYear, false)) as any;
      if (res.success) {
        await refreshDraftState();
        setWizardSuccess("Draft completed successfully.");
        triggerAutosave();
      } else {
        setWizardError(res.error || res.message || "Simulation failed.");
      }
    } catch (e: any) {
      console.error(e);
      setWizardError(e.message || "Failed to auto-draft entire remaining draft.");
    } finally {
      setDraftingActive(false);
    }
  };

  const handleUserDraftPick = async () => {
    if (!selectedProspectId || draftingActive) return;

    const currentPick = sessionPicks[currentPickIndex];
    if (!currentPick || currentPick.ownerTeamId !== userTeamId) return;

    const selectedPlayer = prospects.find((p) => p.id === selectedProspectId);
    if (!selectedPlayer) return;

    setDraftingActive(true);
    setWizardError(null);
    setWizardSuccess(null);
    try {
      const res = await executeDraftPickAction(userTeamId!, selectedProspectId, currentPick.pickNumber!, nextSeasonYear);
      if (res.success) {
        await refreshDraftState();

        setDraftingActive(true);
        const cpuRes = (await simulateCpuPicksAction(userTeamId!, nextSeasonYear)) as any;
        if (cpuRes.success) {
          await refreshDraftState();
          if (cpuRes.status === "USER_ON_CLOCK") {
            setWizardSuccess("Simulation paused — your team is now on the clock.");
          } else if (cpuRes.status === "COMPLETED") {
            setWizardSuccess("Draft completed successfully.");
          }
        }
        triggerAutosave();
      } else {
        setWizardError("Failed to draft selected player. Please check your selection and try again.");
      }
    } catch (e) {
      console.error(e);
      setWizardError("Draft execution failed.");
    } finally {
      setDraftingActive(false);
    }
  };

  const proceedToPhase5 = async () => {
    try {
      setLoading(true);
      const res = await updateOffseasonPhaseAction(nextSeasonYear, 5);
      if (res.success) {
        setCurrentPhase(5);
        saveWizardState({ currentPhase: 5 });
        triggerAutosave();
      } else {
        setWizardError(res.error || "Failed to proceed to Phase 5 on server.");
      }
    } catch (e: any) {
      console.error(e);
      setWizardError("Error proceeding to Phase 5.");
    } finally {
      setLoading(false);
    }
  };

  const proceedToPhase6 = async () => {
    try {
      setLoading(true);
      const res = await updateOffseasonPhaseAction(nextSeasonYear, 6);
      if (res.success) {
        setCurrentPhase(6);
        saveWizardState({ currentPhase: 6 });
        triggerAutosave();
      } else {
        setWizardError(res.error || "Failed to proceed to Phase 6 on server.");
      }
    } catch (e: any) {
      console.error(e);
      setWizardError("Error proceeding to Phase 6.");
    } finally {
      setLoading(false);
    }
  };

  // Phase 5 Actions: Free Agency Simulation
  const handleSimulateFreeAgency = async () => {
    if (!userTeamId) return;
    setFreeAgencyRunning(true);
    setWizardError(null);
    try {
      const res = await runOffseasonFreeAgencyAction(userTeamId);
      if (res.success && res.cpuSignings) {
        setFreeAgencyLogs(res.cpuSignings);
        setFreeAgentsCount(res.freeAgentsRemaining ?? 0);
        setFreeAgencySimulated(true);
        saveWizardState({
          freeAgencySimulated: true,
          freeAgencyLogs: res.cpuSignings,
        });
        setWizardSuccess("CPU free agency simulation complete!");
        triggerAutosave();
      } else {
        setWizardError(res.error || "Failed to simulate CPU free agency.");
      }
    } catch (e: any) {
      console.error(e);
      setWizardError(e.message || "Failed to run offseason free agency.");
    } finally {
      setFreeAgencyRunning(false);
    }
  };

  // Phase 6 Actions: Pre-Season Launch
  const handleLaunchSeason = async () => {
    try {
      setLaunching(true);
      const res = await finalizeOffseasonAction();
      if (res.success) {
        localStorage.removeItem("filipino-basketball-manager-offseason-wizard");
        setLeagueDay(1);
        setWizardSuccess(`Season ${res.nextYear} launched! Redirecting to dashboard...`);
        triggerAutosave();
        setTimeout(() => router.push("/dashboard"), 1500);
      } else {
        setWizardError("Failed to launch season. Please check your roster requirements (12-18 players) and try again.");
        setLaunching(false);
      }
    } catch (e: any) {
      console.error(e);
      setWizardError("Failed to advance season.");
      setLaunching(false);
    }
  };

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // Render Lock Screen if Playoffs are ongoing
  if (!isPlayoffsConcluded) {
    return (
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-12 text-center max-w-3xl mx-auto shadow-2xl relative overflow-hidden my-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-500/5 blur-[80px] rounded-full pointer-events-none" />
        <Trophy className="w-16 h-16 text-zinc-700 mx-auto mb-6" />
        <h3 className="text-3xl font-extrabold text-white tracking-tight mb-4">Offseason Locked</h3>
        <p className="text-zinc-400 text-base max-w-md mx-auto leading-relaxed">
          Complete the current Postseason Tournament to unlock the front-office renewal cycle. A FBM champion must be crowned before you can transition to the offseason.
        </p>
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => router.push("/dashboard/playoffs")}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-bold text-sm border border-zinc-800 transition-all cursor-pointer"
          >
            <span>Go to Playoffs Bracket</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const phases = [
    { id: 1, name: "Re-Signings", desc: "Contract Extensions" },
    { id: 2, name: "Evolution", desc: "Roster Progression" },
    { id: 3, name: "Draft Lottery", desc: "Pick Drawing" },
    { id: 4, name: "Rookie Draft", desc: "Interactive Draft" },
    { id: 5, name: "Free Agency", desc: "CPU Signings" },
    { id: 6, name: "Pre-Season", desc: "Season Initialization" },
  ];

  const userTeam = draftOrder.find((t) => t.id === userTeamId);
  const currentPick = sessionPicks[currentPickIndex];
  const isUserTurn = currentPickIndex < 60 && currentPick?.ownerTeamId === userTeamId;

  return (
    <div className="space-y-8 relative pb-16">

      {/* Inline wizard notifications */}
      {wizardSuccess && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 font-semibold flex items-center justify-between">
          <span>✓ {wizardSuccess}</span>
          <button onClick={() => setWizardSuccess(null)} className="ml-4 text-emerald-400/60 hover:text-emerald-300 text-xs font-bold">✕</button>
        </div>
      )}
      {wizardError && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 font-semibold flex items-center justify-between">
          <span>✕ {wizardError}</span>
          <button onClick={() => setWizardError(null)} className="ml-4 text-red-400/60 hover:text-red-300 text-xs font-bold">✕</button>
        </div>
      )}

      {/* Wizard Progress Tracker Stepper */}
      <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-orange-500/10 rounded-xl text-orange-500">
              <Briefcase className="w-6 h-6 animate-pulse" />
            </span>
            <div>
              <h3 className="text-xl font-extrabold text-white tracking-tight">League Offseason Wizard</h3>
              <p className="text-zinc-500 text-xs font-semibold">
                Manage contract renewals, evolution reviews, lottery draws, and drafting rookies.
              </p>
            </div>
          </div>
          {championTeam && (
            <div className="text-right text-xs font-bold text-orange-400 bg-orange-500/5 border border-orange-500/15 rounded-xl px-4 py-2">
              🏆 Champion: {championTeam.city} {championTeam.name}
            </div>
          )}
        </div>

        {/* Stepper Steps UI */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {phases.map((p) => {
            const isActive = currentPhase === p.id;
            const isCompleted = currentPhase > p.id;

            return (
              <div 
                key={p.id}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between h-20 ${
                  isActive 
                    ? "bg-orange-500/10 border-orange-500/30 shadow-md shadow-orange-500/5"
                    : isCompleted
                    ? "bg-green-500/5 border-green-500/20 opacity-75"
                    : "bg-zinc-950/20 border-zinc-900/40 opacity-40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase ${isActive ? "text-orange-500" : isCompleted ? "text-green-400" : "text-zinc-500"}`}>
                    Phase {p.id}
                  </span>
                  {isCompleted && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
                </div>
                <div>
                  <span className={`text-xs font-extrabold block ${isActive ? "text-white" : "text-zinc-400"}`}>{p.name}</span>
                  <span className="text-[9px] text-zinc-500 font-semibold block">{p.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PHASE 1: Re-Signings */}
      {currentPhase === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User expiring players roster */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-900/20 border border-zinc-900 rounded-3xl p-6 space-y-4 shadow-lg">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-400" />
                  <h4 className="font-bold text-white text-base">Your Expiring Roster Contracts</h4>
                </div>
                <span className="text-xs font-bold text-zinc-400 bg-zinc-950 px-3 py-1 rounded-full border border-zinc-900">
                  {expiringPlayers.filter(p => !reSignedPlayerIds.includes(p.id) && !declinedPlayerIds.includes(p.id)).length} Pending
                </span>
              </div>

              <div className="space-y-3">
                {expiringPlayers
                  .filter(p => !reSignedPlayerIds.includes(p.id) && !declinedPlayerIds.includes(p.id))
                  .map((player) => {
                    const demand = player.demand || (player.overall * 40000);
                    return (
                      <div 
                        key={player.id}
                        className="bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all"
                      >
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <div className="w-10 h-10 shrink-0 bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden shadow-md">
                            <PlayerAvatar
                              playerId={player.id}
                              firstName={player.firstName}
                              lastName={player.lastName}
                              position={player.position}
                              teamName={userTeamDetails?.name}
                              teamConference={userTeamDetails?.conference}
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-orange-500 font-bold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/15">
                              OVR {player.overall}
                            </span>
                            <h5 className="font-bold text-white text-sm mt-1">
                              {player.firstName} {player.lastName} <span className="text-zinc-500 font-bold text-xs">({player.position})</span>
                            </h5>
                            <p className="text-xs text-zinc-555 font-semibold mt-1">
                              Age {player.age} • Previous Salary: ₱{player.salary.toLocaleString("en-PH")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div className="text-left sm:text-right flex-1 sm:flex-none">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Renewal Demand</span>
                            <span className="text-xs font-extrabold text-white">₱{demand.toLocaleString("en-PH")}/yr</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReSignPlayer(player.id, 3, demand)}
                              disabled={submittingExtensions}
                              className="px-3.5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                            >
                              Re-Sign
                            </button>
                            <button
                              onClick={() => handleDeclinePlayer(player.id)}
                              disabled={submittingExtensions}
                              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 text-red-400 hover:text-red-300 border border-zinc-800 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {expiringPlayers.filter(p => !reSignedPlayerIds.includes(p.id) && !declinedPlayerIds.includes(p.id)).length === 0 && (
                  <div className="py-12 text-center text-zinc-500 bg-zinc-950/20 border border-zinc-900 border-dashed rounded-2xl font-semibold">
                    🎉 All expiring contracts have been processed or re-signed.
                  </div>
                )}
              </div>
            </div>

            {/* Log block if simulated */}
            {cpuReSignSimulated && (
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-3xl p-6 space-y-3 shadow-lg">
                <h4 className="font-bold text-white text-base border-b border-zinc-900 pb-2">League-Wide Re-Signings Log</h4>
                <div className="bg-zinc-950/80 rounded-2xl border border-zinc-900 p-4 max-h-[300px] overflow-y-auto space-y-2 divide-y divide-zinc-900/30">
                  {cpuReSignLogs.map((log, idx) => (
                    <div key={idx} className="text-xs font-semibold py-2.5 text-zinc-300 flex items-center gap-2">
                      <span className="text-[10px] text-zinc-600">#{idx + 1}</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right cap space check */}
          <div className="space-y-6">
            <div className="bg-zinc-900/20 border border-zinc-900 rounded-3xl p-6 space-y-5 shadow-lg">
              <h5 className="font-bold text-white text-sm border-b border-zinc-900 pb-2">Financial Summary</h5>
              
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 space-y-4">
                <div>
                  <span className="text-zinc-550 font-bold text-[10px] uppercase block mb-1">Payroll / Cap Ceiling</span>
                  <span className="text-lg font-extrabold text-white">
                    ₱{(displayTotalSalaries + userDeadCap).toLocaleString("en-PH")} / ₱{userBudget.toLocaleString("en-PH")}
                  </span>
                  {userDeadCap > 0 && (
                    <span className="text-[9px] text-zinc-550 block">Includes ₱{userDeadCap.toLocaleString("en-PH")} dead cap</span>
                  )}
                </div>
                
                <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500" 
                    style={{ width: `${Math.min(((displayTotalSalaries + userDeadCap) / userBudget) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Roster Summary Section */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 space-y-4">
                <div>
                  <span className="text-zinc-550 font-bold text-[10px] uppercase block mb-1">Guaranteed Roster Spots</span>
                  <span className="text-lg font-extrabold text-white">
                    {guaranteedCount} / 18 <span className="text-xs text-zinc-500 font-medium">players under contract</span>
                  </span>
                </div>

                <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${Math.min((guaranteedCount / 18) * 100, 100)}%` }}
                  />
                </div>

                <div className="flex flex-col gap-1.5 pt-1 text-xs font-semibold">
                  <div className="flex justify-between text-zinc-400">
                    <span>Total Current Roster:</span>
                    <span className="text-zinc-200">{dbRoster.length} players</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Expiring Contracts:</span>
                    <span className="text-zinc-200">{expiringPlayers.length} players</span>
                  </div>
                  {guaranteedCount < 12 ? (
                    <div className="mt-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[11px] font-bold flex items-center justify-between">
                      <span>Below Minimum (12):</span>
                      <span>Must sign {12 - guaranteedCount} more</span>
                    </div>
                  ) : (
                    <div className="mt-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[11px] font-bold flex items-center justify-between">
                      <span>Roster Minimum Met!</span>
                      <span>Available spots: {18 - guaranteedCount}</span>
                    </div>
                  )}
                </div>
              </div>

              {!cpuReSignSimulated ? (
                <button
                  onClick={handleRunCpuExtensions}
                  disabled={submittingExtensions || expiringPlayers.filter(p => !reSignedPlayerIds.includes(p.id) && !declinedPlayerIds.includes(p.id)).length > 0}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-xs shadow-md transition-all hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
                >
                  {submittingExtensions ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>Simulate CPU Extensions</span>
                </button>
              ) : (
                <button
                  onClick={proceedToPhase2}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 rounded-xl font-bold text-xs transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <span>Proceed to Phase 2: Evolution</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2: Player Evolution */}
      {currentPhase === 2 && (
        <div className="bg-zinc-900/20 border border-zinc-900 rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-orange-500/10 rounded-lg text-orange-400">
              <Award className="w-5 h-5 animate-bounce" />
            </span>
            <div>
              <h4 className="text-lg font-bold text-white">Player Progression & Retirements</h4>
              <p className="text-zinc-500 text-xs">Process progression logs for youth, vet declines, and retirements.</p>
            </div>
          </div>

          {!evolutionSimulated && (
            <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-8 text-center max-w-xl mx-auto space-y-6">
              <Sparkles className="w-12 h-12 text-orange-500/40 mx-auto animate-pulse" />
              <div>
                <h5 className="font-bold text-white text-base">Run League Evolution</h5>
                <p className="text-zinc-400 text-sm mt-2">
                  Ages all players by 1 year. Young players will gain skill ratings, veterans will see regression, and players older than 34 may retire. Unsigned players will walk into the Free Agency pool.
                </p>
              </div>
              <button
                onClick={handleRunEvolution}
                disabled={evolving}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-extrabold text-sm shadow-md hover:scale-[1.02] transition-all cursor-pointer"
              >
                {evolving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>Evolve Roster State</span>
              </button>
            </div>
          )}

          {evolutionLogs.length > 0 && (
            <div className="space-y-6">
              {/* Evolution Tab Switcher */}
              <div className="flex border-b border-zinc-900">
                <button
                  type="button"
                  onClick={() => setEvolutionTab("my-team")}
                  className={`px-5 py-3 font-bold text-xs tracking-wider uppercase transition-all border-b-2 cursor-pointer ${
                    evolutionTab === "my-team"
                      ? "border-orange-500 text-orange-400 bg-orange-500/5"
                      : "border-transparent text-zinc-500 hover:text-zinc-305 hover:bg-zinc-900/10"
                  }`}
                >
                  My Team Evolution
                </button>
                <button
                  type="button"
                  onClick={() => setEvolutionTab("league-wide")}
                  className={`px-5 py-3 font-bold text-xs tracking-wider uppercase transition-all border-b-2 cursor-pointer ${
                    evolutionTab === "league-wide"
                      ? "border-orange-500 text-orange-400 bg-orange-500/5"
                      : "border-transparent text-zinc-500 hover:text-zinc-305 hover:bg-zinc-900/10"
                  }`}
                >
                  League Wide
                </button>
              </div>

              {evolutionTab === "my-team" ? (
                /* My Team Layout */
                (() => {
                  const userEvolutionPlayers = evolutionResults?.players 
                    ? evolutionResults.players.filter((p: any) => p.teamIdBefore === userTeamId)
                    : [];

                  // 1. Biggest Improver
                  const myImproved = userEvolutionPlayers.filter((p: any) => p.deltaOverall > 0);
                  const myBiggestImprover = myImproved.length > 0
                    ? myImproved.reduce((max: any, p: any) => p.deltaOverall > max.deltaOverall ? p : max, myImproved[0])
                    : null;

                  // 2. Biggest Decliner
                  const myDeclined = userEvolutionPlayers.filter((p: any) => p.deltaOverall < 0);
                  const myBiggestDecliner = myDeclined.length > 0
                    ? myDeclined.reduce((min: any, p: any) => p.deltaOverall < min.deltaOverall ? p : min, myDeclined[0])
                    : null;

                  // 3. Average Team OVR Change
                  const activeUserPlayers = userEvolutionPlayers.filter((p: any) => p.status !== "retired");
                  const avgOvrChange = activeUserPlayers.length > 0
                    ? activeUserPlayers.reduce((sum: number, p: any) => sum + p.deltaOverall, 0) / activeUserPlayers.length
                    : 0;

                  // 4. Retirements and Departures
                  const myRetirementsCount = userEvolutionPlayers.filter((p: any) => p.status === "retired").length;
                  const myDeparturesCount = userEvolutionPlayers.filter((p: any) => p.status !== "retired" && p.teamIdAfter !== userTeamId).length;
                  const totalDepartures = myRetirementsCount + myDeparturesCount;

                  const getPlayerEvolutionStatus = (p: any) => {
                    if (p.status === "retired") return "Retired";
                    if (p.teamIdAfter === null) return "Free Agent";
                    return "Active";
                  };

                  const filteredMyTeamPlayers = [...userEvolutionPlayers]
                    .filter((p: any) => {
                      if (myTeamFilter === "improved") return p.deltaOverall > 0;
                      if (myTeamFilter === "declined") return p.deltaOverall < 0;
                      return true;
                    })
                    .sort((a: any, b: any) => b.deltaOverall - a.deltaOverall);

                  return (
                    <div className="space-y-6">
                      {/* My Team Summary Widgets */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        {/* Avg OVR Change */}
                        <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Avg Team OVR Change</span>
                          <span className={`text-2xl font-extrabold mt-2 ${avgOvrChange > 0 ? "text-green-400" : avgOvrChange < 0 ? "text-red-400" : "text-zinc-400"}`}>
                            {avgOvrChange > 0 ? "+" : ""}{avgOvrChange.toFixed(2)}
                          </span>
                        </div>

                        {/* Biggest Improver */}
                        <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Biggest Improver</span>
                          {myBiggestImprover ? (
                            <div className="mt-2">
                              <span className="text-sm font-extrabold text-white block truncate">
                                {myBiggestImprover.playerName}
                              </span>
                              <span className="text-[10px] font-bold text-green-400 block mt-0.5">
                                +{myBiggestImprover.deltaOverall} OVR
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm font-extrabold text-zinc-600 mt-2">—</span>
                          )}
                        </div>

                        {/* Biggest Decliner */}
                        <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Biggest Decliner</span>
                          {myBiggestDecliner ? (
                            <div className="mt-2">
                              <span className="text-sm font-extrabold text-white block truncate">
                                {myBiggestDecliner.playerName}
                              </span>
                              <span className="text-[10px] font-bold text-red-400 block mt-0.5">
                                {myBiggestDecliner.deltaOverall} OVR
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm font-extrabold text-zinc-650 mt-2">—</span>
                          )}
                        </div>

                        {/* Retirements & Departures */}
                        <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Retirements & Departures</span>
                          <div className="mt-2">
                            <span className="text-2xl font-extrabold text-amber-500 block">
                              {totalDepartures}
                            </span>
                            <span className="text-[9px] font-semibold text-zinc-500 block mt-0.5">
                              {myRetirementsCount} Retired • {myDeparturesCount} Free Agent
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Roster Table */}
                      <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-5 space-y-4">
                        <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                          <h5 className="text-sm font-bold text-white">My Team Evolution Details</h5>
                          <div className="flex gap-1.5 bg-zinc-950 p-1 border border-zinc-900 rounded-xl">
                            {(["all", "improved", "declined"] as const).map((filterVal) => (
                              <button
                                key={filterVal}
                                type="button"
                                onClick={() => setMyTeamFilter(filterVal)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                  myTeamFilter === filterVal
                                    ? "bg-zinc-900 text-white"
                                    : "text-zinc-500 hover:text-zinc-305"
                                }`}
                              >
                                {filterVal === "all" ? "All Changes" : filterVal === "improved" ? "Most Improved" : "Most Declined"}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          {filteredMyTeamPlayers.length > 0 ? (
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider">
                                  <th className="py-2 px-3">Player</th>
                                  <th className="py-2 px-3 text-center">Age</th>
                                  <th className="py-2 px-3 text-center">Before</th>
                                  <th className="py-2 px-3 text-center">After</th>
                                  <th className="py-2 px-3 text-center">Delta</th>
                                  <th className="py-2 px-3">Top Changes</th>
                                  <th className="py-2 px-3 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-900 font-semibold text-zinc-300">
                                {filteredMyTeamPlayers.map((p: any) => {
                                  const changes = Object.entries(p.changedAttributes || {})
                                    .map(([attr, delta]) => `${Number(delta) > 0 ? "+" : ""}${delta} ${attr}`)
                                    .join(", ");
                                  const statusLabel = getPlayerEvolutionStatus(p);

                                  return (
                                    <tr key={p.playerId} className="hover:bg-zinc-900/10">
                                      <td className="py-2 px-3 text-white font-extrabold">{p.playerName}</td>
                                      <td className="py-2 px-3 text-center text-zinc-400">{p.age}</td>
                                      <td className="py-2 px-3 text-center text-zinc-500">{p.oldOverall}</td>
                                      <td className="py-2 px-3 text-center text-zinc-200">{p.newOverall}</td>
                                      <td className={`py-2 px-3 text-center font-extrabold ${p.deltaOverall > 0 ? "text-green-400" : p.deltaOverall < 0 ? "text-red-400" : "text-zinc-500"}`}>
                                        {p.deltaOverall > 0 ? `+${p.deltaOverall}` : p.deltaOverall}
                                      </td>
                                      <td className="py-2 px-3 text-[11px] text-zinc-400 max-w-[250px] truncate" title={changes}>
                                        {changes || "No attributes changed"}
                                      </td>
                                      <td className="py-2 px-3 text-right">
                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                          statusLabel === "Active" 
                                            ? "bg-green-500/10 text-green-400" 
                                            : statusLabel === "Retired" 
                                            ? "bg-red-500/10 text-red-400" 
                                            : "bg-amber-500/10 text-amber-400"
                                        }`}>
                                          {statusLabel}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : (
                            <div className="text-center py-8 text-zinc-500 font-medium">
                              No roster changes match this filter.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* League Wide Layout */
                <>
                  {/* Stats Overview Grid */}
                  {evolutionResults && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Players Improved</span>
                        <span className="text-2xl font-extrabold text-green-400 mt-2">+{evolutionResults.improvedCount}</span>
                      </div>
                      <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Players Regressed</span>
                        <span className="text-2xl font-extrabold text-red-400 mt-2">-{evolutionResults.regressedCount}</span>
                      </div>
                      <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Biggest Leap</span>
                        {evolutionResults.biggestLeap ? (
                          <div className="mt-2">
                            <span className="text-sm font-extrabold text-white block truncate">
                              {evolutionResults.biggestLeap.playerName}
                            </span>
                            <span className="text-[10px] font-bold text-orange-400 block mt-0.5 truncate">
                              {evolutionResults.biggestLeap.teamName} • +{evolutionResults.biggestLeap.deltaOverall} OVR
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-extrabold text-zinc-600 mt-2">—</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Top 10 Tables */}
                  {evolutionResults && evolutionResults.players && (
                    <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-5 space-y-4">
                      <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                        <h5 className="text-sm font-bold text-white">
                          {showRegressions ? "Top 10 Offseason Regressions" : "Top 10 Most Improved Players"}
                        </h5>
                        <button
                          type="button"
                          onClick={() => setShowRegressions(!showRegressions)}
                          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-850 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        >
                          Show {showRegressions ? "Most Improved" : "Regressions"}
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider">
                              <th className="py-2 px-3">Rank</th>
                              <th className="py-2 px-3">Player</th>
                              <th className="py-2 px-3">Team</th>
                              <th className="py-2 px-3 text-center">Age</th>
                              <th className="py-2 px-3 text-center">Before</th>
                              <th className="py-2 px-3 text-center">After</th>
                              <th className="py-2 px-3 text-center">Delta</th>
                              <th className="py-2 px-3">Key Changes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900 font-semibold text-zinc-300">
                            {(showRegressions
                              ? [...evolutionResults.players].filter((p: any) => p.deltaOverall < 0).reverse().slice(0, 10)
                              : [...evolutionResults.players].filter((p: any) => p.deltaOverall > 0).slice(0, 10)
                            ).map((p: any, idx: number) => {
                              const changes = Object.entries(p.changedAttributes || {})
                                .map(([attr, delta]) => `${Number(delta) > 0 ? "+" : ""}${delta} ${attr}`)
                                .join(", ");
                              return (
                                <tr key={p.playerId} className="hover:bg-zinc-900/10">
                                  <td className="py-2 px-3 text-zinc-500">#{idx + 1}</td>
                                  <td className="py-2 px-3 text-white font-extrabold">{p.playerName}</td>
                                  <td className="py-2 px-3 text-zinc-400">{p.teamName}</td>
                                  <td className="py-2 px-3 text-center text-zinc-400">{p.age}</td>
                                  <td className="py-2 px-3 text-center text-zinc-500">{p.oldOverall}</td>
                                  <td className="py-2 px-3 text-center text-zinc-200">{p.newOverall}</td>
                                  <td className={`py-2 px-3 text-center font-extrabold ${p.deltaOverall > 0 ? "text-green-400" : "text-red-400"}`}>
                                    {p.deltaOverall > 0 ? `+${p.deltaOverall}` : p.deltaOverall}
                                  </td>
                                  <td className="py-2 px-3 text-[11px] text-zinc-400 max-w-[200px] truncate" title={changes}>
                                    {changes || "No attributes changed"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Scrollable logs summary */}
              <div className="space-y-2">
                <h5 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider px-1">Detailed Transitions Log</h5>
                <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 max-h-[200px] overflow-y-auto space-y-2 divide-y divide-zinc-900/50">
                  {evolutionLogs.map((log, idx) => {
                    const isRetirement = log.includes("retirement") || log.includes("🚨");
                    const isUnrestricted = log.includes("unrestricted");
                    const isProgression = log.includes("📈");
                    const isRegression = log.includes("📉");

                    return (
                      <div
                        key={idx}
                        className={`text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-2.5 ${
                          isRetirement
                            ? "bg-red-500/5 text-red-400"
                            : isUnrestricted
                            ? "bg-amber-500/5 text-amber-400"
                            : isProgression
                            ? "bg-green-500/5 text-green-400"
                            : isRegression
                            ? "bg-zinc-900/20 text-zinc-500"
                            : "text-zinc-300"
                        }`}
                      >
                        <span className="text-[10px] text-zinc-600">#{idx + 1}</span>
                        <span>{log}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={proceedToPhase3}
                  className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 rounded-xl font-bold text-xs transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <span>Proceed to Phase 3: Draft Lottery</span>
                  <ChevronRight className="w-4 h-4 text-orange-500" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PHASE 3: Draft Lottery */}
      {currentPhase === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-900/20 border border-zinc-900 rounded-3xl p-6 space-y-4 shadow-lg">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <h4 className="font-bold text-white text-base">FBM Rookie Draft Lottery</h4>
                </div>
                <span className="text-xs font-bold text-zinc-400 bg-zinc-950 px-3 py-1 rounded-full border border-zinc-900">
                  14 Lottery Teams
                </span>
              </div>

              {/* Lottery draw board */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Seed</th>
                      <th className="py-2.5 px-3">Team</th>
                      <th className="py-2.5 px-3 text-center">Record</th>
                      <th className="py-2.5 px-3 text-center">Odds</th>
                      <th className="py-2.5 px-3 text-right">Result Pick</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 font-semibold text-zinc-300">
                    {lotteryOddsList.map((entry, idx) => {
                      const isUser = entry.team.id === userTeamId;
                      // Find which pick this team ended up with in draftOrder
                      const pickNum = draftOrder.findIndex((t) => t.id === entry.team.id) + 1;
                      const hasRevealed = pickNum > 0 && revealedLotteryPicks[pickNum] !== undefined;

                      return (
                        <tr key={entry.team.id} className={`hover:bg-zinc-900/20 ${isUser ? "bg-orange-500/5 text-orange-400" : ""}`}>
                          <td className="py-3 px-3">#{entry.rank}</td>
                          <td className="py-3 px-3 font-bold">{entry.team.city} {entry.team.name}</td>
                          <td className="py-3 px-3 text-center font-mono text-zinc-400">{entry.record}</td>
                          <td className="py-3 px-3 text-center font-mono text-orange-500">{entry.odds}%</td>
                          <td className="py-3 px-3 text-right font-extrabold font-mono text-white">
                            {lotteryRun || hasRevealed ? (
                              <span className={pickNum <= 4 ? "text-green-400 text-sm animate-pulse" : "text-zinc-300"}>
                                Pick #{pickNum}
                              </span>
                            ) : (
                              <span className="text-zinc-600">Pending</span>
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

          <div className="space-y-6">
            <div className="bg-zinc-900/20 border border-zinc-900 rounded-3xl p-6 space-y-5 shadow-lg">
              <h5 className="font-bold text-white text-sm border-b border-zinc-900 pb-2">Lottery Machine</h5>

              {lotteryRunning && (
                <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-900 text-center space-y-4">
                  <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />
                  <div>
                    <h6 className="font-extrabold text-white text-xs uppercase tracking-wider">Drawing...</h6>
                    <p className="text-zinc-500 text-[10px] mt-1">
                      Generating random numbers & weighted drawing for lottery picks 1 to 4.
                    </p>
                  </div>
                  {/* Reveal countdown stats */}
                  <div className="bg-zinc-900 px-3 py-2 rounded border border-zinc-800/50 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    Revealing Pick #{lotteryRevealIndex} next
                  </div>
                </div>
              )}

              {!lotteryRun && !lotteryRunning && (
                <button
                  onClick={handleRunLotteryDraw}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-xs shadow-md transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 animate-spin-slow" />
                  <span>Start Lottery Drawing</span>
                </button>
              )}

              {lotteryRun && (
                <div className="space-y-4">
                  <div className="bg-green-500/5 border border-green-500/25 p-4 rounded-2xl text-center">
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <h6 className="font-bold text-white text-sm">Draw Concluded</h6>
                    <p className="text-zinc-400 text-xs mt-1">
                      Picks 1-4 drawing has successfully completed. Remaining reverse records locked picks 5-14.
                    </p>
                  </div>

                  <button
                    onClick={proceedToPhase4}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 rounded-xl font-bold text-xs transition-all cursor-pointer"
                  >
                    <span>Enter Rookie Draft Room</span>
                    <ChevronRight className="w-4 h-4 text-orange-500" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PHASE 4: Rookie Draft Room */}
      {currentPhase === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Prospects Board */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-905 border border-zinc-900 rounded-3xl p-6 space-y-4 shadow-lg">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-400" />
                  <h4 className="font-bold text-white text-base">Rookie Draft Board</h4>
                </div>
                <span className="text-xs font-bold text-zinc-400 bg-zinc-950 px-3 py-1 rounded-full border border-zinc-900">
                  {prospects.length} Prospects Available
                </span>
              </div>

              {/* Draft Board Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Age</th>
                      <th className="py-2.5 px-3">Pos</th>
                      <th className="py-2.5 px-3 text-center">OVR</th>
                      <th className="py-2.5 px-3 text-center">3PT</th>
                      <th className="py-2.5 px-3 text-center">SPD</th>
                      <th className="py-2.5 px-3 text-center">REB</th>
                      <th className="py-2.5 px-3">Hometown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 font-semibold text-zinc-300">
                    {prospects.slice(0, 15).map((p) => {
                      const isSelected = selectedProspectId === p.id;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => {
                            if (!draftingActive) setSelectedProspectId(p.id);
                          }}
                          className={`hover:bg-zinc-900/40 cursor-pointer transition-all ${
                            isSelected ? "bg-orange-500/10 border-l-2 border-l-orange-500 text-white" : ""
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="font-bold flex items-center gap-2">
                              <div className="w-6 h-6 shrink-0 bg-zinc-950 border border-zinc-850 rounded overflow-hidden shadow-xs">
                                <PlayerAvatar
                                  playerId={p.id}
                                  firstName={p.firstName}
                                  lastName={p.lastName}
                                  position={p.position}
                                  teamName={null}
                                  teamConference={null}
                                />
                              </div>
                              <span>
                                {p.firstName} {p.lastName}
                              </span>
                              {p.isFilAm && (
                                <span className="text-[9px] bg-cyan-500/15 text-cyan-400 px-1 py-0.5 rounded font-extrabold">
                                  Fil-Am
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">{p.age}</td>
                          <td className="py-3 px-3">
                            <span className="text-zinc-500 font-bold">{p.position}</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="text-orange-400 font-bold">{p.overall}</span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono">{p.threePoint}</td>
                          <td className="py-3 px-3 text-center font-mono">{p.speed}</td>
                          <td className="py-3 px-3 text-center font-mono">{p.rebounding}</td>
                          <td className="py-3 px-3 text-zinc-500">{p.hometown}</td>
                        </tr>
                      );
                    })}
                    {prospects.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-zinc-500 italic">
                          No prospects remaining. The Rookie Draft is complete.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {prospects.length > 15 && (
                <div className="text-[10px] text-zinc-500 text-center italic">
                  Showing top 15 remaining rookies sorted by OVR
                </div>
              )}
            </div>
          </div>

          {/* Draft Console */}
          <div className="space-y-6">
            <div className="bg-zinc-905 border border-zinc-900 rounded-3xl p-6 space-y-5 shadow-lg">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                <h5 className="font-bold text-white text-sm">Draft Console</h5>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-900">
                    Season {nextSeasonYear}
                  </span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                    draftSessionActive 
                      ? "text-green-400 bg-green-500/10 border-green-500/20" 
                      : draftInitializing
                      ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                      : draftInitError
                      ? "text-red-400 bg-red-500/10 border-red-500/20"
                      : "text-zinc-500 bg-zinc-950 border-zinc-900"
                  }`}>
                    {draftSessionActive ? "Active" : draftInitializing ? "Initializing..." : draftInitError ? "Error" : "Pending"}
                  </span>
                </div>
              </div>

              {/* Draft initialization states */}
              {draftInitializing && (
                <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-900 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
                  <div>
                    <h6 className="font-bold text-white text-xs">Initializing Draft Session</h6>
                    <p className="text-zinc-500 text-[10px] mt-1">
                      Creating draft session and generating picks for season {nextSeasonYear}...
                    </p>
                  </div>
                </div>
              )}

              {draftInitError && (
                <div className="bg-red-500/5 border border-red-500/20 p-5 rounded-2xl text-center space-y-3">
                  <X className="w-8 h-8 text-red-400 mx-auto" />
                  <div>
                    <h6 className="font-bold text-white text-xs">Draft Initialization Failed</h6>
                    <p className="text-red-400/80 text-[10px] mt-1">{draftInitError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setDraftInitError(null);
                      setDraftInitializing(true);
                      try {
                        const res = await initializeDraftSessionAction(nextSeasonYear);
                        if (res.success) {
                          setDraftSessionActive(true);
                          const sessionRes = await getDraftSessionPicksAction(nextSeasonYear);
                          if (sessionRes.success && sessionRes.picks) {
                            setSessionPicks(sessionRes.picks);
                            const usedPicks = sessionRes.picks.filter((p: any) => p.isUsed);
                            setCurrentPickIndex(usedPicks.length);
                          }
                        } else {
                          setDraftInitError("Draft session initialization failed. Please try again.");
                        }
                      } catch (err: any) {
                        setDraftInitError(err.message || "Failed to initialize draft session.");
                      } finally {
                        setDraftInitializing(false);
                      }
                    }}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Retry Initialization
                  </button>
                </div>
              )}

              {!draftSessionActive && !draftInitializing && !draftInitError && (
                <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-900 text-center space-y-4">
                  <Shield className="w-10 h-10 text-orange-500/40 mx-auto" />
                  <div>
                    <h6 className="font-bold text-white text-xs">Draft Room Ready</h6>
                    <p className="text-zinc-500 text-[10px] mt-1">
                      The draft room has not been initialized for season {nextSeasonYear} yet.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setDraftInitializing(true);
                      setDraftInitError(null);
                      try {
                        const res = await initializeDraftSessionAction(nextSeasonYear);
                        if (res.success) {
                          setDraftSessionActive(true);
                          const sessionRes = await getDraftSessionPicksAction(nextSeasonYear);
                          if (sessionRes.success && sessionRes.picks) {
                            setSessionPicks(sessionRes.picks);
                            const usedPicks = sessionRes.picks.filter((p: any) => p.isUsed);
                            setCurrentPickIndex(usedPicks.length);
                          }
                        } else {
                          setDraftInitError("Failed to initialize draft session.");
                        }
                      } catch (err: any) {
                        setDraftInitError(err.message || "Failed to initialize draft session.");
                      } finally {
                        setDraftInitializing(false);
                      }
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-xs shadow-md hover:scale-[1.02] transition-all cursor-pointer"
                  >
                    Initialize Draft Session
                  </button>
                </div>
              )}

              {draftSessionActive && currentPickIndex < 60 && !draftInitializing && !draftInitError && (
                <div className="space-y-4">
                  {/* Current pick display */}
                  <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900 space-y-2">
                    <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                      <span>Pick #{currentPickIndex + 1} of 60</span>
                      <span className={isUserTurn ? "text-orange-500 animate-pulse font-extrabold" : ""}>
                        {isUserTurn ? "On the Clock" : "Simulating"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs text-zinc-400 block font-semibold">Current Team Drafting</span>
                        <span className="text-sm font-extrabold text-white">
                          {currentPick ? `${currentPick.ownerCity} ${currentPick.ownerName}` : "—"}
                          {isUserTurn && " (Your Team)"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pick interactions */}
                  {isUserTurn ? (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-zinc-400">
                        Select a player from the board to draft onto your franchise roster:
                      </div>
                      <select
                        value={selectedProspectId}
                        onChange={(e) => setSelectedProspectId(e.target.value)}
                        disabled={draftingActive}
                        className="w-full p-3 bg-zinc-950 border border-zinc-900 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-orange-500 transition-all"
                      >
                        {prospects.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.position}] {p.firstName} {p.lastName} (OVR {p.overall})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleUserDraftPick}
                        disabled={!selectedProspectId || draftingActive}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:scale-[1.02] text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                      >
                        {draftingActive ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        <span>Draft Selected Player</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCpuDraftForUser}
                        disabled={draftingActive}
                        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-xl text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                      >
                        <span>Let CPU Draft For Me</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-zinc-500">
                        CPU teams are currently drafting. Click the simulation button to advance.
                      </div>
                      <button
                        type="button"
                        onClick={handleStartCpuPicks}
                        disabled={draftingActive}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 rounded-xl font-bold text-xs transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                      >
                        {draftingActive ? (
                          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-orange-500" />
                        )}
                        <span>Simulate CPU Picks</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAutoDraftEntireRemaining}
                        disabled={draftingActive}
                        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-xl text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                      >
                        <span>Auto-Draft Entire Draft</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {draftSessionActive && currentPickIndex >= 60 && !draftInitializing && !draftInitError && (
                <div className="bg-green-500/5 border border-green-500/25 p-5 rounded-2xl text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                  <h6 className="font-extrabold text-white text-sm">Rookie Draft Complete</h6>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    All 60 draft positions have successfully selected prospects. Proceed to the free agency phase.
                  </p>
                  <button
                    type="button"
                    onClick={proceedToPhase5}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-bold text-xs border border-zinc-800 transition-all cursor-pointer"
                  >
                    Proceed to Free Agency
                  </button>
                </div>
              )}
            </div>

            {/* Your Draft Picks Card */}
            <div className="bg-zinc-905 border border-zinc-900 rounded-3xl p-6 space-y-3 shadow-lg">
              <h5 className="font-bold text-white text-sm border-b border-zinc-900 pb-2">Your Draft Picks</h5>
              <div className="space-y-2">
                {userDraftPicks.map((pick) => (
                  <div key={pick.id} className="flex justify-between items-center py-2 border-b border-zinc-900 last:border-0 text-xs">
                    <span className="text-zinc-400 font-bold">Season {pick.season} — Round {pick.round}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                      pick.round === 1 
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                        : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                    }`}>
                      Round {pick.round} Pick
                    </span>
                  </div>
                ))}
                {userDraftPicks.length === 0 && (
                  <div className="text-center py-3 text-zinc-600 text-xs italic">
                    No draft picks registered for your franchise.
                  </div>
                )}
              </div>
            </div>

            {/* Pick History Log */}
            <div className="bg-zinc-905 border border-zinc-900 rounded-3xl p-6 space-y-3 shadow-lg">
              <h5 className="font-bold text-white text-sm border-b border-zinc-900 pb-2">Draft History</h5>
              <div className="bg-zinc-950/80 rounded-2xl border border-zinc-900 p-4 h-[250px] overflow-y-auto space-y-2.5 divide-y divide-zinc-900/40">
                {pickHistory.map((pick) => {
                  const isUser = pick.team.id === userTeamId;
                  return (
                    <div
                      key={pick.pickNumber}
                      className={`text-xs font-semibold pt-2 flex items-start gap-2 ${
                        isUser ? "text-orange-400" : "text-zinc-300"
                      }`}
                    >
                      <span className="text-[10px] text-zinc-500 font-bold bg-zinc-900 px-1.5 py-0.5 rounded">
                        #{pick.pickNumber}
                      </span>
                      <div>
                        <span className="font-bold block">
                          {pick.team.city} {pick.team.name}
                        </span>
                        <span className="text-zinc-400 font-semibold block text-[10px]">
                          Drafted {pick.player.firstName} {pick.player.lastName} ({pick.player.position}, OVR{" "}
                          {pick.player.overall})
                        </span>
                      </div>
                    </div>
                  );
                })}
                {pickHistory.length === 0 && (
                  <div className="py-8 text-center text-zinc-600 text-xs italic">
                    No picks registered yet. Press simulate to begin the draft.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 5: Free Agency */}
      {currentPhase === 5 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-905 border border-zinc-900 rounded-3xl p-6 space-y-4 shadow-lg">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-orange-400" />
                  <h4 className="font-bold text-white text-base">Offseason Free Agency Market</h4>
                </div>
              </div>

              <p className="text-zinc-400 text-sm leading-relaxed">
                Before initiating the regular season, player rosters must comply with the 12-18 player limit. 
                You can browse and sign available free agents directly from the Free Agency hub.
              </p>

              <div className="pt-2 flex justify-start">
                <a
                  href="/dashboard/free-agency"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 rounded-xl font-bold text-xs flex items-center gap-2 transition-all hover:scale-[1.02]"
                >
                  <span>Browse Free Agency Hub ↗</span>
                </a>
              </div>
            </div>

            {/* Simulation log */}
            {freeAgencySimulated && (
              <div className="bg-zinc-905 border border-zinc-900 rounded-3xl p-6 space-y-3 shadow-lg">
                <h5 className="font-bold text-white text-sm border-b border-zinc-900 pb-2">CPU Signings Log</h5>
                <div className="bg-zinc-950/80 rounded-2xl border border-zinc-900 p-4 h-[250px] overflow-y-auto space-y-2">
                  {freeAgencyLogs.map((log, idx) => (
                    <div key={idx} className="text-xs text-zinc-300 font-semibold py-1 border-b border-zinc-900 last:border-0">
                      {log}
                    </div>
                  ))}
                  {freeAgencyLogs.length === 0 && (
                    <div className="text-center py-8 text-zinc-500 italic text-xs">
                      All CPU teams had compliant rosters. No signings were needed.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Simulation Console */}
          <div className="space-y-6">
            <div className="bg-zinc-905 border border-zinc-900 rounded-3xl p-6 space-y-5 shadow-lg">
              <h5 className="font-bold text-white text-sm border-b border-zinc-900 pb-2">Simulation Panel</h5>

              {!freeAgencySimulated ? (
                <div className="space-y-3">
                  <p className="text-zinc-500 text-xs leading-relaxed font-semibold">
                    Simulate offseason signings for CPU-managed teams. The AI will evaluate their rosters, calculate remaining cap space, and recruit available free agents.
                  </p>
                  <button
                    onClick={handleSimulateFreeAgency}
                    disabled={freeAgencyRunning}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                  >
                    {freeAgencyRunning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Flame className="w-4 h-4" />
                    )}
                    <span>Simulate CPU Free Agency</span>
                  </button>
                </div>
              ) : (
                <div className="bg-green-500/5 border border-green-500/25 p-5 rounded-2xl text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                  <h6 className="font-extrabold text-white text-sm">Free Agency Finalized</h6>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    CPU teams have completed their roster updates. Remaining free agents: <span className="font-extrabold text-white">{freeAgentsCount}</span>.
                  </p>
                  <button
                    onClick={proceedToPhase6}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-bold text-xs border border-zinc-800 transition-all cursor-pointer"
                  >
                    Proceed to Pre-Season
                  </button>
                </div>
              )}
            </div>

            {/* Always-Visible Draft Picks Card */}
            <div className="bg-zinc-905 border border-zinc-900 rounded-3xl p-6 space-y-3 shadow-lg">
              <h5 className="font-bold text-white text-sm border-b border-zinc-900 pb-2">Your Draft Picks</h5>
              <div className="space-y-2">
                {userDraftPicks.map((pick) => (
                  <div key={pick.id} className="flex justify-between items-center py-2 border-b border-zinc-900 last:border-0 text-xs">
                    <span className="text-zinc-400 font-bold">Season {pick.season} — Round {pick.round}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                      pick.round === 1 
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                        : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                    }`}>
                      Round {pick.round} Pick
                    </span>
                  </div>
                ))}
                {userDraftPicks.length === 0 && (
                  <div className="text-center py-3 text-zinc-600 text-xs italic">
                    No draft picks registered for your franchise.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 6: Season Setup */}
      {currentPhase === 6 && (
        <div className="bg-zinc-905 border border-zinc-900 rounded-3xl p-10 text-center max-w-2xl mx-auto shadow-2xl relative overflow-hidden space-y-8">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-500/5 blur-[80px] rounded-full pointer-events-none" />
          <Sparkles className="w-16 h-16 text-orange-500 mx-auto animate-pulse" />
          
          <div>
            <h3 className="text-3xl font-extrabold text-white tracking-tight mb-2">Initialize Season {nextSeasonYear}</h3>
            <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
              Resets standings, wipes prior records, and generates 1,230 brand-new regular season matchups. Evolved rosters and drafted rookies are locked onto their respective franchises.
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 max-w-md mx-auto text-left space-y-3 text-xs">
            <h5 className="font-bold text-white uppercase text-[10px] tracking-wider border-b border-zinc-900 pb-1.5 mb-1 text-zinc-400">Pre-Season Checklist</h5>
            <div className="flex justify-between py-1 border-b border-zinc-900/50">
              <span className="text-zinc-500 font-bold">Upcoming Season Campaign:</span>
              <span className="text-white font-extrabold">{nextSeasonYear}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-900/50">
              <span className="text-zinc-500 font-bold">Rookie Recruits Drafted:</span>
              <span className="text-green-400 font-extrabold">30 Players Signed</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-900/50">
              <span className="text-zinc-500 font-bold">Unsigned Prospects Released:</span>
              <span className="text-amber-400 font-extrabold">15 Free Agents Added</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-500 font-bold">League Matchups generated:</span>
              <span className="text-orange-400 font-extrabold">1,230 Scheduled Games</span>
            </div>
          </div>

          <button
            onClick={handleLaunchSeason}
            disabled={launching}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-extrabold text-sm shadow-[0_4px_20px_rgba(249,115,22,0.3)] hover:scale-[1.02] cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {launching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying League Roster Compliance & Generating Schedule...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>🚀 Initialize Season {nextSeasonYear}</span>
              </>
            )}
          </button>
        </div>
      )}

    </div>
  );
}
