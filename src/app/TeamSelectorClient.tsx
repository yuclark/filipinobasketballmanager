"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { Search, Trophy, MapPin, Sparkles, ChevronRight, Coins, Shield } from "lucide-react";

interface Team {
  id: string;
  name: string;
  city: string;
  conference: "Luzon" | "VisMin";
  budget: number;
}

interface TeamSelectorClientProps {
  teams: Team[];
}

export default function TeamSelectorClient({ teams }: TeamSelectorClientProps) {
  const router = useRouter();
  const setTeam = useGameStore((state) => state.setTeam);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConference, setSelectedConference] = useState<"All" | "Luzon" | "VisMin">("All");

  const handleSelectTeam = (teamId: string) => {
    setTeam(teamId);
    router.push("/dashboard");
  };

  const filteredTeams = teams.filter((team) => {
    const matchesSearch =
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.city.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesConference =
      selectedConference === "All" || team.conference === selectedConference;

    return matchesSearch && matchesConference;
  });

  const formatPHP = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 relative z-10">
      {/* Hero Header */}
      <div className="text-center mb-16 relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-400 text-sm font-semibold mb-6 animate-pulse">
          <Sparkles className="w-4 h-4" />
          <span>Basketball Management Sim</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6">
          FILIPINO <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">BASKETBALL</span> MANAGER
        </h1>
        <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto">
          Take control of a professional franchise. Manage your roster, draft Fil-Am talent, sign superstars, and lead your team to PBA glory.
        </p>
      </div>

      {/* Control Bar (Search + Filter) */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 mb-12 backdrop-blur-md shadow-2xl">
        <div className="relative w-full md:w-96">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
            <Search className="w-5 h-5" />
          </span>
          <input
            type="text"
            placeholder="Search teams by city or mascot..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {(["All", "Luzon", "VisMin"] as const).map((conf) => (
            <button
              key={conf}
              onClick={() => setSelectedConference(conf)}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all whitespace-nowrap cursor-pointer ${
                selectedConference === conf
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              {conf === "All"
                ? "All Conferences"
                : conf === "Luzon"
                ? "Luzon Conference"
                : "VisMin Conference"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Layout */}
      {filteredTeams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map((team) => {
            const isLuzon = team.conference === "Luzon";
            return (
              <div
                key={team.id}
                onClick={() => handleSelectTeam(team.id)}
                className="group relative bg-gradient-to-b from-zinc-900 to-zinc-950 hover:from-zinc-900 hover:to-zinc-900/90 border border-zinc-800 hover:border-orange-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-500/5"
              >
                {/* Conference Badge */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-1 text-zinc-500 text-xs font-medium">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{team.city}</span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                      isLuzon
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    }`}
                  >
                    <Shield className="w-3 h-3" />
                    {team.conference}
                  </span>
                </div>

                {/* Team Info */}
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white group-hover:text-orange-400 transition-colors">
                    {team.city}
                  </h3>
                  <p className="text-3xl font-extrabold text-zinc-100 group-hover:scale-[1.01] origin-left transition-transform">
                    {team.name}
                  </p>
                </div>

                {/* Divider */}
                <div className="border-t border-zinc-800/80 my-4" />

                {/* Bottom Stats */}
                <div className="flex justify-between items-center text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-semibold tracking-wide">
                      {formatPHP(team.budget)}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500 group-hover:translate-x-1 transition-transform">
                    <span>Select Team</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Subtle outer glow on hover */}
                <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-orange-500/10 pointer-events-none transition-all duration-300" />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-zinc-900/20 border border-zinc-800/50 rounded-2xl backdrop-blur-sm">
          <Trophy className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No teams found</h3>
          <p className="text-zinc-500">
            Try adjusting your search query or conference filter.
          </p>
        </div>
      )}
    </div>
  );
}
