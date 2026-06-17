"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useGameStore } from "@/store/useGameStore";
import { getAllPlayersWithTeamsAction } from "@/app/actions";
import PlayerAvatar from "@/components/PlayerAvatar";
import {
  Users,
  Search as SearchIcon,
  Loader2,
  Sparkles,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Shield,
  Coins,
  MapPin,
  TrendingUp,
  Award
} from "lucide-react";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  overall: number;
  salary: number;
  isFilAm: boolean;
  status: string;
  teamId: string | null;
  teamName: string | null;
  teamCity: string | null;
  threePoint: number;
  insideScoring: number;
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
}

type SortKey =
  | "name"
  | "position"
  | "age"
  | "overall"
  | "salary"
  | "threePoint"
  | "insideScoring"
  | "defense"
  | "rebounding"
  | "speed"
  | "stamina";

export default function PlayerDirectoryPage() {
  const router = useRouter();
  const { triggerAutosave } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [playersList, setPlayersList] = useState<Player[]>([]);
  const [teamsList, setTeamsList] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<string>("All");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("All");

  // Sorting states
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortAsc, setSortAsc] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAllPlayersWithTeamsAction();
      if (res.success && res.players && res.teams) {
        setPlayersList(res.players as Player[]);
        setTeamsList(res.teams as Team[]);
      } else {
        setError(res.error || "Failed to load players.");
      }
    } catch (err) {
      console.error(err);
      setError("Error loading player directory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      loadPlayers();
    }
  }, [mounted]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedPosition, selectedTeamId]);

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
          onClick={loadPlayers}
          className="px-4 py-2 bg-zinc-900 border border-zinc-850 rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

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

  const getSortValue = (player: Player, key: SortKey) => {
    if (key === "name") return `${player.firstName} ${player.lastName}`.toLowerCase();
    if (key === "position") return player.position;
    if (key === "age") return player.age;
    if (key === "overall") return player.overall;
    if (key === "salary") return player.salary;
    if (key === "threePoint") return player.threePoint;
    if (key === "insideScoring") return player.insideScoring;
    if (key === "defense") return Math.round((player.perimeterDefense + player.interiorDefense) / 2);
    if (key === "rebounding") return player.rebounding;
    if (key === "speed") return player.speed;
    if (key === "stamina") return player.stamina;
    return 0;
  };

  // 1. Filter Players
  const filteredPlayers = playersList
    .filter((player) => {
      // Search query filter
      const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
      const hometown = (player.teamCity || "").toLowerCase();
      const pos = player.position.toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        fullName.includes(query) || hometown.includes(query) || pos.includes(query);

      // Position filter
      const matchesPosition =
        selectedPosition === "All" || player.position === selectedPosition;

      // Team filter
      let matchesTeam = true;
      if (selectedTeamId === "FA") {
        matchesTeam = player.teamId === null;
      } else if (selectedTeamId !== "All") {
        matchesTeam = player.teamId === selectedTeamId;
      }

      return matchesSearch && matchesPosition && matchesTeam;
    })
    // 2. Sort Players
    .sort((a, b) => {
      const valA = getSortValue(a, sortKey);
      const valB = getSortValue(b, sortKey);

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  // 3. Paginate Players
  const totalItems = filteredPlayers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPlayers = filteredPlayers.slice(startIndex, startIndex + itemsPerPage);

  // Metric aggregates
  const averageOvr =
    playersList.length > 0
      ? Math.round(playersList.reduce((sum, p) => sum + p.overall, 0) / playersList.length)
      : 0;

  const topPlayer = playersList.reduce(
    (max, p) => (p.overall > (max?.overall || 0) ? p : max),
    playersList[0]
  );

  return (
    <div className="space-y-6">
      {/* Mini Overview Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Total Active Players
            </span>
            <span className="text-xl font-extrabold text-white block mt-0.5">
              {playersList.length} Players
            </span>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              League Average OVR
            </span>
            <span className="text-xl font-extrabold text-white block mt-0.5">
              {averageOvr} OVR
            </span>
          </div>
        </div>

        {topPlayer && (
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Top Rated Player
              </span>
              <span className="text-sm font-bold text-white block truncate max-w-[180px] mt-0.5">
                {topPlayer.firstName} {topPlayer.lastName} ({topPlayer.overall} OVR)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Directory Filters */}
      <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">League Player Directory</h3>
            <p className="text-zinc-500 text-xs">
              Search, filter, and review all active players and free agents across Luzon and VisMin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[240px] flex-1 sm:flex-none">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <SearchIcon className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search player name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-all"
              />
            </div>

            {/* Position Dropdown */}
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="px-3 py-2 bg-zinc-955 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 cursor-pointer"
            >
              <option value="All">All Positions</option>
              <option value="PG">Point Guard (PG)</option>
              <option value="SG">Shooting Guard (SG)</option>
              <option value="SF">Small Forward (SF)</option>
              <option value="PF">Power Forward (PF)</option>
              <option value="C">Center (C)</option>
            </select>

            {/* Team Dropdown */}
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="px-3 py-2 bg-zinc-955 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 cursor-pointer max-w-[200px]"
            >
              <option value="All">All Teams</option>
              <option value="FA">Free Agents</option>
              {teamsList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.city} {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Directory Table */}
        <div className="w-full overflow-x-auto rounded-xl border border-zinc-900">
          <table className="w-full min-w-[1000px] text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-400 font-bold text-[10px] uppercase tracking-wider select-none">
                <th
                  onClick={() => handleSort("name")}
                  className="py-3.5 px-5 cursor-pointer hover:bg-zinc-900 transition-colors w-1/4"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Player</span>
                    <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("position")}
                  className="py-3.5 px-4 cursor-pointer hover:bg-zinc-900 transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Pos</span>
                    <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("age")}
                  className="py-3.5 px-4 cursor-pointer hover:bg-zinc-900 transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Age</span>
                    <ArrowUpDown className="w-3 h-3 text-zinc-550" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("overall")}
                  className="py-3.5 px-4 cursor-pointer hover:bg-zinc-900 transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>OVR</span>
                    <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Affiliation</th>
                <th
                  onClick={() => handleSort("salary")}
                  className="py-3.5 px-4 cursor-pointer hover:bg-zinc-900 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Salary</span>
                    <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("threePoint")}
                  className="py-3.5 px-3 cursor-pointer hover:bg-zinc-900 transition-colors text-center"
                >
                  3PT
                </th>
                <th
                  onClick={() => handleSort("insideScoring")}
                  className="py-3.5 px-3 cursor-pointer hover:bg-zinc-900 transition-colors text-center"
                >
                  INS
                </th>
                <th
                  onClick={() => handleSort("defense")}
                  className="py-3.5 px-3 cursor-pointer hover:bg-zinc-900 transition-colors text-center"
                >
                  DEF
                </th>
                <th
                  onClick={() => handleSort("rebounding")}
                  className="py-3.5 px-3 cursor-pointer hover:bg-zinc-900 transition-colors text-center"
                >
                  REB
                </th>
                <th
                  onClick={() => handleSort("speed")}
                  className="py-3.5 px-3 cursor-pointer hover:bg-zinc-900 transition-colors text-center"
                >
                  SPD
                </th>
                <th
                  onClick={() => handleSort("stamina")}
                  className="py-3.5 px-3 cursor-pointer hover:bg-zinc-900 transition-colors text-center"
                >
                  STA
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 bg-zinc-950/10">
              {paginatedPlayers.length > 0 ? (
                paginatedPlayers.map((player) => {
                  const defScore = Math.round(
                    (player.perimeterDefense + player.interiorDefense) / 2
                  );
                  const isFreeAgent = player.teamId === null;

                  return (
                    <tr key={player.id} className="hover:bg-zinc-900/35 transition-all">
                      {/* Name */}
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8.5 h-8.5 shrink-0 bg-zinc-950 border border-zinc-850 rounded-lg overflow-hidden shadow-sm">
                            <PlayerAvatar
                              playerId={player.id}
                              firstName={player.firstName}
                              lastName={player.lastName}
                              position={player.position}
                              teamName={player.teamName}
                            />
                          </div>
                          <div>
                            <Link
                              href={`/dashboard/players/${player.id}`}
                              className="font-bold text-[13px] text-zinc-100 hover:text-orange-400 block transition-colors"
                            >
                              {player.firstName} {player.lastName}
                            </Link>
                            {player.isFilAm && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.25 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[8px] font-extrabold uppercase tracking-wide mt-0.5">
                                Fil-Am
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="py-3 px-4 text-center font-bold text-zinc-300 text-xs">
                        <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded">
                          {player.position}
                        </span>
                      </td>

                      {/* Age */}
                      <td className="py-3 px-4 text-center text-xs font-semibold text-zinc-300">
                        {player.age}
                      </td>

                      {/* Overall */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center font-extrabold text-xs w-7 h-7 rounded-lg shadow-sm ${getOverallBadgeClass(
                            player.overall
                          )}`}
                        >
                          {player.overall}
                        </span>
                      </td>

                      {/* Team Affiliation */}
                      <td className="py-3 px-4 text-xs font-semibold text-zinc-300">
                        {isFreeAgent ? (
                          <span className="text-zinc-550 italic font-medium">Free Agent</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-zinc-500" />
                            <span>
                              {player.teamCity} {player.teamName}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Salary */}
                      <td className="py-3 px-4 text-xs font-bold text-amber-500">
                        {formatPHP(player.salary)}
                      </td>

                      {/* Attributes */}
                      <td className="py-3 px-3 text-center text-xs font-semibold text-zinc-300">
                        {player.threePoint}
                      </td>
                      <td className="py-3 px-3 text-center text-xs font-semibold text-zinc-300">
                        {player.insideScoring}
                      </td>
                      <td className="py-3 px-3 text-center text-xs font-semibold text-zinc-300">
                        {defScore}
                      </td>
                      <td className="py-3 px-3 text-center text-xs font-semibold text-zinc-300">
                        {player.rebounding}
                      </td>
                      <td className="py-3 px-3 text-center text-xs font-semibold text-zinc-300">
                        {player.speed}
                      </td>
                      <td className="py-3 px-3 text-center text-xs font-semibold text-zinc-300">
                        {player.stamina}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-zinc-500 text-xs italic">
                    No players match the search or filter settings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-zinc-900">
            <span className="text-zinc-500 text-xs font-semibold">
              Showing {startIndex + 1} – {Math.min(startIndex + itemsPerPage, totalItems)} of{" "}
              {totalItems} players
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed hover:border-zinc-750 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-zinc-400 text-xs font-bold px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed hover:border-zinc-750 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
