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
  advanceToNextSeasonAction,
  getDraftProspectsAction,
} from "@/app/actions/offseasonEngine";
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
} from "lucide-react";

interface Team {
  id: string;
  name: string;
  city: string;
  conference: "Luzon" | "VisMin";
  budget: number;
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

export default function OffseasonHubPage() {
  const router = useRouter();
  const { userTeamId, setLeagueDay } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Playoffs completeness validation
  const [isPlayoffsConcluded, setIsPlayoffsConcluded] = useState(false);
  const [championTeam, setChampionTeam] = useState<any>(null);

  // Offseason step tracking
  // Steps: 'locked' | 'evolution_intro' | 'evolution_simulating' | 'draft_room' | 'season_launch'
  const [offseasonStep, setOffseasonStep] = useState<string>("locked");
  const [activeTab, setActiveTab] = useState<"evolution" | "draft" | "launch">("evolution");

  // Step 1: Evolution state
  const [evolutionLogs, setEvolutionLogs] = useState<string[]>([]);
  const [evolutionSimulated, setEvolutionSimulated] = useState(false);

  // Step 2: Draft Room state
  const [draftOrder, setDraftOrder] = useState<Team[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspectId, setSelectedProspectId] = useState<string>("");
  const [currentPickIndex, setCurrentPickIndex] = useState<number>(0);
  const [pickHistory, setPickHistory] = useState<DraftPick[]>([]);
  const [draftingActive, setDraftingActive] = useState<boolean>(false);

  // Step 3: Season Launch
  const [nextSeasonYear, setNextSeasonYear] = useState<number>(2027);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadOffseasonContext = async () => {
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
          setOffseasonStep("evolution_intro");
        } else {
          setIsPlayoffsConcluded(false);
          setOffseasonStep("locked");
          setLoading(false);
          return;
        }
      } else {
        setIsPlayoffsConcluded(false);
        setOffseasonStep("locked");
        setLoading(false);
        return;
      }

      // 2. Fetch Standings to compute draft order
      const standingsRes = await getStandingsDataAction();
      if (standingsRes.success && standingsRes.teams && standingsRes.completedGames) {
        const computedOrder = computeDraftOrder(standingsRes.teams as Team[], standingsRes.completedGames as any[]);
        setDraftOrder(computedOrder);
      }

      // 3. Fetch prospects (if already generated in previous state/load)
      const prospectsRes = await getDraftProspectsAction();
      if (prospectsRes.success && prospectsRes.prospects && prospectsRes.prospects.length > 0) {
        setProspects(prospectsRes.prospects as Prospect[]);
        // If prospects exist, we might be resuming draft
        setEvolutionSimulated(true);
        setOffseasonStep("draft_room");
        setActiveTab("draft");
      }

      // 4. Try loading draft state from localStorage to support resumption
      const savedState = localStorage.getItem("filipino-basketball-manager-draft-state");
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          if (parsed.history && parsed.currentPickIndex !== undefined) {
            setPickHistory(parsed.history);
            setCurrentPickIndex(parsed.currentPickIndex);
            if (parsed.currentPickIndex >= 30) {
              setOffseasonStep("season_launch");
              setActiveTab("launch");
            } else {
              setOffseasonStep("draft_room");
              setActiveTab("draft");
            }
          }
        } catch (e) {
          console.error("Failed to parse saved draft state:", e);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to initialize offseason data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      loadOffseasonContext();
    }
  }, [mounted]);

  // Compute draft order: worst regular season record gets pick #1
  const computeDraftOrder = (teamsList: Team[], gamesList: any[]) => {
    const regularGames = gamesList.filter((g) => g.stage === "Regular");
    
    const records = teamsList.map((team) => {
      const teamGames = regularGames.filter((g) => g.homeTeamId === team.id || g.awayTeamId === team.id);
      let wins = 0;
      let losses = 0;
      for (const g of teamGames) {
        const isHome = g.homeTeamId === team.id;
        const teamScore = isHome ? g.homeScore : g.awayScore;
        const oppScore = isHome ? g.awayScore : g.homeScore;
        if (teamScore > oppScore) wins++; else losses++;
      }
      const total = wins + losses;
      const pct = total > 0 ? wins / total : 0;
      return { team, wins, losses, pct };
    });

    return records
      .sort((a, b) => {
        if (a.pct !== b.pct) return a.pct - b.pct;
        return a.wins - b.wins;
      })
      .map((r) => r.team);
  };

  // Run Player Progression, Retirements & Contract resets
  const handleSimulateEvolution = async () => {
    try {
      setOffseasonStep("evolution_simulating");
      setError(null);

      // A. Process player evolution
      const evoRes = await processPlayerEvolutionAction();
      if (!evoRes.success) {
        throw new Error(evoRes.error || "Evolution simulation failed.");
      }
      setEvolutionLogs(evoRes.logs || []);

      // B. Generate Rookie pool for the draft
      const poolRes = await generateRookiePoolAction(2027);
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
      setOffseasonStep("draft_room");
      setActiveTab("draft");
      
      // Initialize fresh draft state in local storage
      const draftState = { currentPickIndex: 0, history: [] };
      localStorage.setItem("filipino-basketball-manager-draft-state", JSON.stringify(draftState));
      setCurrentPickIndex(0);
      setPickHistory([]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process roster evolution.");
      setOffseasonStep("evolution_intro");
    }
  };

  // Simulate CPU picks automatically up to next user pick or draft conclusion
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
        // Pause at user's pick
        setDraftingActive(false);
        setProspects(localProspects);
        setPickHistory(localHistory);
        setCurrentPickIndex(idx);
        saveDraftState(idx, localHistory);
        return;
      }

      // CPU selects highest-rated prospect
      const available = localProspects.filter((p) => !draftedIds.has(p.id));
      if (available.length === 0) break;

      const bestPlayer = available.reduce((best, cur) => (cur.overall > best.overall ? cur : best), available[0]);

      // Call action
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
        saveDraftState(idx, localHistory);

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
      setOffseasonStep("season_launch");
      setActiveTab("launch");
    }
  };

  // User submits their draft selection
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
        saveDraftState(nextIdx, updatedHistory);

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

  // Helper to save draft progression to local storage
  const saveDraftState = (pickIndex: number, history: DraftPick[]) => {
    const stateObj = { currentPickIndex: pickIndex, history };
    localStorage.setItem("filipino-basketball-manager-draft-state", JSON.stringify(stateObj));
  };

  // Initialize brand new season Year
  const handleInitializeNextSeason = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await advanceToNextSeasonAction();
      if (res.success) {
        // Clear draft localStorage state
        localStorage.removeItem("filipino-basketball-manager-draft-state");
        // Reset league day to 1 in store
        setLeagueDay(1);
        alert(`Successfully initialized season ${res.nextYear}! Redirecting to roster page.`);
        router.push("/dashboard");
      } else {
        alert(res.error || "Failed to reset season.");
        setLoading(false);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to advance season.");
      setLoading(false);
    }
  };

  // Quick button helper to start simulating CPU picks
  const handleStartCpuPicks = async () => {
    await runCpuPicks(currentPickIndex, prospects, pickHistory);
  };

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // Render Lock Screen if Playoffs are ongoing
  if (offseasonStep === "locked") {
    return (
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-12 text-center max-w-3xl mx-auto shadow-2xl relative overflow-hidden my-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-500/5 blur-[80px] rounded-full pointer-events-none" />
        <Trophy className="w-16 h-16 text-zinc-700 mx-auto mb-6" />
        <h3 className="text-3xl font-extrabold text-white tracking-tight mb-4">Offseason Locked</h3>
        <p className="text-zinc-400 text-base max-w-md mx-auto leading-relaxed">
          Complete the current Postseason Tournament to unlock the front-office renewal cycle. A PBA champion must be crowned before you can transition to the offseason.
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

  const userTeam = draftOrder.find((t) => t.id === userTeamId);
  const isUserTurn = currentPickIndex < 30 && draftOrder[currentPickIndex]?.id === userTeamId;

  return (
    <div className="space-y-8 relative">
      {/* Simulation/Loading Overlays */}
      {offseasonStep === "evolution_simulating" && (
        <div className="fixed inset-0 bg-zinc-950/70 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
          <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl text-center shadow-2xl flex flex-col items-center gap-4 max-w-xs">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            <h3 className="text-xl font-bold text-white">Evolving Roster State...</h3>
            <p className="text-zinc-400 text-sm">
              Simulating player progression, applying vet physical regression, processing contract expirations, and evaluating retirements.
            </p>
          </div>
        </div>
      )}

      {/* Main Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-orange-500/10 rounded-2xl text-orange-500">
            <RefreshCw className="w-7 h-7 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">League Offseason Hub</h3>
            <p className="text-zinc-500 text-sm font-semibold tracking-wide">
              {championTeam ? `Season Champion: ${championTeam.city} ${championTeam.name} • ` : ""}
              Manage contracts, drafts, and prepare for the upcoming PBA season campaigns.
            </p>
          </div>
        </div>
      </div>

      {/* Step Tabs */}
      <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-900 self-start max-w-md mx-auto">
        <button
          onClick={() => {
            if (evolutionSimulated) setActiveTab("evolution");
          }}
          disabled={!evolutionSimulated && offseasonStep === "evolution_intro"}
          className={`flex-1 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
            activeTab === "evolution"
              ? "bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-md"
              : "text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
          }`}
        >
          1. Evolution Logs
        </button>
        <button
          onClick={() => {
            if (evolutionSimulated) setActiveTab("draft");
          }}
          disabled={!evolutionSimulated}
          className={`flex-1 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
            activeTab === "draft"
              ? "bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-md"
              : "text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
          }`}
        >
          2. Rookie Draft
        </button>
        <button
          onClick={() => {
            if (currentPickIndex >= 30) setActiveTab("launch");
          }}
          disabled={currentPickIndex < 30}
          className={`flex-1 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
            activeTab === "launch"
              ? "bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-md"
              : "text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
          }`}
        >
          3. Season Launch
        </button>
      </div>

      {/* Step 1 Content: Player Evolution Log */}
      {activeTab === "evolution" && (
        <div className="bg-zinc-905 border border-zinc-900 rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-orange-500/10 rounded-lg text-orange-400">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <h4 className="text-lg font-bold text-white">Player Evolution & Retirement Lifecycle</h4>
              <p className="text-zinc-500 text-xs">Ages increment, skills evolve, and expiring contracts enter Free Agency</p>
            </div>
          </div>

          {offseasonStep === "evolution_intro" && (
            <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-8 text-center max-w-xl mx-auto space-y-6">
              <Sparkles className="w-12 h-12 text-orange-500/40 mx-auto" />
              <div>
                <h5 className="font-bold text-white text-base">Initiate Roster Transitions</h5>
                <p className="text-zinc-400 text-sm mt-2">
                  Advancing to the offseason will age all active players by 1 year. Young players (19-24) will receive progression rating boosts, veterans (32+) will face physical decline, and veterans older than 34 may announce retirement. Expired contracts will enter the Free Agency pool.
                </p>
              </div>
              <button
                onClick={handleSimulateEvolution}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-extrabold text-sm shadow-[0_4px_15px_rgba(249,115,22,0.25)] hover:scale-[1.02] cursor-pointer transition-all active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Process Player Evolution</span>
              </button>
            </div>
          )}

          {evolutionLogs.length > 0 && (
            <div className="space-y-4">
              <h5 className="text-sm font-bold text-zinc-300">Offseason Transition Summary</h5>
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 max-h-[350px] overflow-y-auto space-y-2 divide-y divide-zinc-900/50">
                {evolutionLogs.map((log, idx) => {
                  const isRetirement = log.includes("retirement");
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
                  onClick={() => setActiveTab("draft")}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-bold text-xs border border-zinc-800 transition-all cursor-pointer"
                >
                  <span>Proceed to Rookie Draft</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2 Content: Rookie Draft Room */}
      {activeTab === "draft" && (
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
                  <tbody className="divide-y divide-zinc-900/60 font-semibold text-zinc-300">
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
                                <span className="text-[9px] bg-cyan-500/15 text-cyan-400 px-1 py-0.5 rounded">
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
            {/* Live Pick Controller */}
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
                <div className="bg-green-500/5 border border-green-500/20 p-5 rounded-2xl text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                  <h6 className="font-extrabold text-white text-sm">Rookie Draft Complete</h6>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    All 30 draft positions have successfully selected prospects. Proceed to the final launch stage to set up the next season schedule.
                  </p>
                  <button
                    onClick={() => {
                      setOffseasonStep("season_launch");
                      setActiveTab("launch");
                    }}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-bold text-xs border border-zinc-800 transition-all cursor-pointer"
                  >
                    Launch Season Setup
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

      {/* Step 3 Content: Season Launch */}
      {activeTab === "launch" && (
        <div className="bg-zinc-905 border border-zinc-900 rounded-3xl p-10 text-center max-w-2xl mx-auto shadow-2xl relative overflow-hidden space-y-8">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-500/5 blur-[80px] rounded-full pointer-events-none" />
          <Sparkles className="w-16 h-16 text-orange-500 mx-auto animate-pulse" />
          
          <div>
            <h3 className="text-3xl font-extrabold text-white tracking-tight mb-2">Initialize Season {nextSeasonYear}</h3>
            <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
              Resets standings, wipes prior records, and generates 1,230 brand-new regular season matchups. Evolved rosters and drafted rookies are locked onto their respective franchises.
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 max-w-md mx-auto text-left space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-zinc-900/50">
              <span className="text-zinc-500 font-bold">Upcoming Season:</span>
              <span className="text-white font-extrabold">{nextSeasonYear}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-900/50">
              <span className="text-zinc-500 font-bold">Rookie Recruits Added:</span>
              <span className="text-green-400 font-extrabold">30 Players Active</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-500 font-bold">League Matchups generated:</span>
              <span className="text-orange-400 font-extrabold">1,230 Scheduled Games</span>
            </div>
          </div>

          <button
            onClick={handleInitializeNextSeason}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-extrabold text-sm shadow-[0_4px_20px_rgba(249,115,22,0.3)] hover:scale-[1.02] cursor-pointer transition-all active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4" />
            <span>🚀 Initialize Next Season</span>
          </button>
        </div>
      )}
    </div>
  );
}
