"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useGameStore } from "@/store/useGameStore";
import { getTeamFinancesAction } from "@/app/actions/financeEngine";
import {
  Coins,
  TrendingUp,
  Loader2,
  TrendingDown,
  Info,
  DollarSign,
  AlertTriangle,
  User,
  Shield,
  HelpCircle
} from "lucide-react";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  overall: number;
  salary: number;
  contractYearsRemaining: number;
  position: string;
}

interface Team {
  id: string;
  name: string;
  city: string;
  budget: number;
  deadCap: number;
}

interface DropdownTeam {
  id: string;
  name: string;
  city: string;
}

export default function FinancesPage() {
  const router = useRouter();
  const { userTeamId } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // States for selected team finances
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [team, setTeam] = useState<Team | null>(null);
  const [playersList, setPlayersList] = useState<Player[]>([]);
  const [teamsDropdown, setTeamsDropdown] = useState<DropdownTeam[]>([]);
  const [currentSeasonYear, setCurrentSeasonYear] = useState<number>(2026);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Set default team id once state is loaded
  useEffect(() => {
    if (mounted && userTeamId) {
      setSelectedTeamId(userTeamId);
    }
  }, [mounted, userTeamId]);

  // Load team details when selectedTeamId changes
  useEffect(() => {
    if (!mounted || !selectedTeamId) return;

    const fetchFinances = async () => {
      try {
        setReloading(true);
        const res = await getTeamFinancesAction(selectedTeamId);
        if (res.success && res.team && res.players && res.allTeams) {
          setTeam(res.team as Team);
          setPlayersList(res.players as Player[]);
          setTeamsDropdown(res.allTeams as DropdownTeam[]);
          setCurrentSeasonYear(res.currentSeasonYear);
          setError(null);
        } else {
          setError(res.error || "Failed to load team finances.");
        }
      } catch (err) {
        console.error(err);
        setError("Error loading finances from the server.");
      } finally {
        setLoading(false);
        setReloading(false);
      }
    };

    fetchFinances();
  }, [mounted, selectedTeamId]);

  // Format currency helper
  const formatPHP = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculations for current year
  const activePayroll = useMemo(() => {
    return playersList.reduce((sum, p) => sum + p.salary, 0);
  }, [playersList]);

  const deadCap = team?.deadCap ?? 0;
  const totalPayroll = activePayroll + deadCap;
  const capBudget = team?.budget ?? 50000000;
  const availableCap = capBudget - totalPayroll;

  // Find the largest guaranteed contract
  const largestGuaranteePlayer = useMemo(() => {
    if (playersList.length === 0) return null;
    return [...playersList].sort((a, b) => {
      const totalA = a.salary * a.contractYearsRemaining;
      const totalB = b.salary * b.contractYearsRemaining;
      return totalB - totalA;
    })[0];
  }, [playersList]);

  // Compute 5-year totals
  const fiveYearTotals = useMemo(() => {
    return [0, 1, 2, 3, 4].map((offset) => {
      const activeSum = playersList.reduce((sum, p) => {
        return p.contractYearsRemaining >= offset + 1 ? sum + p.salary : sum;
      }, 0);
      return offset === 0 ? activeSum + deadCap : activeSum;
    });
  }, [playersList, deadCap]);

  const totalGuaranteedAll = useMemo(() => {
    const playersGuarantee = playersList.reduce(
      (sum, p) => sum + p.salary * p.contractYearsRemaining,
      0
    );
    return playersGuarantee + deadCap;
  }, [playersList, deadCap]);

  // Cap Space percentages for progress bar
  const activePct = Math.min(100, (activePayroll / capBudget) * 100);
  const deadPct = Math.min(100 - activePct, (deadCap / capBudget) * 100);
  const freePct = Math.max(0, 100 - activePct - deadPct);

  // Generate Year label formatted as '2026-27'
  const getYearLabel = (year: number) => {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  };

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p className="mb-4">{error || "Failed to load team finances data."}</p>
        <button
          onClick={() => setSelectedTeamId(userTeamId || "")}
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors"
        >
          Reset View
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header with Switcher Dropdown */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Coins className="w-8 h-8 text-amber-500" />
            <span>Team Payroll & Contracts</span>
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Analyze active salaries, guarantee structures, dead cap, and future cap commitments.
          </p>
        </div>

        <div className="w-full md:w-80">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 px-1">
            Inspect Franchise Payroll
          </label>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-2xl text-zinc-100 focus:outline-none transition-all cursor-pointer font-bold text-sm shadow-md"
          >
            {teamsDropdown.map((t) => (
              <option key={t.id} value={t.id}>
                {t.city} {t.name} {t.id === userTeamId ? "(My Team)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Salary Cap Budget */}
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Coins className="w-20 h-20 text-white" />
          </div>
          <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest block">
            Salary Cap Limit
          </span>
          <span className="text-2xl font-black text-zinc-100 block mt-2">
            {formatPHP(capBudget)}
          </span>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-zinc-400 font-semibold">
            <Info className="w-3.5 h-3.5 text-zinc-500" />
            <span>League hard limit budget</span>
          </div>
        </div>

        {/* Card 2: Active Payroll */}
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <TrendingUp className="w-20 h-20 text-white" />
          </div>
          <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest block">
            Committed Payroll
          </span>
          <span className="text-2xl font-black text-amber-500 block mt-2">
            {formatPHP(totalPayroll)}
          </span>
          <div className="flex items-center justify-between mt-3 text-xs text-zinc-400 font-medium">
            <span>Roster: {formatPHP(activePayroll)}</span>
            <span>Dead Cap: {formatPHP(deadCap)}</span>
          </div>
        </div>

        {/* Card 3: Available Cap Space */}
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            {availableCap >= 0 ? (
              <TrendingUp className="w-20 h-20 text-green-500" />
            ) : (
              <TrendingDown className="w-20 h-20 text-red-500" />
            )}
          </div>
          <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest block">
            Available Cap Space
          </span>
          <span
            className={`text-2xl font-black block mt-2 ${
              availableCap >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {formatPHP(availableCap)}
          </span>
          <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold">
            {availableCap >= 0 ? (
              <span className="text-green-500/80">✔ Room to sign agents</span>
            ) : (
              <span className="text-red-500/80 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Over Cap Limit
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Largest Guarantee */}
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <User className="w-20 h-20 text-white" />
          </div>
          <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest block">
            Largest Guarantee
          </span>
          {largestGuaranteePlayer ? (
            <>
              <Link
                href={`/dashboard/players/${largestGuaranteePlayer.id}`}
                className="text-sm font-extrabold text-zinc-150 hover:text-orange-400 block mt-2 truncate transition-colors"
              >
                {largestGuaranteePlayer.firstName} {largestGuaranteePlayer.lastName}
              </Link>
              <span className="text-xs font-semibold text-zinc-400 block mt-0.5">
                {formatPHP(largestGuaranteePlayer.salary * largestGuaranteePlayer.contractYearsRemaining)} total
              </span>
            </>
          ) : (
            <span className="text-sm font-semibold text-zinc-400 block mt-2">
              No contracts active
            </span>
          )}
          <div className="flex items-center gap-1 mt-3 text-xs text-zinc-500 font-medium">
            <span>Remaining years: {largestGuaranteePlayer?.contractYearsRemaining ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Cap space progress bar */}
      <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-md backdrop-blur-sm relative">
        <div className="flex justify-between items-center mb-3 text-xs font-extrabold tracking-wide uppercase text-zinc-400">
          <span>Cap Utilization Summary</span>
          <span>
            {((totalPayroll / capBudget) * 100).toFixed(1)}% Allocated
          </span>
        </div>

        {/* The segmented bar */}
        <div className="w-full h-4 bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-800 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-l-full"
            style={{ width: `${activePct}%` }}
            title={`Active Payroll: ${formatPHP(activePayroll)}`}
          />
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-red-600"
            style={{ width: `${deadPct}%` }}
            title={`Dead Cap: ${formatPHP(deadCap)}`}
          />
          <div
            className="h-full bg-zinc-900"
            style={{ width: `${freePct}%` }}
            title={`Available Cap: ${formatPHP(availableCap)}`}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center flex-wrap gap-6 mt-4 text-xs font-semibold text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-orange-500 rounded-full" />
            <span>Active Salaries ({formatPHP(activePayroll)})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full" />
            <span>Dead Cap Waives ({formatPHP(deadCap)})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-zinc-800 rounded-full border border-zinc-750" />
            <span>Available Cap Space ({formatPHP(availableCap)})</span>
          </div>
        </div>
      </div>

      {/* Spotrac-style Spreadsheet Sheet */}
      <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm relative overflow-hidden">
        {reloading && (
          <div className="absolute inset-0 bg-zinc-950/40 rounded-3xl flex items-center justify-center z-30 backdrop-blur-xs">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Franchise Contracts Sheet</h3>
            <p className="text-zinc-500 text-sm">
              Displays breakdown of guaranteed salaries over next 5 years (flat yearly payouts).
            </p>
          </div>
        </div>

        {/* Spreadsheet Grid Wrapper */}
        <div className="w-full overflow-x-auto rounded-2xl border border-zinc-900 shadow-md">
          <table className="w-full min-w-[1000px] text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-400 font-extrabold text-xs uppercase tracking-wider select-none">
                <th className="py-4.5 px-6 w-1/4">Player</th>
                <th className="py-4.5 px-4 text-center">Age</th>
                <th className="py-4.5 px-4 text-center">OVR</th>
                <th className="py-4.5 px-4 text-center">Pos</th>
                <th className="py-4.5 px-4 text-center bg-zinc-900/40">
                  {getYearLabel(currentSeasonYear)}
                </th>
                <th className="py-4.5 px-4 text-center">
                  {getYearLabel(currentSeasonYear + 1)}
                </th>
                <th className="py-4.5 px-4 text-center">
                  {getYearLabel(currentSeasonYear + 2)}
                </th>
                <th className="py-4.5 px-4 text-center">
                  {getYearLabel(currentSeasonYear + 3)}
                </th>
                <th className="py-4.5 px-4 text-center">
                  {getYearLabel(currentSeasonYear + 4)}
                </th>
                <th className="py-4.5 px-6 text-right">Guaranteed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/60 bg-zinc-950/10">
              {playersList.length > 0 ? (
                playersList.map((player) => {
                  const totalGuarantee = player.salary * player.contractYearsRemaining;
                  return (
                    <tr
                      key={player.id}
                      className="hover:bg-zinc-900/30 transition-all border-b border-zinc-900/45 group"
                    >
                      {/* Player Name */}
                      <td className="py-4.5 px-6">
                        <div className="flex flex-col">
                          <Link
                            href={`/dashboard/players/${player.id}`}
                            className="font-bold text-zinc-100 hover:text-orange-400 transition-colors"
                          >
                            {player.firstName} {player.lastName}
                          </Link>
                          <span className="text-[10px] font-extrabold text-zinc-550 uppercase tracking-widest mt-0.5">
                            Active Contract
                          </span>
                        </div>
                      </td>

                      {/* Age */}
                      <td className="py-4.5 px-4 text-center font-medium text-zinc-300 text-sm">
                        {player.age}
                      </td>

                      {/* Overall */}
                      <td className="py-4.5 px-4 text-center font-bold text-zinc-200">
                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-md text-xs">
                          {player.overall}
                        </span>
                      </td>

                      {/* Position */}
                      <td className="py-4.5 px-4 text-center font-extrabold text-zinc-400 text-xs">
                        {player.position}
                      </td>

                      {/* 5 Year Columns */}
                      {[0, 1, 2, 3, 4].map((offset) => {
                        const isUnderContract = player.contractYearsRemaining >= offset + 1;
                        return (
                          <td
                            key={offset}
                            className={`py-4.5 px-4 text-center font-bold text-sm transition-colors ${
                              isUnderContract
                                ? "text-green-400 bg-green-500/5 hover:bg-green-500/10 border-r border-zinc-900/20"
                                : "text-zinc-650"
                            }`}
                          >
                            {isUnderContract ? formatPHP(player.salary) : "—"}
                          </td>
                        );
                      })}

                      {/* Total Guarantee Column */}
                      <td className="py-4.5 px-6 text-right font-black text-zinc-200 text-sm bg-zinc-900/10">
                        {formatPHP(totalGuarantee)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-zinc-500">
                    No active players found.
                  </td>
                </tr>
              )}

              {/* Dead Cap Penalty Row */}
              {deadCap > 0 && (
                <tr className="hover:bg-red-500/5 transition-all border-b border-zinc-900/45 bg-red-950/5 text-zinc-400 italic">
                  <td className="py-4.5 px-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-red-400">Dead Cap Penalty</span>
                      <span className="text-[10px] font-extrabold text-zinc-550 uppercase tracking-widest mt-0.5">
                        Waived Player Payouts
                      </span>
                    </div>
                  </td>
                  <td className="py-4.5 px-4 text-center">—</td>
                  <td className="py-4.5 px-4 text-center">—</td>
                  <td className="py-4.5 px-4 text-center">—</td>
                  {/* Current Season column takes the dead cap penalty */}
                  <td className="py-4.5 px-4 text-center font-bold text-sm text-red-400 bg-red-950/15 border-r border-zinc-900/20">
                    {formatPHP(deadCap)}
                  </td>
                  <td className="py-4.5 px-4 text-center text-zinc-650">—</td>
                  <td className="py-4.5 px-4 text-center text-zinc-650">—</td>
                  <td className="py-4.5 px-4 text-center text-zinc-650">—</td>
                  <td className="py-4.5 px-4 text-center text-zinc-650">—</td>
                  <td className="py-4.5 px-6 text-right font-bold text-red-400 text-sm bg-zinc-900/10">
                    {formatPHP(deadCap)}
                  </td>
                </tr>
              )}

              {/* Totals Row */}
              <tr className="bg-zinc-950/60 font-black border-t border-zinc-800 text-zinc-150">
                <td className="py-5 px-6 uppercase text-xs tracking-wider">Team Totals</td>
                <td className="py-5 px-4 text-center">—</td>
                <td className="py-5 px-4 text-center">—</td>
                <td className="py-5 px-4 text-center">—</td>
                {/* Year 1-5 column sums */}
                {fiveYearTotals.map((tot, idx) => (
                  <td
                    key={idx}
                    className="py-5 px-4 text-center text-sm border-r border-zinc-900/40 text-amber-500"
                  >
                    {tot > 0 ? formatPHP(tot) : "—"}
                  </td>
                ))}
                {/* Total Guarantee Sum */}
                <td className="py-5 px-6 text-right text-sm text-amber-500 bg-zinc-900/20">
                  {formatPHP(totalGuaranteedAll)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
