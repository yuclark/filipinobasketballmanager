"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { getTeamRoster } from "@/app/actions";
import {
  Users,
  Calendar,
  BarChart3,
  Briefcase,
  Play,
  LogOut,
  MapPin,
  Shield,
  Coins,
  Search,
  Loader2,
  Sparkles,
  ArrowUpDown,
  ChevronRight,
  TrendingUp,
  Trophy,
} from "lucide-react";

interface Player {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  age: number;
  hometown: string;
  isFilAm: boolean;
  overall: number;
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

type TabType = "Roster" | "Schedule" | "Standings" | "Front Office";
type SortKey = "name" | "age" | "hometown" | "overall";

export default function DashboardPage() {
  const router = useRouter();
  const { userTeamId, setTeam } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<{ team: Team; players: Player[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<TabType>("Roster");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortAsc, setSortAsc] = useState(false);

  // Set mounted client-side to avoid hydration mismatches
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch data when mounted and userTeamId is available
  useEffect(() => {
    if (!mounted) return;

    if (!userTeamId) {
      router.replace("/");
      return;
    }

    async function loadRoster() {
      try {
        setLoading(true);
        const rosterData = await getTeamRoster(userTeamId!);
        if (!rosterData) {
          setError("Team not found in the database.");
        } else {
          setData(rosterData);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load roster data.");
      } finally {
        setLoading(false);
      }
    }

    loadRoster();
  }, [mounted, userTeamId, router]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  const handleLogout = () => {
    setTeam("");
    router.push("/");
  };

  const handleSimulateGame = () => {
    alert(`[Simulation Engine] Simulating next game for the ${data?.team.city} ${data?.team.name}...`);
  };

  // Helper formats
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

  // Sort & Filter logic
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const playersList = data?.players || [];
  const filteredPlayers = playersList
    .filter((player) => {
      const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
      const hometown = player.hometown.toLowerCase();
      const query = searchQuery.toLowerCase();
      return fullName.includes(query) || hometown.includes(query);
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
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  // Loading skeleton screen
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex font-sans">
        {/* Sidebar Skeleton */}
        <aside className="w-64 border-r border-zinc-900 bg-zinc-950 p-6 hidden md:flex flex-col gap-6">
          <div className="h-8 bg-zinc-900 rounded-lg animate-pulse w-3/4" />
          <div className="flex flex-col gap-3 mt-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-zinc-900 rounded-lg animate-pulse" />
            ))}
          </div>
        </aside>

        {/* Main Content Skeleton */}
        <main className="flex-1 p-8 md:p-12 overflow-y-auto">
          {/* Header Skeleton */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <div className="h-4 bg-zinc-900 rounded animate-pulse w-24 mb-2" />
              <div className="h-10 bg-zinc-900 rounded animate-pulse w-64 mb-3" />
              <div className="h-5 bg-zinc-900 rounded animate-pulse w-36" />
            </div>
            <div className="h-12 bg-zinc-900 rounded-xl animate-pulse w-44" />
          </div>

          {/* Table Card Skeleton */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-6">
            <div className="h-6 bg-zinc-900 rounded animate-pulse w-48 mb-6" />
            <div className="flex flex-col gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-zinc-900 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center font-sans px-4 text-center">
        <Shield className="w-16 h-16 text-red-500/80 mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold mb-2">Error</h2>
        <p className="text-zinc-400 mb-6">{error || "Something went wrong."}</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold cursor-pointer transition-all"
        >
          Return to Team Selection
        </button>
      </div>
    );
  }

  const { team } = data;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex font-sans relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-zinc-900 bg-zinc-950/80 backdrop-blur-md p-6 hidden md:flex flex-col justify-between relative z-10">
        <div>
          {/* Logo / Title */}
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-widest text-zinc-500 block uppercase">Manager</span>
              <span className="font-bold text-zinc-100 tracking-tight text-base block">PBA Dashboard</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {[
              { name: "Roster", icon: Users },
              { name: "Schedule", icon: Calendar },
              { name: "Standings", icon: BarChart3 },
              { name: "Front Office", icon: Briefcase },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => setActiveTab(item.name as TabType)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_4px_15px_rgba(249,115,22,0.15)]"
                      : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
                  }`}
                >
                  <Icon className="w-4.5 h-4.5" />
                  <span>{item.name}</span>
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Change Team Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-zinc-500 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all cursor-pointer"
        >
          <LogOut className="w-4.5 h-4.5" />
          <span>Change Franchise</span>
        </button>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col min-h-screen relative z-10 overflow-y-auto">
        {/* Top Header */}
        <header className="border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4 md:hidden">
            <button
              onClick={handleLogout}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-lg cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <h1 className="font-bold tracking-tight text-white">Roster</h1>
          </div>

          <div className="hidden md:flex items-center gap-2 text-zinc-400 text-sm">
            <span>Franchise Mode</span>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
            <span className="text-zinc-200 font-medium">{team.city} {team.name}</span>
          </div>

          <button
            onClick={handleSimulateGame}
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 font-semibold text-sm rounded-xl border border-zinc-800 hover:border-zinc-700 shadow-md cursor-pointer transition-all active:scale-[0.98]"
          >
            <Play className="w-4 h-4 text-orange-500 fill-orange-500" />
            <span>Simulate Next Game</span>
          </button>
        </header>

        {/* Inner Content Area */}
        <div className="flex-1 p-6 md:p-8">
          {/* Roster Top Info Banner */}
          <div className="bg-gradient-to-r from-zinc-900 to-zinc-900/30 border border-zinc-900 rounded-3xl p-6 md:p-8 mb-8 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <TrendingUp className="w-48 h-48" />
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border ${
                    team.conference === "Luzon"
                      ? "bg-red-500/10 text-red-400 border-red-500/25"
                      : "bg-cyan-500/10 text-cyan-400 border-cyan-500/25"
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  {team.conference} Conference
                </span>
                <h2 className="text-4xl font-extrabold text-white tracking-tight mb-2">
                  {team.city}{" "}
                  <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                    {team.name}
                  </span>
                </h2>
                <div className="flex items-center gap-2 text-zinc-400 font-medium">
                  <MapPin className="w-4 h-4 text-zinc-500" />
                  <span>{team.city}, Philippines</span>
                </div>
              </div>

              {/* Budget Display */}
              <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-5 flex items-center gap-4 min-w-[240px]">
                <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-zinc-500 font-bold uppercase tracking-wider text-[11px] block">
                    Available Budget
                  </span>
                  <span className="text-xl font-extrabold text-amber-500">
                    {formatPHP(team.budget)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {activeTab === "Roster" ? (
            <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm">
              {/* Roster Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Roster Sheet</h3>
                  <p className="text-zinc-500 text-sm">Active squad of 15 players sorted by overall talent.</p>
                </div>

                <div className="relative w-full md:w-72">
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

              {/* Data Table */}
              <div className="overflow-x-auto rounded-xl border border-zinc-900">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-400 font-bold text-xs uppercase tracking-wider">
                      <th
                        onClick={() => handleSort("name")}
                        className="py-4.5 px-6 cursor-pointer hover:bg-zinc-900 transition-colors select-none w-1/3"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Full Name</span>
                          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("age")}
                        className="py-4.5 px-4 cursor-pointer hover:bg-zinc-900 transition-colors select-none text-center"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Age</span>
                          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("hometown")}
                        className="py-4.5 px-4 cursor-pointer hover:bg-zinc-900 transition-colors select-none"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Hometown</span>
                          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("overall")}
                        className="py-4.5 px-4 cursor-pointer hover:bg-zinc-900 transition-colors select-none text-center"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Overall</span>
                          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
                        </div>
                      </th>
                      <th className="py-4.5 px-4 text-center">3PT</th>
                      <th className="py-4.5 px-4 text-center">INS</th>
                      <th className="py-4.5 px-4 text-center">DEF</th>
                      <th className="py-4.5 px-4 text-center text-zinc-300">REB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 bg-zinc-950/20">
                    {filteredPlayers.length > 0 ? (
                      filteredPlayers.map((player) => {
                        // Average Defense score
                        const defScore = Math.round(
                          (player.perimeterDefense + player.interiorDefense) / 2
                        );

                        // Horizontal Bar Helper for stats
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
                          <tr
                            key={player.id}
                            className="hover:bg-zinc-900/30 transition-all group"
                          >
                            {/* Name & Fil-Am Badge */}
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

                            {/* Age */}
                            <td className="py-4 px-4 text-center">
                              <span className="text-sm font-semibold text-zinc-300">
                                {player.age}
                              </span>
                            </td>

                            {/* Hometown */}
                            <td className="py-4 px-4">
                              <span className="text-sm font-medium text-zinc-400">
                                {player.hometown}
                              </span>
                            </td>

                            {/* Overall Tier Badge */}
                            <td className="py-4 px-4 text-center">
                              <span
                                className={`inline-flex items-center justify-center font-extrabold text-sm w-9 h-9 rounded-xl shadow-sm ${getOverallBadgeClass(
                                  player.overall
                                )}`}
                              >
                                {player.overall}
                              </span>
                            </td>

                            {/* Breakdown Attributes */}
                            <td className="py-4 px-4 text-center">{renderStatBar(player.threePoint)}</td>
                            <td className="py-4 px-4 text-center">{renderStatBar(player.insideScoring)}</td>
                            <td className="py-4 px-4 text-center">{renderStatBar(defScore)}</td>
                            <td className="py-4 px-4 text-center">{renderStatBar(player.rebounding)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-zinc-500">
                          No players found matching that search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-12 text-center shadow-2xl">
              <Trophy className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                {activeTab} Feature is Locked
              </h3>
              <p className="text-zinc-500 max-w-md mx-auto mb-6">
                This area represents the franchise's {activeTab.toLowerCase()} system, which will be unlocked in a future manager expansion update.
              </p>
              <button
                onClick={() => setActiveTab("Roster")}
                className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-xl font-semibold cursor-pointer transition-all"
              >
                Back to Active Roster
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
