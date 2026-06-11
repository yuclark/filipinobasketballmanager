"use client";

import React, { useState } from "react";
import {
  Users,
  Search,
  Sparkles,
  ArrowUpDown,
  Shield,
  Coins,
  MapPin,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";

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

interface CPUTeamRosterClientProps {
  team: Team;
  players: Player[];
  stats: {
    regularSeason: any[];
    playoffs: any[];
    career: any[];
  } | null;
}

type SortKey = "name" | "age" | "hometown" | "overall" | "salary" | "position";

export default function CPUTeamRosterClient({
  team,
  players,
  stats,
}: CPUTeamRosterClientProps) {
  // Filter & sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortAsc, setSortAsc] = useState(false);

  // View mode and stats splits
  const [viewMode, setViewMode] = useState<"attributes" | "stats">("attributes");
  const [statsTab, setStatsTab] = useState<"regular" | "playoffs" | "career">("regular");

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const filteredPlayers = [...players]
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

  const activeStats = stats
    ? statsTab === "regular"
      ? stats.regularSeason
      : statsTab === "playoffs"
      ? stats.playoffs
      : stats.career
    : [];

  return (
    <div className="space-y-8">
      {/* Team Header Info Banner */}
      <div className="bg-gradient-to-r from-zinc-900 to-zinc-900/30 border border-zinc-900 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
          <div>
            <Link
              href="/dashboard/teams"
              className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-300 font-bold text-xs uppercase tracking-wider mb-6 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Directory</span>
            </Link>

            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border self-start md:self-auto ${
                  team.conference === "Luzon"
                    ? "bg-red-500/10 text-red-400 border-red-500/25"
                    : "bg-cyan-500/10 text-cyan-400 border-cyan-500/25"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                {team.conference} Conference
              </span>
            </div>

            <h2 className="text-4xl font-extrabold text-white tracking-tight mt-4 mb-2">
              {team.city}{" "}
              <span
                className={`bg-gradient-to-r bg-clip-text text-transparent ${
                  team.conference === "Luzon"
                    ? "from-red-400 to-orange-400"
                    : "from-cyan-400 to-blue-400"
                }`}
              >
                {team.name}
              </span>
            </h2>
            <div className="flex items-center gap-2 text-zinc-400 font-medium">
              <MapPin className="w-4 h-4 text-zinc-500" />
              <span>{team.city}, Philippines (CPU Franchise)</span>
            </div>
          </div>

          {/* Budget Display */}
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-5 flex items-center gap-4 min-w-[240px]">
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <span className="text-zinc-500 font-bold uppercase tracking-wider text-[11px] block">
                Active Cap Space
              </span>
              <span className="text-xl font-extrabold text-amber-500">
                {formatPHP(team.budget)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Roster Panel */}
      <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm relative">
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Roster Sheet</h3>
            <p className="text-zinc-500 text-sm">Opposing team active roster details and splits.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
            {/* Attributes vs Season Stats Toggle */}
            <div className="flex items-center gap-3 flex-wrap">
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

              {viewMode === "stats" && (
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
                  <button
                    onClick={() => setStatsTab("regular")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer ${
                      statsTab === "regular"
                        ? "bg-zinc-900 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Regular
                  </button>
                  <button
                    onClick={() => setStatsTab("playoffs")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer ${
                      statsTab === "playoffs"
                        ? "bg-zinc-900 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Playoffs
                  </button>
                  <button
                    onClick={() => setStatsTab("career")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer ${
                      statsTab === "career"
                        ? "bg-zinc-900 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Career
                  </button>
                </div>
              )}
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
                    <th className="py-4.5 px-4 text-center">FG%</th>
                    <th className="py-4.5 px-4 text-center">3P%</th>
                    <th className="py-4.5 px-4 text-center">FT%</th>
                  </>
                )}
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
                        const pStats = activeStats.find((s: any) => s.playerId === player.id);
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
                            <td className="py-4 px-4 text-center text-zinc-300 font-mono">
                              {pStats?.fgPct ? `${pStats.fgPct}%` : "0%"}
                            </td>
                            <td className="py-4 px-4 text-center text-zinc-300 font-mono">
                              {pStats?.fg3Pct ? `${pStats.fg3Pct}%` : "0%"}
                            </td>
                            <td className="py-4 px-4 text-center text-zinc-300 font-mono">
                              {pStats?.ftPct ? `${pStats.ftPct}%` : "0%"}
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={viewMode === "attributes" ? 10 : 16} className="py-12 text-center text-zinc-500">
                    No active rostered players found.
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
