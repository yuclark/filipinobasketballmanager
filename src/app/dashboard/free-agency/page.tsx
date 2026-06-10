"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { getFreeAgents, getTeamSalarySpace, signFreeAgentAction } from "@/app/actions/transactions";
import { MAX_ROSTER_SIZE } from "@/lib/constants";
import {
  Briefcase,
  Search,
  Loader2,
  Sparkles,
  ArrowUpDown,
  UserPlus,
  Coins,
  ShieldAlert,
} from "lucide-react";

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
  threePoint: number;
  insideScoring: number;
  playmaking: number;
  perimeterDefense: number;
  interiorDefense: number;
  rebounding: number;
  speed: number;
  stamina: number;
}

type SortKey = "name" | "age" | "hometown" | "overall" | "salary" | "position";

export default function FreeAgencyPage() {
  const router = useRouter();
  const { userTeamId } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [freeAgents, setFreeAgents] = useState<Player[]>([]);
  const [capInfo, setCapInfo] = useState<{
    totalSalaries: number;
    space: number;
    rosterCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<string>("All");
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadData = async () => {
    if (!userTeamId) return;
    try {
      setLoading(true);
      const agents = (await getFreeAgents()) as Player[];
      const cap = await getTeamSalarySpace(userTeamId);
      
      setFreeAgents(agents);
      if (cap.success) {
        setCapInfo({
          totalSalaries: cap.totalSalaries!,
          space: cap.space!,
          rosterCount: cap.rosterCount!,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted && userTeamId) {
      loadData();
    }
  }, [mounted, userTeamId]);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const handleSignPlayer = async (playerId: string, name: string) => {
    if (!userTeamId || !capInfo) return;
    
    const confirmSign = confirm(`Do you want to sign ${name} to a contract?`);
    if (!confirmSign) return;

    setActionLoading(true);
    try {
      const res = await signFreeAgentAction(playerId, userTeamId);
      if (res.success) {
        alert(`${name} has been successfully added to your roster!`);
        // Reloading window refreshes the shared layout header budgets as well
        window.location.reload();
      } else {
        alert(res.error || "Failed to sign player.");
      }
    } catch (err) {
      console.error(err);
      alert("Error executing trade transaction.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatPHP = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getOverallBadgeClass = (overall: number) => {
    if (overall >= 90) return "bg-orange-500/10 text-orange-400 border border-orange-500/30";
    if (overall >= 80) return "bg-purple-500/10 text-purple-400 border border-purple-500/30";
    if (overall >= 70) return "bg-blue-500/10 text-blue-400 border border-blue-500/30";
    return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/30";
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  // Filter & Sort free agents
  const filteredFreeAgents = freeAgents
    .filter((player) => {
      const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
      const hometown = player.hometown.toLowerCase();
      const query = searchQuery.toLowerCase();
      const posMatches = selectedPosition === "All" || player.position === selectedPosition;

      return (fullName.includes(query) || hometown.includes(query)) && posMatches;
    })
    .sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (sortKey === "name") {
        valA = `${a.firstName} ${a.lastName}`.toLowerCase();
        valB = `${b.firstName} ${b.lastName}`.toLowerCase();
      } else if (sortKey === "age") {
        valA = a.age;
        valB = b.age;
      } else if (sortKey === "hometown") {
        valA = a.hometown.toLowerCase();
        valB = b.hometown.toLowerCase();
      } else if (sortKey === "overall") {
        valA = a.overall;
        valB = b.overall;
      } else if (sortKey === "salary") {
        valA = a.salary;
        valB = b.salary;
      } else if (sortKey === "position") {
        valA = a.position;
        valB = b.position;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  return (
    <div className="space-y-6 relative">
      {actionLoading && (
        <div className="fixed inset-0 bg-zinc-950/40 flex items-center justify-center z-50 backdrop-blur-xs">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        </div>
      )}

      {/* Roster Size & Budget Space details */}
      {capInfo && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-500/10 rounded-2xl text-cyan-400">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] block">Roster Spots</span>
              <span className={`text-2xl font-extrabold ${capInfo.rosterCount >= MAX_ROSTER_SIZE ? "text-red-400" : "text-white"}`}>
                {capInfo.rosterCount} / {MAX_ROSTER_SIZE} players
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t border-zinc-900 md:border-t-0 md:border-l md:border-r md:px-6 py-4 md:py-0">
            <div className="p-3 bg-zinc-950/80 rounded-2xl text-zinc-400">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] block">Active Payroll</span>
              <span className="text-xl font-extrabold text-zinc-300">
                {formatPHP(capInfo.totalSalaries)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-400">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] block">Cap Room Space</span>
              <span className={`text-2xl font-extrabold ${capInfo.space <= 0 ? "text-red-400" : "text-emerald-400"}`}>
                {formatPHP(capInfo.space)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Free Agent Table with filters */}
      <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Marketplace Board</h3>
            <p className="text-zinc-500 text-sm">Unsigned free agents available to join franchises.</p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all"
              />
            </div>

            {/* Position filter tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0">
              {["All", "PG", "SG", "SF", "PF", "C"].map((pos) => (
                <button
                  key={pos}
                  onClick={() => setSelectedPosition(pos)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                    selectedPosition === pos
                      ? "bg-orange-500 text-white border-transparent"
                      : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Free Agency List Table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-900">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-400 font-bold text-xs uppercase tracking-wider select-none">
                <th
                  onClick={() => handleSort("name")}
                  className="py-4.5 px-6 cursor-pointer hover:bg-zinc-900 transition-colors w-1/4"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Player</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("position")}
                  className="py-4.5 px-4 cursor-pointer hover:bg-zinc-900 transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Pos</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("age")}
                  className="py-4.5 px-4 cursor-pointer hover:bg-zinc-900 transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Age</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("hometown")}
                  className="py-4.5 px-4 cursor-pointer hover:bg-zinc-900 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Hometown</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("salary")}
                  className="py-4.5 px-4 cursor-pointer hover:bg-zinc-900 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Contract Demand</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("overall")}
                  className="py-4.5 px-4 cursor-pointer hover:bg-zinc-900 transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>OVR</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                </th>
                <th className="py-4.5 px-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 bg-zinc-950/20">
              {filteredFreeAgents.length > 0 ? (
                filteredFreeAgents.map((player) => {
                  const isRosterFull = (capInfo?.rosterCount || 0) >= MAX_ROSTER_SIZE;
                  const canAfford = capInfo ? capInfo.space >= player.salary : false;
                  const canSign = !isRosterFull && canAfford;

                  return (
                    <tr key={player.id} className="hover:bg-zinc-900/30 transition-all">
                      {/* Name */}
                      <td className="py-4 px-6">
                        <div>
                          <span className="font-bold text-zinc-100 block">{player.firstName} {player.lastName}</span>
                          {player.isFilAm && (
                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 tracking-wider">
                              <Sparkles className="w-2.5 h-2.5" />
                              Fil-Am
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Position */}
                      <td className="py-4 px-4 text-center font-bold text-zinc-300">
                        <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-xs">
                          {player.position}
                        </span>
                      </td>

                      {/* Age */}
                      <td className="py-4 px-4 text-center font-semibold text-zinc-300">{player.age}</td>

                      {/* Hometown */}
                      <td className="py-4 px-4 text-sm font-medium text-zinc-400">{player.hometown}</td>

                      {/* Salary */}
                      <td className="py-4 px-4 text-sm font-bold text-amber-500">{formatPHP(player.salary)}</td>

                      {/* Overall */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center font-extrabold text-sm w-9 h-9 rounded-xl shadow-sm ${getOverallBadgeClass(
                            player.overall
                      )}`}
                        >
                          {player.overall}
                        </span>
                      </td>

                      {/* Sign Button */}
                      <td className="py-4 px-6 text-center">
                        {canSign ? (
                          <button
                            onClick={() => handleSignPlayer(player.id, `${player.firstName} ${player.lastName}`)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                          >
                            <UserPlus className="w-4 h-4" />
                            <span>Sign FA</span>
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-zinc-900 border border-zinc-850 rounded-lg text-[10px] text-zinc-500 font-semibold max-w-[140px] text-left">
                            <ShieldAlert className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                            <span>
                              {isRosterFull ? `Roster Full (${MAX_ROSTER_SIZE})` : "Exceeds Salary Cap"}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    No free agents found on the marketplace matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
