"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import {
  getOtherTeams,
  getTeamSalarySpace,
  executeTradeAction,
} from "@/app/actions/transactions";
import { getUserDraftPicksAction } from "@/app/actions/offseasonEngine";
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
}

interface CapInfo {
  totalSalaries: number;
  space: number;
  rosterCount: number;
  roster: Player[];
}

export default function TradesPage() {
  const router = useRouter();
  const { userTeamId, currentLeagueDay } = useGameStore();

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
        const cpuCap = await getTeamSalarySpace(selectedCpuTeamId);
        if (cpuCap.success) {
          setCpuCapInfo({
            totalSalaries: cpuCap.totalSalaries!,
            space: cpuCap.space!,
            rosterCount: cpuCap.rosterCount!,
            roster: cpuCap.roster as Player[],
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
  const userNewPayroll = (userCapInfo?.totalSalaries || 0) - userSelectedSalary + cpuSelectedSalary;
  const cpuNewPayroll = (cpuCapInfo?.totalSalaries || 0) - cpuSelectedSalary + userSelectedSalary;

  // Roster post-trade calculations
  const userNewCount = (userCapInfo?.rosterCount || 0) - selectedUserIds.length + selectedCpuIds.length;
  const cpuNewCount = (cpuCapInfo?.rosterCount || 0) - selectedCpuIds.length + selectedUserIds.length;

  const isUserSelected = selectedUserIds.length > 0 || selectedUserPickIds.length > 0;
  const isCpuSelected = selectedCpuIds.length > 0 || selectedCpuPickIds.length > 0;

  // Fairness Check: OVR deficit must be within 15%
  const ovrDiff = Math.abs(userTotalValue - cpuTotalValue);
  const maxAllowedOvrDiff = Math.max(userTotalValue, cpuTotalValue) * 0.15;
  const isOvrFair = ovrDiff <= maxAllowedOvrDiff;
  const ovrDiffPercent =
    Math.max(userTotalValue, cpuTotalValue) > 0
      ? Math.round((ovrDiff / Math.max(userTotalValue, cpuTotalValue)) * 100)
      : 0;

  // Validation Flags
  const isUserCapSpaceOk = userNewPayroll <= 50000000;
  const isCpuCapSpaceOk = cpuNewPayroll <= 50000000;
  const isUserRosterCountOk = userNewCount <= MAX_ROSTER_SIZE;
  const isCpuRosterCountOk = cpuNewCount <= MAX_ROSTER_SIZE;

  let tradeStatus: "pending" | "approved" | "rejected" = "pending";
  let rejectionReason = "";

  if (!isUserSelected || !isCpuSelected) {
    tradeStatus = "pending";
  } else if (!isOvrFair) {
    tradeStatus = "rejected";
    rejectionReason = `Opponent rejected: Value deficit too large (Difference is ${ovrDiffPercent}%, must be within 15%).`;
  } else if (!isUserRosterCountOk) {
    tradeStatus = "rejected";
    rejectionReason = `Trade blocked: Your team exceeds the ${MAX_ROSTER_SIZE}-player roster limit.`;
  } else if (!isCpuRosterCountOk) {
    tradeStatus = "rejected";
    rejectionReason = `Trade blocked: Opponent exceeds the ${MAX_ROSTER_SIZE}-player roster limit.`;
  } else if (!isUserCapSpaceOk) {
    tradeStatus = "rejected";
    rejectionReason = "Trade blocked: Your team exceeds the ₱50,000,000 salary cap.";
  } else if (!isCpuCapSpaceOk) {
    tradeStatus = "rejected";
    rejectionReason = "Trade blocked: Opponent exceeds the ₱50,000,000 salary cap.";
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
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block"> Payroll </span>
                <span className="text-sm font-extrabold text-amber-500">{formatPHP(userCapInfo.totalSalaries)}</span>
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
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block"> Payroll </span>
                <span className="text-sm font-extrabold text-amber-500">{formatPHP(cpuCapInfo.totalSalaries)}</span>
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
                  return (
                    <tr
                      key={p.id}
                      onClick={() => toggleCpuPlayer(p.id)}
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
        </div>
      </div>

      {/* Real-time Trade Evaluation Meter */}
      <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 md:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-8">
          
          {/* Detailed Calculations Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
            {/* Value Check */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Package Value Balance</span>
              <div className="flex items-end gap-2">
                <span className="text-xl font-extrabold text-white">{userTotalValue}</span>
                <span className="text-xs text-zinc-500 mb-1">VS</span>
                <span className="text-xl font-extrabold text-white">{cpuTotalValue}</span>
              </div>
              <span className="text-[10px] text-zinc-400 block mt-0.5">
                ({userSelectedOvr} players + {userSelectedPickValue} picks) vs ({cpuSelectedOvr} players + {cpuSelectedPickValue} picks)
              </span>
              {isUserSelected && isCpuSelected && (
                <span className={`text-[11px] font-semibold block ${isOvrFair ? "text-emerald-400" : "text-red-400"}`}>
                  Difference: {ovrDiffPercent}% {isOvrFair ? "(Fair deal, <= 15%)" : "(Unbalanced, > 15%)"}
                </span>
              )}
            </div>

            {/* User post-trade cap payroll */}
            <div className="space-y-2 border-t md:border-t-0 md:border-l md:border-r border-zinc-900 md:px-6 py-2 md:py-0">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Your New Payroll</span>
              <span className={`text-xl font-extrabold block ${isUserCapSpaceOk ? "text-white" : "text-red-400"}`}>
                {formatPHP(userNewPayroll)}
              </span>
              <span className="text-[10px] font-medium text-zinc-400 block">
                Post-trade size: {userNewCount} / {MAX_ROSTER_SIZE} players
              </span>
            </div>

            {/* CPU post-trade cap payroll */}
            <div className="space-y-2 py-2 md:py-0">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Opponent New Payroll</span>
              <span className={`text-xl font-extrabold block ${isCpuCapSpaceOk ? "text-white" : "text-red-400"}`}>
                {formatPHP(cpuNewPayroll)}
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
