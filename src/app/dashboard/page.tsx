"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { getTeamRoster } from "@/app/actions";
import { releasePlayerAction } from "@/app/actions/transactions";
import { getTeamSeasonStatsAction } from "@/app/actions/statsEngine";
import {
  Users,
  Search,
  Loader2,
  Sparkles,
  ArrowUpDown,
  UserMinus,
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

interface Team {
  id: string;
  name: string;
  city: string;
  conference: "Luzon" | "VisMin";
  budget: number;
}

type SortKey = "name" | "age" | "hometown" | "overall" | "salary" | "position";

export default function RosterPage() {
  const router = useRouter();
  const { userTeamId } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [playersList, setPlayersList] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortAsc, setSortAsc] = useState(false);

  // View mode and season stats
  const [viewMode, setViewMode] = useState<"attributes" | "stats">("attributes");
  const [seasonStats, setSeasonStats] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadRoster = async () => {
    try {
      setLoading(true);
      const rosterData = await getTeamRoster(userTeamId!);
      if (!rosterData) {
        setError("Team roster details not found.");
      } else {
        setPlayersList(rosterData.players as Player[]);
      }

      const statsRes = await getTeamSeasonStatsAction(userTeamId!);
      if (statsRes.success && statsRes.averages) {
        setSeasonStats(statsRes.averages);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load active roster.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    if (!userTeamId) {
      router.replace("/");
      return;
    }
    loadRoster();
  }, [mounted, userTeamId, router]);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p className="mb-4">{error}</p>
        <button
          onClick={loadRoster}
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-semibold"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Release Action Handler
  const handleRelease = async (playerId: string, name: string) => {
    const confirmRelease = confirm(`Are you sure you want to release ${name} into free agency?`);
    if (!confirmRelease) return;

    try {
      setReloading(true);
      const res = await releasePlayerAction(playerId);
      if (res.success) {
        // Reload layout/page budget calculations by reloading window, or re-fetching local list
        // Reloading the page guarantees the shared layout budget headers reload too!
        window.location.reload();
      } else {
        alert(res.error || "Failed to release player.");
      }
    } catch (err) {
      console.error(err);
      alert("Error executing transaction.");
    } finally {
      setReloading(false);
    }
  };

  const getOverallBadgeClass = (overall: number) => {
    if (overall >= 90) return "bg-orange-500/10 text-orange-400 border border-orange-500/30";
    if (overall >= 80) return "bg-purple-500/10 text-purple-400 border border-purple-500/30";
    if (overall >= 70) return "bg-blue-500/10 text-blue-400 border border-blue-500/30";
    return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/30";
  };

  const formatPHP = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Sort & Filter
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const filteredPlayers = playersList
    .filter((player) => {
      const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
      const hometown = player.hometown.toLowerCase();
      const pos = player.position.toLowerCase();
      const query = searchQuery.toLowerCase();
      return fullName.includes(query) || hometown.includes(query) || pos.includes(query);
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
    <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm relative">
      {reloading && (
        <div className="absolute inset-0 bg-zinc-950/40 rounded-3xl flex items-center justify-center z-30 backdrop-blur-xs">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      )}

      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Roster Sheet</h3>
          <p className="text-zinc-500 text-sm">Active squad of 15 players. Manage positions, salaries, and releases.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
          {/* Attributes vs Season Stats Toggle */}
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
            <button
              onClick={() => setViewMode("attributes")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer ${
                viewMode === "attributes"
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Attributes
            </button>
            <button
              onClick={() => setViewMode("stats")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer ${
                viewMode === "stats"
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Season Stats
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search roster..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Roster Data Table */}
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
                  <span>Contract</span>
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
              {viewMode === "attributes" ? (
                <>
                  <th className="py-4.5 px-4 text-center">3PT</th>
                  <th className="py-4.5 px-4 text-center">INS</th>
                  <th className="py-4.5 px-4 text-center">DEF</th>
                  <th className="py-4.5 px-4 text-center">REB</th>
                </>
              ) : (
                <>
                  <th className="py-4.5 px-4 text-center">GP</th>
                  <th className="py-4.5 px-4 text-center">MIN</th>
                  <th className="py-4.5 px-4 text-center">PPG</th>
                  <th className="py-4.5 px-4 text-center">RPG</th>
                  <th className="py-4.5 px-4 text-center">APG</th>
                  <th className="py-4.5 px-4 text-center">SPG</th>
                  <th className="py-4.5 px-4 text-center">BPG</th>
                </>
              )}
              <th className="py-4.5 px-6 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 bg-zinc-950/20">
            {filteredPlayers.length > 0 ? (
              filteredPlayers.map((player) => {
                const defScore = Math.round((player.perimeterDefense + player.interiorDefense) / 2);

                const renderStatBar = (val: number) => {
                  let progressColor = "bg-zinc-700";
                  if (val >= 90) progressColor = "bg-orange-500";
                  else if (val >= 80) progressColor = "bg-amber-500";
                  else if (val >= 70) progressColor = "bg-blue-500";

                  return (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-bold text-zinc-200">{val}</span>
                      <div className="w-10 bg-zinc-800 h-1 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${progressColor}`}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                    </div>
                  );
                };

                return (
                  <tr key={player.id} className="hover:bg-zinc-900/30 transition-all group">
                    {/* Name */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg group-hover:border-zinc-700 transition-colors">
                          <Users className="w-4.5 h-4.5 text-zinc-400 group-hover:text-orange-500 transition-colors" />
                        </div>
                        <div>
                          <span className="font-bold text-zinc-100 group-hover:text-white block transition-colors">
                            {player.firstName} {player.lastName}
                          </span>
                          {player.isFilAm && (
                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 tracking-wider">
                              <Sparkles className="w-2.5 h-2.5" />
                              Fil-Am
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Position */}
                    <td className="py-4 px-4 text-center font-bold text-zinc-300">
                      <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-xs">
                        {player.position}
                      </span>
                    </td>

                    {/* Age */}
                    <td className="py-4 px-4 text-center font-semibold text-zinc-300">
                      {player.age}
                    </td>

                    {/* Hometown */}
                    <td className="py-4 px-4 text-sm font-medium text-zinc-400">
                      {player.hometown}
                    </td>

                    {/* Salary */}
                    <td className="py-4 px-4 text-sm font-bold text-amber-500">
                      {formatPHP(player.salary)}
                    </td>

                    {/* Overall Badge */}
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center font-extrabold text-sm w-9 h-9 rounded-xl shadow-sm ${getOverallBadgeClass(
                          player.overall
                        )}`}
                      >
                        {player.overall}
                      </span>
                    </td>

                    {/* Performance attributes or Season Stats */}
                    {viewMode === "attributes" ? (
                      <>
                        <td className="py-4 px-4 text-center">{renderStatBar(player.threePoint)}</td>
                        <td className="py-4 px-4 text-center">{renderStatBar(player.insideScoring)}</td>
                        <td className="py-4 px-4 text-center">{renderStatBar(defScore)}</td>
                        <td className="py-4 px-4 text-center">{renderStatBar(player.rebounding)}</td>
                      </>
                    ) : (() => {
                      const pStats = seasonStats.find((s) => s.playerId === player.id);
                      return (
                        <>
                          <td className="py-4 px-4 text-center font-bold text-zinc-300">
                            {pStats?.gp ?? 0}
                          </td>
                          <td className="py-4 px-4 text-center font-semibold text-zinc-300">
                            {(pStats?.mpg ?? 0).toFixed(1)}
                          </td>
                          <td className="py-4 px-4 text-center font-bold text-orange-400">
                            {(pStats?.ppg ?? 0).toFixed(1)}
                          </td>
                          <td className="py-4 px-4 text-center font-semibold text-zinc-300">
                            {(pStats?.rpg ?? 0).toFixed(1)}
                          </td>
                          <td className="py-4 px-4 text-center font-semibold text-zinc-300">
                            {(pStats?.apg ?? 0).toFixed(1)}
                          </td>
                          <td className="py-4 px-4 text-center text-zinc-400">
                            {(pStats?.spg ?? 0).toFixed(1)}
                          </td>
                          <td className="py-4 px-4 text-center text-zinc-400">
                            {(pStats?.bpg ?? 0).toFixed(1)}
                          </td>
                        </>
                      );
                    })()}

                    {/* Release Button */}
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => handleRelease(player.id, `${player.firstName} ${player.lastName}`)}
                        className="p-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold"
                      >
                        <UserMinus className="w-4.5 h-4.5" />
                        <span className="hidden lg:inline">Release</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={viewMode === "attributes" ? 11 : 14} className="py-12 text-center text-zinc-500">
                  No active players found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
