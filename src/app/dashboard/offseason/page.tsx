"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { getPlayoffBracketAction } from "@/app/actions/playoffEngine";
import { getStandingsDataAction } from "@/app/actions/leagueEngine";
import {
  generateRookiePoolAction,
  processPlayerEvolutionAction,
  executeDraftPickAction,
  getDraftProspectsAction,
} from "@/app/actions/offseasonEngine";
import {
  getExpiringPlayersAction,
  reSignPlayerAction,
  runCpuReSigningsAction,
  getDraftLotteryPicksAction,
  finalizeOffseasonAction,
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
  team: Team;
  player: Prospect;
  pickNumber: number;
}

const SALARY_CAP = 50000000;

export default function OffseasonWizardPage() {
  const router = useRouter();
  const { userTeamId, setLeagueDay } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playoffs completeness validation
  const [isPlayoffsConcluded, setIsPlayoffsConcluded] = useState(false);
  const [championTeam, setChampionTeam] = useState<any>(null);

  // 5-Phase Wizard State
  const [currentPhase, setCurrentPhase] = useState<number>(1);

  // Phase 1: Re-Signings State
  const [expiringPlayers, setExpiringPlayers] = useState<Player[]>([]);
  const [reSignedPlayerIds, setReSignedPlayerIds] = useState<string[]>([]);
  const [declinedPlayerIds, setDeclinedPlayerIds] = useState<string[]>([]);
  const [totalSalaries, setTotalSalaries] = useState<number>(0);
  const [cpuReSignLogs, setCpuReSignLogs] = useState<string[]>([]);
  const [cpuReSignSimulated, setCpuReSignSimulated] = useState<boolean>(false);
  const [submittingExtensions, setSubmittingExtensions] = useState<boolean>(false);

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

  // Phase 5: Launch State
  const [nextSeasonYear, setNextSeasonYear] = useState<number>(2027);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Save state to localStorage to prevent losing progress on refresh
  const saveWizardState = (updates: any = {}) => {
    const state = {
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
    };
    localStorage.setItem("filipino-basketball-manager-offseason-wizard", JSON.stringify(state));
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

      // Load from localStorage if present
      const saved = localStorage.getItem("filipino-basketball-manager-offseason-wizard");
      let loadedState: any = {};
      if (saved) {
        try {
          loadedState = JSON.parse(saved);
          if (loadedState.currentPhase) setCurrentPhase(loadedState.currentPhase);
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
          if (loadedState.pickHistory) setPickHistory(loadedState.pickHistory);
        } catch (e) {
          console.error("Failed to parse saved wizard state:", e);
        }
      }

      // 2. Load context based on active phase
      if (userTeamId) {
        // Load team salary information
        const standingsRes = await getStandingsDataAction();
        if (standingsRes.success && standingsRes.teams) {
          const myTeam = (standingsRes.teams as Team[]).find((t) => t.id === userTeamId);
          if (myTeam) {
            // Find current team salaries
            const res = await getExpiringPlayersAction(userTeamId);
            if (res.success && res.players) {
              // Get all players on team to compute total salary
              const response = await fetch(`/api/roster-salary-placeholder-check`); // local query
              // Wait, we query database layer for all players on team
            }
          }
        }

        // Fetch expiring players
        const expRes = await getExpiringPlayersAction(userTeamId);
        if (expRes.success && expRes.players) {
          setExpiringPlayers(expRes.players as Player[]);
        }

        // Load prospects if we are on draft phase
        const prospectsRes = await getDraftProspectsAction();
        if (prospectsRes.success && prospectsRes.prospects) {
          setProspects(prospectsRes.prospects as Prospect[]);
          if (prospectsRes.prospects.length > 0) {
            setSelectedProspectId(prospectsRes.prospects[0].id);
          }
        }
      }

      // Check upcoming season year
      const standingsRes = await getStandingsDataAction();
      if (standingsRes.success && standingsRes.completedGames && standingsRes.completedGames.length > 0) {
        const yr = standingsRes.completedGames[0].seasonYear;
        setNextSeasonYear(yr + 1);
      }
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
  }, [mounted, currentPhase]);

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
        alert("Player re-signed successfully!");
      } else {
        alert(res.error || "Failed to re-sign player.");
      }
    } catch (e: any) {
      console.error(e);
      alert("Error re-signing player.");
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
      } else {
        alert(res.error || "Failed to run CPU extensions.");
      }
    } catch (e: any) {
      console.error(e);
      alert("Error running CPU extensions.");
    } finally {
      setSubmittingExtensions(false);
    }
  };

  const proceedToPhase2 = () => {
    setCurrentPhase(2);
    saveWizardState({ currentPhase: 2 });
  };

  // Phase 2 Actions: Progression & Retirements
  const handleRunEvolution = async () => {
    try {
      setEvolving(true);
      const res = await processPlayerEvolutionAction();
      if (res.success && res.logs) {
        setEvolutionLogs(res.logs);
        
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
        });
      } else {
        alert(res.error || "Failed to run player evolution.");
      }
    } catch (e: any) {
      console.error(e);
      alert("Error during evolution run.");
    } finally {
      setEvolving(false);
    }
  };

  const proceedToPhase3 = () => {
    setCurrentPhase(3);
    saveWizardState({ currentPhase: 3 });
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

  const proceedToPhase4 = () => {
    setCurrentPhase(4);
    saveWizardState({ currentPhase: 4 });
  };

  // Phase 4 Actions: Rookie Draft Room
  const runCpuPicks = async (startIndex: number, currentProspects: Prospect[], history: DraftPick[]) => {
    if (draftingActive) return;
    setDraftingActive(true);

    let idx = startIndex;
    let localProspects = [...currentProspects];
    let localHistory = [...history];

    const draftedIds = new Set(localHistory.map((h) => h.player.id));

    while (idx < 30) {
      const currentTeam = draftOrder[idx];
      if (currentTeam.id === userTeamId) {
        // Pause and let user draft
        setDraftingActive(false);
        setProspects(localProspects);
        setPickHistory(localHistory);
        setCurrentPickIndex(idx);
        saveWizardState({ currentPickIndex: idx, pickHistory: localHistory });
        return;
      }

      // CPU selects highest-rated prospect
      const available = localProspects.filter((p) => !draftedIds.has(p.id));
      if (available.length === 0) break;

      const bestPlayer = available.reduce((best, cur) => (cur.overall > best.overall ? cur : best), available[0]);

      const res = await executeDraftPickAction(currentTeam.id, bestPlayer.id);
      if (res.success) {
        draftedIds.add(bestPlayer.id);
        const pickDetails: DraftPick = {
          team: currentTeam,
          player: bestPlayer,
          pickNumber: idx + 1,
        };
        localHistory.push(pickDetails);
        localProspects = localProspects.filter((p) => p.id !== bestPlayer.id);

        setPickHistory([...localHistory]);
        setProspects([...localProspects]);
        
        idx++;
        setCurrentPickIndex(idx);
        saveWizardState({ currentPickIndex: idx, pickHistory: localHistory });

        // Visual delay
        await new Promise((r) => setTimeout(r, 600));
      } else {
        console.error("CPU pick failed:", res.error);
        break;
      }
    }

    setDraftingActive(false);
    if (idx >= 30) {
      // Draft completed!
      saveWizardState({ currentPickIndex: 30, pickHistory: localHistory });
    }
  };

  const handleUserDraftPick = async () => {
    if (!selectedProspectId || draftingActive) return;

    const currentTeam = draftOrder[currentPickIndex];
    if (currentTeam.id !== userTeamId) return; // Not user's turn

    const selectedPlayer = prospects.find((p) => p.id === selectedProspectId);
    if (!selectedPlayer) return;

    setDraftingActive(true);
    try {
      const res = await executeDraftPickAction(userTeamId, selectedProspectId);
      if (res.success) {
        const pickDetails: DraftPick = {
          team: currentTeam,
          player: selectedPlayer,
          pickNumber: currentPickIndex + 1,
        };

        const updatedHistory = [...pickHistory, pickDetails];
        const updatedProspects = prospects.filter((p) => p.id !== selectedProspectId);

        setPickHistory(updatedHistory);
        setProspects(updatedProspects);
        
        const nextIdx = currentPickIndex + 1;
        setCurrentPickIndex(nextIdx);
        saveWizardState({ currentPickIndex: nextIdx, pickHistory: updatedHistory });

        // Select the next best prospect automatically
        const remaining = updatedProspects;
        if (remaining.length > 0) {
          const nextBest = remaining.reduce((best, cur) => (cur.overall > best.overall ? cur : best), remaining[0]);
          setSelectedProspectId(nextBest.id);
        }

        setDraftingActive(false);

        // Immediately trigger CPU picks following user turn
        await runCpuPicks(nextIdx, remaining, updatedHistory);
      } else {
        alert(res.error || "Failed to draft selected player.");
        setDraftingActive(false);
      }
    } catch (e) {
      console.error(e);
      alert("Draft execution failed.");
      setDraftingActive(false);
    }
  };

  const handleStartCpuPicks = async () => {
    await runCpuPicks(currentPickIndex, prospects, pickHistory);
  };

  const proceedToPhase5 = () => {
    setCurrentPhase(5);
    saveWizardState({ currentPhase: 5 });
  };

  // Phase 5 Actions: Pre-Season Launch
  const handleLaunchSeason = async () => {
    try {
      setLaunching(true);
      const res = await finalizeOffseasonAction();
      if (res.success) {
        // Clear wizard state from localStorage
        localStorage.removeItem("filipino-basketball-manager-offseason-wizard");
        setLeagueDay(1);
        alert(`Successfully launched Season ${res.nextYear}! Redirecting to roster page.`);
        router.push("/dashboard");
      } else {
        alert(res.error || "Failed to reset season.");
        setLaunching(false);
      }
    } catch (e: any) {
      console.error(e);
      alert("Failed to advance season.");
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
    { id: 5, name: "Pre-Season", desc: "Season Initialization" },
  ];

  const userTeam = draftOrder.find((t) => t.id === userTeamId);
  const isUserTurn = currentPickIndex < 30 && draftOrder[currentPickIndex]?.id === userTeamId;

  return (
    <div className="space-y-8 relative pb-16">
      
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                    const demand = player.overall * 40000;
                    return (
                      <div 
                        key={player.id}
                        className="bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all"
                      >
                        <div>
                          <span className="text-[10px] text-orange-500 font-bold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/15">
                            OVR {player.overall}
                          </span>
                          <h5 className="font-bold text-white text-sm mt-1">
                            {player.firstName} {player.lastName} <span className="text-zinc-500 font-bold text-xs">({player.position})</span>
                          </h5>
                          <p className="text-xs text-zinc-500 font-semibold mt-1">
                            Age {player.age} • Previous Salary: ₱{player.salary.toLocaleString("en-PH")}
                          </p>
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
                  <span className="text-zinc-500 font-bold text-[10px] uppercase block mb-1">Salary Cap Ceiling</span>
                  <span className="text-lg font-extrabold text-white">₱{SALARY_CAP.toLocaleString("en-PH")}</span>
                </div>
                
                <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500" 
                    style={{ width: `${Math.min((totalSalaries / SALARY_CAP) * 100, 100)}%` }}
                  />
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
            <div className="space-y-4">
              <h5 className="text-sm font-bold text-zinc-300 px-1">League Transitions Summary</h5>
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 max-h-[350px] overflow-y-auto space-y-2 divide-y divide-zinc-900/50">
                {evolutionLogs.map((log, idx) => {
                  const isRetirement = log.includes("retirement") || log.includes("🚨");
                  const isUnrestricted = log.includes("unrestricted");
                  const isProgression = log.includes("📈");
                  const isRegression = log.includes("📉");

                  return (
                    <div
                      key={idx}
                      className={`text-xs font-semibold py-2.5 px-3 rounded-lg flex items-center gap-2.5 ${
                        isRetirement
                          ? "bg-red-500/5 text-red-400"
                          : isUnrestricted
                          ? "bg-amber-500/5 text-amber-400"
                          : isProgression
                          ? "bg-green-500/5 text-green-400"
                          : isRegression
                          ? "bg-zinc-900/40 text-zinc-500"
                          : "text-zinc-300"
                      }`}
                    >
                      <span className="text-[10px] text-zinc-600">#{idx + 1}</span>
                      <span>{log}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={proceedToPhase3}
                  className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 rounded-xl font-bold text-xs transition-all cursor-pointer"
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
                            <div className="font-bold flex items-center gap-1.5">
                              {p.firstName} {p.lastName}
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
              <h5 className="font-bold text-white text-sm border-b border-zinc-900 pb-2">Draft Console</h5>

              {currentPickIndex < 30 ? (
                <div className="space-y-4">
                  {/* Current pick display */}
                  <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900 space-y-2">
                    <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                      <span>Pick #{currentPickIndex + 1} of 30</span>
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
                          {draftOrder[currentPickIndex]?.city} {draftOrder[currentPickIndex]?.name}
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
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-zinc-500">
                        CPU teams are currently drafting. Click the simulation button to advance.
                      </div>
                      <button
                        onClick={handleStartCpuPicks}
                        disabled={draftingActive}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 rounded-xl font-bold text-xs transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                      >
                        {draftingActive ? (
                          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-orange-500" />
                        )}
                        <span>Simulate CPU Picks</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-green-500/5 border border-green-500/25 p-5 rounded-2xl text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                  <h6 className="font-extrabold text-white text-sm">Rookie Draft Complete</h6>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    All 30 draft positions have successfully selected prospects. Proceed to the final launch stage to set up the next season schedule.
                  </p>
                  <button
                    onClick={proceedToPhase5}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-bold text-xs border border-zinc-800 transition-all cursor-pointer"
                  >
                    Proceed to Pre-Season
                  </button>
                </div>
              )}
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

      {/* PHASE 5: Season Setup */}
      {currentPhase === 5 && (
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
