"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useGameStore } from "@/store/useGameStore";
import { getTeamRoster } from "@/app/actions";
import { MAX_ROSTER_SIZE } from "@/lib/constants";
import { releasePlayerAction } from "@/app/actions/transactions";
import { getUserDraftPicksAction } from "@/app/actions/offseasonEngine";
import { getTeamSeasonStatsAction } from "@/app/actions/statsEngine";
import {
  Users,
  Search,
  Loader2,
  Sparkles,
  ArrowUpDown,
  UserMinus,
  Coins,
  Shield,
  MapPin,
  TrendingUp,
} from "lucide-react";
import React from "react";
import PlayerAvatar from "@/components/PlayerAvatar";

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
  isRookie?: boolean;
  yearsPlayed: number;
}

type SortKey =
  | "name"
  | "position"
  | "age"
  | "yearsPlayed"
  | "hometown"
  | "salary"
  | "overall"
  | "threePoint"
  | "insideScoring"
  | "defense"
  | "rebounding"
  | "per"
  | "winShares"
  | "gp"
  | "mpg"
  | "ppg"
  | "rpg"
  | "apg"
  | "spg"
  | "bpg"
  | "fgPct"
  | "fg3Pct"
  | "ftPct";

export default function RosterPage() {
  const router = useRouter();
  const { userTeamId, triggerAutosave } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [playersList, setPlayersList] = useState<Player[]>([]);
  const [draftPicksList, setDraftPicksList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [confirmReleaseId, setConfirmReleaseId] = useState<string | null>(null);
  const [userTeam, setUserTeam] = useState<any>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortAsc, setSortAsc] = useState(false);

  // View mode and season stats
  const [viewMode, setViewMode] = useState<"attributes" | "stats">("attributes");
  const [statsTab, setStatsTab] = useState<"regular" | "playoffs" | "career">("regular");
  const [allStatsSplits, setAllStatsSplits] = useState<{ regularSeason: any[]; playoffs: any[]; career: any[] } | null>(null);

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
        setUserTeam(rosterData.team);
      }

      const statsRes = await getTeamSeasonStatsAction(userTeamId!);
      if (statsRes.success && statsRes.regularSeason && statsRes.playoffs && statsRes.career) {
        setAllStatsSplits({
          regularSeason: statsRes.regularSeason,
          playoffs: statsRes.playoffs,
          career: statsRes.career,
        });
      }

      const picksRes = await getUserDraftPicksAction(userTeamId!);
      if (picksRes.success && picksRes.picks) {
        setDraftPicksList(picksRes.picks);
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
  const handleRelease = async (playerId: string) => {
    if (confirmReleaseId !== playerId) {
      setConfirmReleaseId(playerId);
      return;
    }
    setConfirmReleaseId(null);
    setReleaseError(null);
    try {
      setReloading(true);
      const res = await releasePlayerAction(playerId);
      if (res.success) {
        await loadRoster();
        router.refresh();
        triggerAutosave();
      } else {
        setReleaseError(res.error || "Failed to release player. Roster minimum may be violated.");
      }
    } catch (err) {
      console.error(err);
      setReleaseError("Error executing release transaction.");
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

  const activeStats = allStatsSplits
    ? (statsTab === "regular"
        ? allStatsSplits.regularSeason
        : statsTab === "playoffs"
        ? allStatsSplits.playoffs
        : allStatsSplits.career)
    : [];

  const getSortValue = (player: Player, key: SortKey) => {
    if (key === "name") return `${player.firstName} ${player.lastName}`.toLowerCase();
    if (key === "position") return player.position;
    if (key === "age") return player.age;
    if (key === "yearsPlayed") return player.yearsPlayed;
    if (key === "hometown") return player.hometown.toLowerCase();
    if (key === "salary") return player.salary;
    if (key === "overall") return player.overall;
    if (key === "threePoint") return player.threePoint;
    if (key === "insideScoring") return player.insideScoring;
    if (key === "rebounding") return player.rebounding;
    if (key === "defense") return Math.round((player.perimeterDefense + player.interiorDefense) / 2);

    // Stats
    const pStats = activeStats.find((s) => s.playerId === player.id);
    if (!pStats) return 0;

    if (key === "per") return pStats.per ?? 0;
    if (key === "winShares") return pStats.winShares ?? 0;
    if (key === "gp") return pStats.gp ?? 0;
    if (key === "mpg") return pStats.mpg ?? 0;
    if (key === "ppg") return pStats.ppg ?? 0;
    if (key === "rpg") return pStats.rpg ?? 0;
    if (key === "apg") return pStats.apg ?? 0;
    if (key === "spg") return pStats.spg ?? 0;
    if (key === "bpg") return pStats.bpg ?? 0;
    if (key === "fgPct") return pStats.fgPct ?? 0;
    if (key === "fg3Pct") return pStats.fg3Pct ?? 0;
    if (key === "ftPct") return pStats.ftPct ?? 0;

    return 0;
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
      const valA = getSortValue(a, sortKey);
      const valB = getSortValue(b, sortKey);

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  const teamOvr = playersList.length > 0
    ? Math.round(playersList.reduce((sum, p) => sum + p.overall, 0) / playersList.length)
    : 0;

  return (
    <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm relative w-full max-w-full overflow-hidden">
      {reloading && (
        <div className="absolute inset-0 bg-zinc-950/40 rounded-3xl flex items-center justify-center z-30 backdrop-blur-xs">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      )}

      {releaseError && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 font-semibold flex items-center justify-between">
          <span>{releaseError}</span>
          <button onClick={() => setReleaseError(null)} className="ml-4 text-red-400/60 hover:text-red-300 text-xs font-bold">✕</button>
        </div>
      )}

      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Roster Sheet</h3>
            <p className="text-zinc-500 text-sm">Active squad of {playersList.length} players (limit 12-18). Manage ratings, contracts and stats.</p>
          </div>
          <div className="bg-zinc-950 px-4 py-2 rounded-2xl border border-zinc-900 flex flex-col justify-center min-w-[90px]">
            <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest block">Team OVR</span>
            <span className="text-xl font-black text-orange-500 block mt-0.5">{teamOvr}</span>
          </div>
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
      <div className="w-full overflow-x-auto rounded-xl border border-zinc-900">
        <table className="w-full min-w-[1000px] text-left border-collapse">
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
                  <ArrowUpDown className="w-3.5 h-3.5 text-zinc-550" />
                </div>
              </th>
              <th
                onClick={() => handleSort("yearsPlayed")}
                className="py-4.5 px-4 cursor-pointer hover:bg-zinc-900 transition-colors text-center"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Exp</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-zinc-550" />
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
                  <th onClick={() => handleSort("threePoint")} className="py-4.5 px-4 text-center cursor-pointer hover:bg-zinc-900 transition-colors">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>3PT</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-zinc-550" />
                    </div>
                  </th>
                  <th onClick={() => handleSort("insideScoring")} className="py-4.5 px-4 text-center cursor-pointer hover:bg-zinc-900 transition-colors">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>INS</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-zinc-550" />
                    </div>
                  </th>
                  <th onClick={() => handleSort("defense")} className="py-4.5 px-4 text-center cursor-pointer hover:bg-zinc-900 transition-colors">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>DEF</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-zinc-550" />
                    </div>
                  </th>
                  <th onClick={() => handleSort("rebounding")} className="py-4.5 px-4 text-center cursor-pointer hover:bg-zinc-900 transition-colors">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>REB</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-zinc-550" />
                    </div>
                  </th>
                  <th onClick={() => handleSort("per")} className="py-4.5 px-4 text-center cursor-pointer hover:bg-zinc-900 transition-colors">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>PER</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-zinc-550" />
                    </div>
                  </th>
                  <th onClick={() => handleSort("winShares")} className="py-4.5 px-4 text-center cursor-pointer hover:bg-zinc-900 transition-colors">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>WS</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-zinc-550" />
                    </div>
                  </th>
                </>
              ) : (
                <>
                  <th onClick={() => handleSort("gp")} className="py-4.5 px-3 text-center cursor-pointer hover:bg-zinc-900 transition-colors">GP</th>
                  <th onClick={() => handleSort("mpg")} className="py-4.5 px-3 text-center cursor-pointer hover:bg-zinc-900 transition-colors">MIN</th>
                  <th onClick={() => handleSort("ppg")} className="py-4.5 px-3 text-center cursor-pointer hover:bg-zinc-900 transition-colors text-orange-400">PPG</th>
                  <th onClick={() => handleSort("rpg")} className="py-4.5 px-3 text-center cursor-pointer hover:bg-zinc-900 transition-colors">RPG</th>
                  <th onClick={() => handleSort("apg")} className="py-4.5 px-3 text-center cursor-pointer hover:bg-zinc-900 transition-colors">APG</th>
                  <th onClick={() => handleSort("spg")} className="py-4.5 px-3 text-center cursor-pointer hover:bg-zinc-900 transition-colors">SPG</th>
                  <th onClick={() => handleSort("bpg")} className="py-4.5 px-3 text-center cursor-pointer hover:bg-zinc-900 transition-colors">BPG</th>
                  <th onClick={() => handleSort("fgPct")} className="py-4.5 px-3 text-center cursor-pointer hover:bg-zinc-900 transition-colors">FG%</th>
                  <th onClick={() => handleSort("fg3Pct")} className="py-4.5 px-3 text-center cursor-pointer hover:bg-zinc-900 transition-colors">3P%</th>
                  <th onClick={() => handleSort("ftPct")} className="py-4.5 px-3 text-center cursor-pointer hover:bg-zinc-900 transition-colors">FT%</th>
                </>
              )}
              <th className="py-4.5 px-6 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 bg-zinc-950/20">
            {filteredPlayers.length > 0 ? (
              filteredPlayers.map((player) => {
                const defScore = Math.round((player.perimeterDefense + player.interiorDefense) / 2);
                const pStats = activeStats.find((s) => s.playerId === player.id);
                const playerPer = pStats?.per ?? "0.0";
                const playerWS = pStats?.winShares ?? "0.00";

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
                        <div className="w-10 h-10 shrink-0 bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden shadow-md">
                          <PlayerAvatar
                            playerId={player.id}
                            firstName={player.firstName}
                            lastName={player.lastName}
                            position={player.position}
                            teamName={userTeam?.name}
                            teamConference={userTeam?.conference}
                          />
                        </div>
                        <div>
                          <Link href={`/dashboard/players/${player.id}`} className="font-bold text-zinc-100 hover:text-orange-400 block transition-colors">
                            {player.firstName} {player.lastName}
                          </Link>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {player.isFilAm && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 tracking-wider">
                                <Sparkles className="w-2.5 h-2.5" />
                                Fil-Am
                              </span>
                            )}
                            {player.isRookie && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20 tracking-wider">
                                <Sparkles className="w-2.5 h-2.5" />
                                Rookie
                              </span>
                            )}
                          </div>
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

                    {/* Exp */}
                    <td className="py-4 px-4 text-center font-semibold text-zinc-300">
                      {(player.isRookie || player.yearsPlayed === 0) ? "R" : player.yearsPlayed}
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
                        <td className="py-4 px-4 text-center font-extrabold text-red-400">{playerPer}</td>
                        <td className="py-4 px-4 text-center font-extrabold text-green-400">{playerWS}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-4 px-3 text-center font-bold text-zinc-300">
                          {pStats?.gp ?? 0}
                        </td>
                        <td className="py-4 px-3 text-center font-semibold text-zinc-300">
                          {(pStats?.mpg ?? 0).toFixed(1)}
                        </td>
                        <td className="py-4 px-3 text-center font-bold text-orange-400">
                          {(pStats?.ppg ?? 0).toFixed(1)}
                        </td>
                        <td className="py-4 px-3 text-center font-semibold text-zinc-300">
                          {(pStats?.rpg ?? 0).toFixed(1)}
                        </td>
                        <td className="py-4 px-3 text-center font-semibold text-zinc-300">
                          {(pStats?.apg ?? 0).toFixed(1)}
                        </td>
                        <td className="py-4 px-3 text-center text-zinc-400">
                          {(pStats?.spg ?? 0).toFixed(1)}
                        </td>
                        <td className="py-4 px-3 text-center text-zinc-400">
                          {(pStats?.bpg ?? 0).toFixed(1)}
                        </td>
                        <td className="py-4 px-3 text-center text-zinc-300 font-mono">
                          {pStats?.fgPct ? `${pStats.fgPct}%` : "0%"}
                        </td>
                        <td className="py-4 px-3 text-center text-zinc-300 font-mono">
                          {pStats?.fg3Pct ? `${pStats.fg3Pct}%` : "0%"}
                        </td>
                        <td className="py-4 px-3 text-center text-zinc-300 font-mono">
                          {pStats?.ftPct ? `${pStats.ftPct}%` : "0%"}
                        </td>
                      </>
                    )}

                    {/* Release Button */}
                    <td className="py-4 px-6 text-center">
                      {confirmReleaseId === player.id ? (
                        <div className="flex items-center gap-1.5 justify-center">
                          <button
                            onClick={() => handleRelease(player.id)}
                            className="px-2.5 py-1.5 bg-red-500 text-white rounded-lg text-[10px] font-bold cursor-pointer hover:bg-red-600 transition-all"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmReleaseId(null)}
                            className="px-2.5 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-zinc-700 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRelease(player.id)}
                          className="p-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold"
                        >
                          <UserMinus className="w-4.5 h-4.5" />
                          <span className="hidden lg:inline">Release</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={viewMode === "attributes" ? 14 : 18} className="py-12 text-center text-zinc-500">
                  No active players found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Draft Assets Section */}
      <div className="mt-8 pt-8 border-t border-zinc-900">
        <h4 className="text-lg font-bold text-white mb-2">Franchise Draft Assets</h4>
        <p className="text-zinc-500 text-sm mb-4">
          Future draft selections owned by your franchise. These picks can be traded in the Trade Operations Office.
        </p>

        {draftPicksList.length === 0 ? (
          <div className="bg-zinc-950/20 border border-zinc-900 rounded-2xl p-6 text-center text-zinc-500 text-xs italic">
            No future draft assets currently owned.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {draftPicksList.map((pick) => (
              <div
                key={pick.id}
                className="bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 transition-all rounded-2xl p-4 flex flex-col justify-between gap-3 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 blur-2xl rounded-full pointer-events-none group-hover:bg-orange-500/10 transition-all" />
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      Season {pick.season}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                      Rnd {pick.round}
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-zinc-200">
                    Round {pick.round} Draft Pick
                  </h5>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Original: {pick.originalTeamCity} {pick.originalTeamName}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-1 pt-2 border-t border-zinc-900/60">
                  <span className="text-[10px] font-medium text-zinc-400">Trade Value</span>
                  <span className="text-xs font-bold text-amber-500">{pick.round === 1 ? 78 : 65} pts</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
