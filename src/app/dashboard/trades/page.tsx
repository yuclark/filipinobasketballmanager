"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import {
  getOtherTeams,
  getTeamSalarySpace,
  executeTradeAction,
} from "@/app/actions/transactions";
import { getUserDraftPicksAction } from "@/app/actions/offseasonEngine";
import { requestTradeOfferForPlayerAction } from "@/app/actions/tradeEngine";
import { MAX_ROSTER_SIZE } from "@/lib/constants";
import {
  ArrowLeftRight,
  TrendingUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Coins,
  Users,
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
  teamId: string | null;
  firstName: string;
  lastName: string;
  age: number;
  hometown: string;
  isFilAm: boolean;
  overall: number;
  salary: number;
  position: string;
  yearsPlayed?: number;
}

interface CapInfo {
  totalSalaries: number;
  space: number;
  rosterCount: number;
  roster: Player[];
  budget: number;
  deadCap: number;
}

export default function TradesPage() {
  const router = useRouter();
  const { userTeamId, currentLeagueDay, triggerAutosave } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [opposingTeams, setOpposingTeams] = useState<Team[]>([]);
  const [selectedCpuTeamId, setSelectedCpuTeamId] = useState<string>("");

  // Roster Cap details
  const [userCapInfo, setUserCapInfo] = useState<CapInfo | null>(null);
  const [cpuCapInfo, setCpuCapInfo] = useState<CapInfo | null>(null);

  // Loading flags
  const [loading, setLoading] = useState(true);
  const [loadingCpuRoster, setLoadingCpuRoster] = useState(false);
  const [tradeExecuting, setTradeExecuting] = useState(false);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [confirmingTrade, setConfirmingTrade] = useState(false);

  // Checkbox selections
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedCpuIds, setSelectedCpuIds] = useState<string[]>([]);

  // Draft pick lists and selections
  const [userDraftPicks, setUserDraftPicks] = useState<any[]>([]);
  const [cpuDraftPicks, setCpuDraftPicks] = useState<any[]>([]);
  const [selectedUserPickIds, setSelectedUserPickIds] = useState<string[]>([]);
  const [selectedCpuPickIds, setSelectedCpuPickIds] = useState<string[]>([]);

  // Counter-offers state
  const [cpuProposals, setCpuProposals] = useState<any[] | null>(null);
  const [requestingOffers, setRequestingOffers] = useState(false);
  const [proposalsError, setProposalsError] = useState<string | null>(null);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);

  // Find CPU cornerstone
  const cpuCornerstone = useMemo(() => {
    if (!cpuCapInfo?.roster || cpuCapInfo.roster.length === 0) return null;
    return [...cpuCapInfo.roster].sort((a, b) => {
      if (b.overall !== a.overall) return b.overall - a.overall;
      return a.age - b.age;
    })[0];
  }, [cpuCapInfo?.roster]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch initial teams list and user roster
  useEffect(() => {
    if (!mounted || !userTeamId) return;

    async function loadInitialData() {
      try {
        setLoading(true);
        const otherTeams = (await getOtherTeams(userTeamId!)) as Team[];
        setOpposingTeams(otherTeams);
        if (otherTeams.length > 0) {
          setSelectedCpuTeamId(otherTeams[0].id);
        }

        const userCap = await getTeamSalarySpace(userTeamId!);
        if (userCap.success) {
          setUserCapInfo({
            totalSalaries: userCap.totalSalaries!,
            space: userCap.space!,
            rosterCount: userCap.rosterCount!,
            roster: userCap.roster as Player[],
            budget: userCap.budget!,
            deadCap: userCap.deadCap!,
          });
        }

        const picksRes = await getUserDraftPicksAction(userTeamId!);
        if (picksRes.success && picksRes.picks) {
          setUserDraftPicks(picksRes.picks);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, [mounted, userTeamId]);

  // Fetch CPU roster details when selectedCpuTeamId changes
  useEffect(() => {
    if (!mounted || !selectedCpuTeamId) return;

    async function loadCpuRoster() {
      try {
        setLoadingCpuRoster(true);
        setSelectedCpuIds([]); // Clear previous trade selection
        setSelectedCpuPickIds([]); // Clear previous trade selection
        setCpuProposals(null);
        setProposalsError(null);
        setAutoUpdateEnabled(false);
        const cpuCap = await getTeamSalarySpace(selectedCpuTeamId);
        if (cpuCap.success) {
          setCpuCapInfo({
            totalSalaries: cpuCap.totalSalaries!,
            space: cpuCap.space!,
            rosterCount: cpuCap.rosterCount!,
            roster: cpuCap.roster as Player[],
            budget: cpuCap.budget!,
            deadCap: cpuCap.deadCap!,
          });
        }

        const cpuPicksRes = await getUserDraftPicksAction(selectedCpuTeamId);
        if (cpuPicksRes.success && cpuPicksRes.picks) {
          setCpuDraftPicks(cpuPicksRes.picks);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingCpuRoster(false);
      }
    }
    loadCpuRoster();
  }, [selectedCpuTeamId, mounted]);

  // Auto-update counter-offers when CPU assets selection changes
  useEffect(() => {
    if (!mounted || !autoUpdateEnabled) return;

    if (selectedCpuIds.length === 0 && selectedCpuPickIds.length === 0) {
      setCpuProposals(null);
      setProposalsError(null);
      return;
    }

    if (!userTeamId || !selectedCpuTeamId) return;

    const fetchOffers = async () => {
      setRequestingOffers(true);
      setProposalsError(null);
      try {
        const res = await requestTradeOfferForPlayerAction(
          userTeamId,
          selectedCpuTeamId,
          selectedCpuIds,
          selectedCpuPickIds
        );
        if (res.success && res.offers) {
          setCpuProposals(res.offers);
        } else {
          setCpuProposals([]);
          setProposalsError(res.error || "Failed to query opposing front office.");
        }
      } catch (err) {
        console.error(err);
        setProposalsError("Failed to communicate with opposing franchise.");
      } finally {
        setRequestingOffers(false);
      }
    };

    // Debounce slightly to prevent double execution on fast clicks
    const timer = setTimeout(fetchOffers, 250);
    return () => clearTimeout(timer);
  }, [selectedCpuIds, selectedCpuPickIds, userTeamId, selectedCpuTeamId, autoUpdateEnabled, mounted]);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const isDeadlinePassed = currentLeagueDay > 50;

  if (isDeadlinePassed) {
    return (
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-12 text-center max-w-2xl mx-auto shadow-2xl relative overflow-hidden mt-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-red-500/5 blur-[80px] rounded-full pointer-events-none" />
        <span className="p-4 bg-red-500/10 rounded-2xl text-red-500 inline-block mb-6 border border-red-500/20">
          <ArrowLeftRight className="w-10 h-10" />
        </span>
        <h3 className="text-2xl font-extrabold text-white tracking-tight mb-3">🔒 Trade Window Closed</h3>
        <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
          The trade deadline passed on Day 50. Trade operations, roster swaps, and player negotiations are locked until the offseason.
        </p>
      </div>
    );
  }

  // Checkbox selectors
  const toggleUserPlayer = (playerId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
  };

  const toggleCpuPlayer = (playerId: string) => {
    if (cpuCornerstone && playerId === cpuCornerstone.id) return; // Block selecting CPU cornerstone
    setSelectedCpuIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
  };

  const toggleUserPick = (pickId: string) => {
    setSelectedUserPickIds((prev) =>
      prev.includes(pickId) ? prev.filter((id) => id !== pickId) : [...prev, pickId]
    );
  };

  const toggleCpuPick = (pickId: string) => {
    setSelectedCpuPickIds((prev) =>
      prev.includes(pickId) ? prev.filter((id) => id !== pickId) : [...prev, pickId]
    );
  };

  // Dynamic Trade Evaluation
  const userSelectedPlayers = userCapInfo?.roster.filter((p) => selectedUserIds.includes(p.id)) || [];
  const cpuSelectedPlayers = cpuCapInfo?.roster.filter((p) => selectedCpuIds.includes(p.id)) || [];

  const userSelectedOvr = userSelectedPlayers.reduce((sum, p) => sum + p.overall, 0);
  const cpuSelectedOvr = cpuSelectedPlayers.reduce((sum, p) => sum + p.overall, 0);

  const userSelectedPickValue = userDraftPicks
    .filter((p) => selectedUserPickIds.includes(p.id))
    .reduce((sum, p) => sum + (p.round === 1 ? 78 : 65), 0);
  const cpuSelectedPickValue = cpuDraftPicks
    .filter((p) => selectedCpuPickIds.includes(p.id))
    .reduce((sum, p) => sum + (p.round === 1 ? 78 : 65), 0);

  const userTotalValue = userSelectedOvr + userSelectedPickValue;
  const cpuTotalValue = cpuSelectedOvr + cpuSelectedPickValue;

  const userSelectedSalary = userSelectedPlayers.reduce((sum, p) => sum + p.salary, 0);
  const cpuSelectedSalary = cpuSelectedPlayers.reduce((sum, p) => sum + p.salary, 0);

  // Budget post-trade calculations
  const userNewPayroll = (userCapInfo?.totalSalaries || 0) - userSelectedSalary + cpuSelectedSalary + (userCapInfo?.deadCap || 0);
  const cpuNewPayroll = (cpuCapInfo?.totalSalaries || 0) - cpuSelectedSalary + userSelectedSalary + (cpuCapInfo?.deadCap || 0);

  // Roster post-trade calculations
  const userNewCount = (userCapInfo?.rosterCount || 0) - selectedUserIds.length + selectedCpuIds.length;
  const cpuNewCount = (cpuCapInfo?.rosterCount || 0) - selectedCpuIds.length + selectedUserIds.length;

  const isUserSelected = selectedUserIds.length > 0 || selectedUserPickIds.length > 0;
  const isCpuSelected = selectedCpuIds.length > 0 || selectedCpuPickIds.length > 0;

  // Strict CPU Rationality checks (Exponential Values & Star Protections)
  const getExponentialVal = (overall: number) => Math.pow(1.10, overall);
  const getPickExponentialVal = (round: number) => Math.pow(1.10, round === 1 ? 77 : 64);

  const userExpValue = userSelectedPlayers.reduce((sum, p) => sum + getExponentialVal(p.overall), 0) +
                       userDraftPicks.filter(p => selectedUserPickIds.includes(p.id)).reduce((sum, p) => sum + getPickExponentialVal(p.round), 0);

  const cpuExpValue = cpuSelectedPlayers.reduce((sum, p) => sum + getExponentialVal(p.overall), 0) +
                       cpuDraftPicks.filter(p => selectedCpuPickIds.includes(p.id)).reduce((sum, p) => sum + getPickExponentialVal(p.round), 0);

  const maxCpuOvrSelected = cpuSelectedPlayers.length > 0 ? Math.max(...cpuSelectedPlayers.map(p => p.overall)) : 0;
  let requiredRatioSelected = 1.0;
  if (maxCpuOvrSelected >= 88) {
    requiredRatioSelected = 1.10; // 10% premium for superstars
  } else if (maxCpuOvrSelected >= 80) {
    requiredRatioSelected = 1.05; // 5% premium for stars
  }

  const isValSufficient = userExpValue >= cpuExpValue * requiredRatioSelected;
  const isValExcessive = userExpValue > cpuExpValue * 1.4;

  const maxUserOvrSelected = userSelectedPlayers.length > 0 ? Math.max(...userSelectedPlayers.map(p => p.overall)) : 0;
  const hasUserFirstRoundPickSelected = userDraftPicks.filter(p => selectedUserPickIds.includes(p.id)).some(p => p.round === 1);

  let starCheckPassed = true;
  let starCheckReason = "";

  if (maxCpuOvrSelected >= 80) {
    if (maxCpuOvrSelected >= 88) {
      const hasProperPlayer = maxUserOvrSelected >= 82;
      const hasFallback = maxUserOvrSelected >= 78 && hasUserFirstRoundPickSelected;
      if (!hasProperPlayer && !hasFallback) {
        starCheckPassed = false;
        starCheckReason = `CPU refuses to trade superstar player (OVR ${maxCpuOvrSelected}) without receiving a high-quality starter (OVR 82+) or a solid starter (OVR 78+) and a first-round draft pick.`;
      }
    } else {
      const hasProperPlayer = maxUserOvrSelected >= 75;
      if (!hasProperPlayer && !hasUserFirstRoundPickSelected) {
        starCheckPassed = false;
        starCheckReason = `CPU refuses to trade star player (OVR ${maxCpuOvrSelected}) without receiving at least a solid rotation player (OVR 75+) or a first-round draft pick.`;
      }
    }
  }

  // Validation Flags
  const isUserCapSpaceOk = userNewPayroll <= (userCapInfo?.budget || 50000000);
  const isCpuCapSpaceOk = cpuNewPayroll <= (cpuCapInfo?.budget || 50000000);
  const isUserRosterCountOk = userNewCount <= MAX_ROSTER_SIZE;
  const isCpuRosterCountOk = cpuNewCount <= MAX_ROSTER_SIZE;

  let tradeStatus: "pending" | "approved" | "rejected" = "pending";
  let rejectionReason = "";

  if (!isUserSelected || !isCpuSelected) {
    tradeStatus = "pending";
  } else if (!isValSufficient) {
    tradeStatus = "rejected";
    rejectionReason = `Opponent rejected: The asset value offered is insufficient.`;
  } else if (!starCheckPassed) {
    tradeStatus = "rejected";
    rejectionReason = `Opponent rejected: ${starCheckReason}`;
  } else if (isValExcessive) {
    tradeStatus = "rejected";
    rejectionReason = `League office blocked: The trade is excessively lopsided in favor of the opponent.`;
  } else if (!isUserRosterCountOk) {
    tradeStatus = "rejected";
    rejectionReason = `Trade blocked: Your team exceeds the ${MAX_ROSTER_SIZE}-player roster limit.`;
  } else if (!isCpuRosterCountOk) {
    tradeStatus = "rejected";
    rejectionReason = `Trade blocked: Opponent exceeds the ${MAX_ROSTER_SIZE}-player roster limit.`;
  } else if (!isUserCapSpaceOk) {
    tradeStatus = "rejected";
    rejectionReason = `Trade blocked: Your team exceeds the ₱${(userCapInfo?.budget || 50000000).toLocaleString("en-PH")} salary cap.`;
  } else if (!isCpuCapSpaceOk) {
    tradeStatus = "rejected";
    rejectionReason = `Trade blocked: Opponent exceeds the ₱${(cpuCapInfo?.budget || 50000000).toLocaleString("en-PH")} salary cap.`;
  } else {
    tradeStatus = "approved";
  }

  // Submit Proposal
  const handleSubmitTrade = async () => {
    if (tradeStatus !== "approved" || !userTeamId || !selectedCpuTeamId) return;

    if (!confirmingTrade) {
      setConfirmingTrade(true);
      return;
    }
    setConfirmingTrade(false);
    setTradeSuccess(null);
    setTradeError(null);
    setTradeExecuting(true);
    try {
      const res = await executeTradeAction(
        userTeamId,
        selectedUserIds,
        selectedCpuTeamId,
        selectedCpuIds,
        selectedUserPickIds,
        selectedCpuPickIds
      );

      if (res.success) {
        setTradeSuccess("Trade executed successfully! Roster updated.");
        setSelectedUserIds([]);
        setSelectedCpuIds([]);
        setSelectedUserPickIds([]);
        setSelectedCpuPickIds([]);
        router.refresh();
        triggerAutosave();
      } else {
        setTradeError(res.error || "Trade proposal failed. Check roster size and salary requirements.");
      }
    } catch (err) {
      console.error(err);
      setTradeError("Error executing trade transaction.");
    } finally {
      setTradeExecuting(false);
    }
  };

  const handleRequestOffers = async () => {
    if ((selectedCpuIds.length === 0 && selectedCpuPickIds.length === 0) || !userTeamId || !selectedCpuTeamId) return;

    setRequestingOffers(true);
    setCpuProposals(null);
    setProposalsError(null);
    setAutoUpdateEnabled(true);

    try {
      const res = await requestTradeOfferForPlayerAction(
        userTeamId,
        selectedCpuTeamId,
        selectedCpuIds,
        selectedCpuPickIds
      );

      if (res.success && res.offers) {
        setCpuProposals(res.offers);
      } else {
        setCpuProposals([]);
        setProposalsError(res.error || "Failed to query opposing front office.");
      }
    } catch (err) {
      console.error(err);
      setProposalsError("Failed to communicate with opposing franchise.");
    } finally {
      setRequestingOffers(false);
    }
  };

  const handleApplyProposal = (playerIds: string[], pickIds: string[]) => {
    setSelectedUserIds(playerIds);
    setSelectedUserPickIds(pickIds);
    setCpuProposals(null); // Clear once selected
    setAutoUpdateEnabled(false);
  };

  const formatPHP = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-8 relative">
      {tradeExecuting && (
        <div className="fixed inset-0 bg-zinc-950/70 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
          <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl text-center shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
            <h3 className="text-lg font-bold text-white font-sans">Processing Trade...</h3>
            <p className="text-zinc-500 text-xs">Swapping players and updating salary records transactionally.</p>
          </div>
        </div>
      )}

      {/* Opposing Team Selector Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-orange-500/10 rounded-2xl text-orange-500">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Trade Operations Office</h3>
            <p className="text-zinc-500 text-sm">Select an opposing FBM franchise to start contract negotiations.</p>
          </div>
        </div>

        <div className="w-full md:w-72">
          <select
            value={selectedCpuTeamId}
            onChange={(e) => setSelectedCpuTeamId(e.target.value)}
            className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl text-zinc-100 focus:outline-none transition-all cursor-pointer font-semibold text-sm"
          >
            {opposingTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.city} {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Side-by-Side Rosters Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side: User Franchise */}
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-lg font-bold text-white">Your Franchise</h4>
              <p className="text-xs text-zinc-500 mt-1">Select players to send out</p>
            </div>
            {userCapInfo && (
              <div className="text-right">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block"> Payroll / Cap </span>
                <span className="text-sm font-extrabold text-amber-500">
                  {formatPHP(userCapInfo.totalSalaries + userCapInfo.deadCap)} / {formatPHP(userCapInfo.budget)}
                </span>
                {userCapInfo.deadCap > 0 && (
                  <span className="text-[9px] text-zinc-500 block">Includes {formatPHP(userCapInfo.deadCap)} dead cap</span>
                )}
                <span className="text-[10px] font-medium text-zinc-400 block mt-0.5">{userCapInfo.rosterCount} / {MAX_ROSTER_SIZE} players</span>
              </div>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto rounded-xl border border-zinc-900 bg-zinc-950/20">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider text-[10px] sticky top-0">
                  <th className="py-3.5 px-4 w-12 text-center">Select</th>
                  <th className="py-3.5 px-2">Player</th>
                  <th className="py-3.5 px-2 text-center">Pos</th>
                  <th className="py-3.5 px-2 text-center">OVR</th>
                  <th className="py-3.5 px-4 text-right">Contract</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {userCapInfo?.roster.map((p) => {
                  const isChecked = selectedUserIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => toggleUserPlayer(p.id)}
                      className={`hover:bg-zinc-900/50 cursor-pointer transition-colors ${
                        isChecked ? "bg-orange-500/5" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Controlled via row click
                          className="w-4.5 h-4.5 accent-orange-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-2 font-bold text-zinc-200">
                        {p.firstName} {p.lastName}
                      </td>
                      <td className="py-3.5 px-2 text-center font-bold text-zinc-400">{p.position}</td>
                      <td className="py-3.5 px-2 text-center">
                        <span className="inline-flex items-center justify-center font-extrabold w-7 h-7 bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-lg">
                          {p.overall}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-zinc-300">
                        {formatPHP(p.salary)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Draft Picks Selector */}
          <div className="mt-6">
            <h5 className="text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Available Draft Picks</h5>
            {userDraftPicks.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No future draft picks available.</p>
            ) : (
              <div className="max-h-[150px] overflow-y-auto rounded-xl border border-zinc-900 bg-zinc-950/20 divide-y divide-zinc-900">
                {userDraftPicks.map((pick) => {
                  const isChecked = selectedUserPickIds.includes(pick.id);
                  return (
                    <div
                      key={pick.id}
                      onClick={() => toggleUserPick(pick.id)}
                      className={`flex items-center justify-between py-2 px-4 cursor-pointer hover:bg-zinc-900/50 transition-colors text-xs ${
                        isChecked ? "bg-orange-500/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Controlled via container click
                          className="w-4 h-4 accent-orange-500 cursor-pointer"
                        />
                        <div>
                          <p className="font-bold text-zinc-200">
                            Season {pick.season} Round {pick.round} Pick
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            Original: {pick.originalTeamCity} {pick.originalTeamName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-zinc-400 block">Value</span>
                        <span className="font-extrabold text-amber-500">{pick.round === 1 ? 78 : 65} pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Opposing CPU Franchise */}
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm relative">
          {loadingCpuRoster && (
            <div className="absolute inset-0 bg-zinc-950/40 rounded-3xl flex items-center justify-center z-10 backdrop-blur-xs">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
          )}

          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-lg font-bold text-white">Opponent Franchise</h4>
              <p className="text-xs text-zinc-500 mt-1">Select players to acquire</p>
            </div>
            {cpuCapInfo && (
              <div className="text-right">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block"> Payroll / Cap </span>
                <span className="text-sm font-extrabold text-amber-500">
                  {formatPHP(cpuCapInfo.totalSalaries + cpuCapInfo.deadCap)} / {formatPHP(cpuCapInfo.budget)}
                </span>
                {cpuCapInfo.deadCap > 0 && (
                  <span className="text-[9px] text-zinc-500 block">Includes {formatPHP(cpuCapInfo.deadCap)} dead cap</span>
                )}
                <span className="text-[10px] font-medium text-zinc-400 block mt-0.5">{cpuCapInfo.rosterCount} / {MAX_ROSTER_SIZE} players</span>
              </div>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto rounded-xl border border-zinc-900 bg-zinc-950/20">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider text-[10px] sticky top-0">
                  <th className="py-3.5 px-4 w-12 text-center">Select</th>
                  <th className="py-3.5 px-2">Player</th>
                  <th className="py-3.5 px-2 text-center">Pos</th>
                  <th className="py-3.5 px-2 text-center">OVR</th>
                  <th className="py-3.5 px-4 text-right">Contract</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {cpuCapInfo?.roster.map((p) => {
                  const isChecked = selectedCpuIds.includes(p.id);
                  const isCornerstone = cpuCornerstone && p.id === cpuCornerstone.id;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => toggleCpuPlayer(p.id)}
                      className={`transition-colors ${
                        isCornerstone
                          ? "bg-zinc-950/40 opacity-70 cursor-not-allowed"
                          : "hover:bg-zinc-900/50 cursor-pointer"
                      } ${isChecked ? "bg-orange-500/5" : ""}`}
                      title={isCornerstone ? "Franchise Cornerstone (Untouchable)" : undefined}
                    >
                      <td className="py-3.5 px-4 text-center">
                        {isCornerstone ? (
                          <span className="text-zinc-600 block text-center select-none text-xs">🔒</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Controlled via row click
                            className="w-4.5 h-4.5 accent-orange-500 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="py-3.5 px-2 font-bold text-zinc-200">
                        <div className="flex items-center gap-1.5">
                          <span>{p.firstName} {p.lastName}</span>
                          {isCornerstone && (
                            <span className="px-1.5 py-0.5 bg-orange-500/10 border border-orange-500/20 text-[9px] font-extrabold text-orange-400 uppercase rounded tracking-wider">
                              Untouchable
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-2 text-center font-bold text-zinc-400">{p.position}</td>
                      <td className="py-3.5 px-2 text-center">
                        <span className="inline-flex items-center justify-center font-extrabold w-7 h-7 bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-lg">
                          {p.overall}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-zinc-300">
                        {formatPHP(p.salary)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Draft Picks Selector */}
          <div className="mt-6">
            <h5 className="text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Available Draft Picks</h5>
            {cpuDraftPicks.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No future draft picks available.</p>
            ) : (
              <div className="max-h-[150px] overflow-y-auto rounded-xl border border-zinc-900 bg-zinc-950/20 divide-y divide-zinc-900">
                {cpuDraftPicks.map((pick) => {
                  const isChecked = selectedCpuPickIds.includes(pick.id);
                  return (
                    <div
                      key={pick.id}
                      onClick={() => toggleCpuPick(pick.id)}
                      className={`flex items-center justify-between py-2 px-4 cursor-pointer hover:bg-zinc-900/50 transition-colors text-xs ${
                        isChecked ? "bg-orange-500/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Controlled via container click
                          className="w-4 h-4 accent-orange-500 cursor-pointer"
                        />
                        <div>
                          <p className="font-bold text-zinc-200">
                            Season {pick.season} Round {pick.round} Pick
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            Original: {pick.originalTeamCity} {pick.originalTeamName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-zinc-400 block">Value</span>
                        <span className="font-extrabold text-amber-500">{pick.round === 1 ? 78 : 65} pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Request Offer Trigger */}
          {(selectedCpuIds.length > 0 || selectedCpuPickIds.length > 0) && !autoUpdateEnabled && (
            <div className="mt-4 border-t border-zinc-800/60 pt-4">
              <button
                onClick={handleRequestOffers}
                disabled={requestingOffers}
                className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {requestingOffers ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing Roster Assets...</span>
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Request Counter-Offers</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CPU Counter-Offers Panel */}
      {(cpuProposals !== null || proposalsError !== null || requestingOffers) && (
        <div className="bg-zinc-900/40 border border-orange-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[80px] rounded-full pointer-events-none" />
          <div className="flex justify-between items-center mb-4">
            <div>
              <h4 className="text-md font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                CPU Franchise Counter-Offers
              </h4>
              <p className="text-zinc-500 text-xs mt-0.5">
                The opposing franchise reviewed your roster. Select a package to pre-fill the trade.
              </p>
            </div>
            {(cpuProposals !== null || proposalsError !== null) && (
              <button
                onClick={() => {
                  setCpuProposals(null);
                  setProposalsError(null);
                }}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-bold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {requestingOffers ? (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
              <span className="text-zinc-400 text-xs font-bold">Analyzing roster assets for counter-offers...</span>
            </div>
          ) : proposalsError ? (
            <p className="text-zinc-400 text-xs italic bg-zinc-950/40 p-4 border border-zinc-900 rounded-xl">
              {proposalsError}
            </p>
          ) : cpuProposals && cpuProposals.length === 0 ? (
            <p className="text-zinc-400 text-xs italic bg-zinc-950/40 p-4 border border-zinc-900 rounded-xl">
              The opposing team is not interested in trading the selected assets for any combinations of your current roster players or picks due to salary constraints, roster limits, or value mismatch.
            </p>
          ) : (
            cpuProposals && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cpuProposals.map((proposal, idx) => (
                  <div
                    key={idx}
                    className="bg-zinc-950/60 border border-zinc-900 hover:border-zinc-800 rounded-2xl p-4 flex justify-between items-center gap-4 transition-all"
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block">Option {idx + 1}</span>
                      <p className="text-zinc-200 text-xs font-semibold">{proposal.description}</p>
                      <span className="text-[10px] text-zinc-500 block">Combined Value: {Math.round(proposal.value)} pts</span>
                    </div>
                    <button
                      onClick={() => handleApplyProposal(proposal.playerIds, proposal.pickIds)}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white font-bold rounded-xl text-xs transition-all cursor-pointer border border-zinc-800 hover:border-zinc-700"
                    >
                      Select Option
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Real-time Trade Evaluation Meter */}
      <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 md:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-8">
          
          {/* Detailed Calculations Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
            {/* Value Check */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Package Value Balance</span>
              <div className="flex items-end gap-2">
                <span className="text-xl font-extrabold text-white">{Math.round(userExpValue)}</span>
                <span className="text-xs text-zinc-500 mb-1">VS</span>
                <span className="text-xl font-extrabold text-white">{Math.round(cpuExpValue)}</span>
              </div>
              <span className="text-[10px] text-zinc-400 block mt-0.5">
                (Based on strict CPU talent valuation)
              </span>
              {isUserSelected && isCpuSelected && (
                <span className={`text-[11px] font-semibold block ${tradeStatus === "approved" ? "text-emerald-400" : "text-red-400"}`}>
                  {tradeStatus === "approved" ? "✓ Fair Value Deal" : "✗ Value Mismatch / Star Rule"}
                </span>
              )}
            </div>

            {/* User post-trade cap payroll */}
            <div className="space-y-2 border-t md:border-t-0 md:border-l md:border-r border-zinc-900 md:px-6 py-2 md:py-0">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Your New Payroll</span>
              <span className={`text-xl font-extrabold block ${isUserCapSpaceOk ? "text-white" : "text-red-400"}`}>
                {formatPHP(userNewPayroll)} <span className="text-xs font-normal text-zinc-500">/ {formatPHP(userCapInfo?.budget || 50000000)}</span>
              </span>
              <span className="text-[10px] font-medium text-zinc-400 block">
                Post-trade size: {userNewCount} / {MAX_ROSTER_SIZE} players
              </span>
            </div>

            {/* CPU post-trade cap payroll */}
            <div className="space-y-2 py-2 md:py-0">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Opponent New Payroll</span>
              <span className={`text-xl font-extrabold block ${isCpuCapSpaceOk ? "text-white" : "text-red-400"}`}>
                {formatPHP(cpuNewPayroll)} <span className="text-xs font-normal text-zinc-500">/ {formatPHP(cpuCapInfo?.budget || 50000000)}</span>
              </span>
              <span className="text-[10px] font-medium text-zinc-400 block">
                Post-trade size: {cpuNewCount} / {MAX_ROSTER_SIZE} players
              </span>
            </div>
          </div>

          {/* Action and status check */}
          <div className="min-w-[280px] bg-zinc-950/60 border border-zinc-900 rounded-2xl p-5 flex flex-col justify-between gap-4">
            {tradeStatus === "pending" && (
              <div className="flex items-start gap-3 text-zinc-500">
                <ArrowLeftRight className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block text-zinc-400">Status Pending</span>
                  <span className="text-[11px] font-medium block leading-tight text-zinc-500 mt-1">
                    Select players from both rosters to evaluate the deal.
                  </span>
                </div>
              </div>
            )}

            {tradeStatus === "rejected" && (
              <div className="flex items-start gap-3 text-red-400">
                <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block text-red-400">Trade Denied</span>
                  <span className="text-[11px] font-medium block leading-tight text-red-300 mt-1">
                    {rejectionReason}
                  </span>
                </div>
              </div>
            )}

            {tradeStatus === "approved" && (
              <div className="flex items-start gap-3 text-emerald-400">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block text-emerald-400">Trade Accepted</span>
                  <span className="text-[11px] font-medium block leading-tight text-emerald-300 mt-1">
                    League compliance checks passed. CPU has accepted the proposal!
                  </span>
                </div>
              </div>
            )}

            {tradeSuccess && (
              <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-semibold">
                ✓ {tradeSuccess}
              </div>
            )}
            {tradeError && (
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 font-semibold">
                ✕ {tradeError}
              </div>
            )}

            {confirmingTrade ? (
              <div className="space-y-2">
                <p className="text-[11px] text-amber-400 font-semibold text-center">Confirm this trade?</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmitTrade}
                    disabled={tradeExecuting}
                    className="flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-orange-500 to-amber-500 text-white cursor-pointer transition-all"
                  >
                    {tradeExecuting ? "Processing..." : "Confirm Trade"}
                  </button>
                  <button
                    onClick={() => setConfirmingTrade(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-zinc-800 text-zinc-300 cursor-pointer hover:bg-zinc-700 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleSubmitTrade}
                disabled={tradeStatus !== "approved" || tradeExecuting}
                className={`w-full py-3.5 rounded-xl text-sm font-extrabold uppercase tracking-wide cursor-pointer transition-all active:scale-[0.98] ${
                  tradeStatus === "approved"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_4px_15px_rgba(249,115,22,0.3)] hover:scale-[1.01]"
                    : "bg-zinc-900 text-zinc-600 border border-zinc-850 cursor-not-allowed"
                }`}
              >
                Submit Trade Proposal
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
