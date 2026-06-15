"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useGameStore } from "@/store/useGameStore";
import { getTeamRoster } from "@/app/actions";
import {
  togglePlayerTradeBlockAction,
  togglePickTradeBlockAction,
  getTradeOffersAction,
  executeUserTradeAction,
} from "@/app/actions/tradeEngine";
import { getUserDraftPicksAction } from "@/app/actions/offseasonEngine";
import {
  Users,
  Search,
  Loader2,
  Sparkles,
  ArrowUpDown,
  RefreshCw,
  Coins,
  ArrowLeftRight,
  X,
  ShieldAlert,
} from "lucide-react";
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
  isOnTradeBlock: boolean;
  yearsPlayed?: number;
}

type SortKey = "name" | "age" | "overall" | "salary" | "position";

export default function TradeBlockPage() {
  const router = useRouter();
  const { userTeamId } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [playersList, setPlayersList] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userTeam, setUserTeam] = useState<any>(null);

  // Search/Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortAsc, setSortAsc] = useState(false);

  // Modal & Trade Finder State
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [selectedAssetType, setSelectedAssetType] = useState<"PLAYER" | "PICK">("PLAYER");
  const [draftPicksList, setDraftPicksList] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [offers, setOffers] = useState<any[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);
  const [confirmingTradeId, setConfirmingTradeId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadRoster = async () => {
    if (!userTeamId) return;
    try {
      setLoading(true);
      setError(null);
      const rosterData = await getTeamRoster(userTeamId);
      if (!rosterData) {
        setError("Team roster details not found.");
      } else {
        setPlayersList(rosterData.players as Player[]);
        setUserTeam(rosterData.team);
      }

      const picksRes = await getUserDraftPicksAction(userTeamId);
      if (picksRes.success && picksRes.picks) {
        setDraftPicksList(picksRes.picks);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load franchise roster.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted && userTeamId) {
      loadRoster();
    }
  }, [mounted, userTeamId]);

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
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-semibold cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Toggle Trade Block Status
  const handleToggleBlock = async (playerId: string, currentVal: boolean) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const newVal = !currentVal;
      const res = await togglePlayerTradeBlockAction(playerId, newVal);
      if (res.success) {
        setPlayersList((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, isOnTradeBlock: newVal } : p))
        );
      } else {
        setActionError("Failed to update player trade block status. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setActionError("An error occurred while updating the trade block status.");
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Draft Pick Block Status
  const handleTogglePickBlock = async (pickId: string, currentVal: boolean) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const newVal = !currentVal;
      const res = await togglePickTradeBlockAction(pickId, newVal);
      if (res.success) {
        setDraftPicksList((prev) =>
          prev.map((p) => (p.id === pickId ? { ...p, isAvailable: newVal } : p))
        );
      } else {
        setActionError("Failed to update pick trade block status. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setActionError("An error occurred while updating the trade block status.");
    } finally {
      setActionLoading(false);
    }
  };

  // Find Trade Offers
  const handleFindOffers = async (asset: any, type: "PLAYER" | "PICK") => {
    setSelectedAsset(asset);
    setSelectedAssetType(type);
    if (type === "PLAYER") {
      setSelectedPlayer(asset);
    } else {
      setSelectedPlayer(null);
    }
    setIsModalOpen(true);
    setScanning(true);
    setOffers([]);
    try {
      const res = await getTradeOffersAction(asset.id, type);
      setOffers(res);
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  // Accept Trade
  const handleAcceptTrade = async (offer: any) => {
    if (!selectedAsset) return;

    const key = offer.cpuTeamId;
    if (confirmingTradeId !== key) {
      setConfirmingTradeId(key);
      return;
    }
    setConfirmingTradeId(null);
    setActionError(null);
    setActionLoading(true);
    try {
      const cpuPlayerIds = offer.cpuPlayers.map((p: any) => p.id);
      const cpuPickIds = offer.cpuPicks.map((p: any) => p.id);

      const res = await executeUserTradeAction(
        selectedAsset.id,
        selectedAssetType,
        offer.cpuTeamId,
        cpuPlayerIds,
        cpuPickIds
      );
      if (res.success) {
        setTradeSuccess(`Trade executed successfully!`);
        setIsModalOpen(false);
        await loadRoster();
        router.refresh();
      } else {
        setActionError(res.error || "Failed to execute trade. Roster or salary rules violated.");
      }
    } catch (err) {
      console.error(err);
      setActionError("An error occurred during trade execution.");
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

  // Sort & Filter
  const filteredPlayers = playersList
    .filter((player) => {
      const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
      const pos = player.position.toLowerCase();
      const query = searchQuery.toLowerCase();
      return fullName.includes(query) || pos.includes(query);
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

      {/* Trade Block Roster Panel */}
      <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Franchise Trade Block</h3>
            <p className="text-zinc-500 text-sm">
              List players on the trade block to receive trade proposals from other teams in the league.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Search Input */}
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

        {/* Players List Table */}
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
                  onClick={() => handleSort("salary")}
                  className="py-4.5 px-4 cursor-pointer hover:bg-zinc-900 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Salary</span>
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
                <th className="py-4.5 px-6 text-center">Status & Offers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 bg-zinc-950/20">
              {filteredPlayers.length > 0 ? (
                filteredPlayers.map((player) => (
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

                    {/* Trade Block Toggle & Finder Trigger */}
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleBlock(player.id, player.isOnTradeBlock)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              player.isOnTradeBlock ? "bg-orange-500" : "bg-zinc-800"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                player.isOnTradeBlock ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                          <span className={`text-xs font-bold ${player.isOnTradeBlock ? "text-orange-400 animate-pulse" : "text-zinc-500"}`}>
                            {player.isOnTradeBlock ? "On Block" : "Private"}
                          </span>
                        </div>

                        {player.isOnTradeBlock && (
                          <button
                            onClick={() => handleFindOffers(player, "PLAYER")}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500 hover:text-white rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer shadow-[0_0_12px_rgba(249,115,22,0.15)] hover:shadow-[0_0_16px_rgba(249,115,22,0.35)] active:scale-[0.97]"
                          >
                            <span>🔍 Find Offers</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No players found on your roster.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Draft Picks On The Block Section */}
      <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h4 className="text-base font-bold text-white">Draft Picks On The Block</h4>
            <p className="text-zinc-500 text-xs">
              List franchise draft picks on the trade block to receive counter-offers from CPU teams.
            </p>
          </div>
          <span className="text-xs font-bold text-zinc-400 bg-zinc-950 px-3 py-1 rounded-full border border-zinc-900">
            {draftPicksList.filter((p) => p.isAvailable).length} Available
          </span>
        </div>

        {draftPicksList.length === 0 ? (
          <div className="bg-zinc-950/20 border border-zinc-900 rounded-2xl p-6 text-center text-zinc-500 text-xs italic">
            No draft picks available to trade.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {draftPicksList.map((pick) => (
              <div
                key={pick.id}
                className="bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 transition-all rounded-2xl p-4.5 flex flex-col justify-between gap-3 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 blur-2xl rounded-full pointer-events-none group-hover:bg-orange-500/10 transition-all" />
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      Season {pick.season}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                      Round {pick.round}
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-zinc-200">
                    Round {pick.round} Draft Pick
                  </h5>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Original: {pick.originalTeamCity} {pick.originalTeamName}
                  </p>
                </div>
                <div className="flex flex-col gap-2.5 mt-2 pt-3 border-t border-zinc-900/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-zinc-400">Trade Value</span>
                    <span className="text-xs font-bold text-amber-500">{pick.round === 1 ? 78 : 65} pts</span>
                  </div>
                  <div className="flex items-center justify-between mt-1 border-t border-zinc-900/30 pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePickBlock(pick.id, pick.isAvailable)}
                        className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          pick.isAvailable ? "bg-orange-500" : "bg-zinc-800"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            pick.isAvailable ? "translate-x-4.5" : "translate-x-0"
                          }`}
                        />
                      </button>
                      <span className={`text-[10px] font-bold ${pick.isAvailable ? "text-orange-400 animate-pulse" : "text-zinc-500"}`}>
                        {pick.isAvailable ? "On Block" : "Private"}
                      </span>
                    </div>
                    {pick.isAvailable && (
                      <button
                        onClick={() => handleFindOffers(pick, "PICK")}
                        className="px-2.5 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-sm"
                      >
                        Find Offers
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Incoming Offers Modal Component */}
      {isModalOpen && selectedAsset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-3xl w-full relative shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-orange-500" />
                  Trade Offers for {selectedAssetType === "PLAYER" 
                    ? `${selectedAsset.firstName} ${selectedAsset.lastName}`
                    : `Season ${selectedAsset.season} Round ${selectedAsset.round} Pick`
                  }
                </h3>
                <p className="text-zinc-500 text-xs mt-1">
                  {selectedAssetType === "PLAYER" ? (
                    `Position: ${selectedAsset.position} | Overall: ${selectedAsset.overall} | Salary: ${formatPHP(selectedAsset.salary)}`
                  ) : (
                    `Original: ${selectedAsset.originalTeamCity} ${selectedAsset.originalTeamName} | Value: ${selectedAsset.round === 1 ? 78 : 65} pts`
                  )}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 overflow-y-auto flex-1">
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                  <p className="text-zinc-400 text-sm font-semibold animate-pulse">
                    Scanning league rosters for rational trade partners...
                  </p>
                </div>
              ) : offers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
                  <div className="p-3.5 bg-red-500/10 text-red-400 rounded-full border border-red-500/20">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <h4 className="text-white font-bold text-lg">No Counter-Offers Found</h4>
                  <p className="text-zinc-500 text-sm max-w-md">
                    No franchises are offering a balanced counter package matching our asset valuation criteria right now. Check back later.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    Found {offers.length} viable mid-season swap options:
                  </p>
                  
                  <div className="space-y-4">
                    {offers.map((offer) => {
                      const userAssetVal = selectedAssetType === "PLAYER" 
                        ? selectedAsset.overall 
                        : (selectedAsset.round === 1 ? 78 : 65);

                      const cpuPlayersVal = offer.cpuPlayers.reduce((sum: number, p: any) => sum + p.overall, 0);
                      const cpuPicksVal = offer.cpuPicks.reduce((sum: number, p: any) => sum + (p.round === 1 ? 78 : 65), 0);
                      const cpuTotalVal = cpuPlayersVal + cpuPicksVal;

                      const salaryDiff = offer.cpuPlayers.reduce((sum: number, p: any) => sum + p.salary, 0) - (selectedAssetType === "PLAYER" ? selectedAsset.salary : 0);
                      const isCpuPayingMore = salaryDiff > 0;

                      return (
                        <div
                          key={offer.cpuTeamId}
                          className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:border-zinc-800 transition-all duration-200"
                        >
                          <div className="flex-1 space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                              {offer.cpuTeamCity} {offer.cpuTeamName}
                            </h4>
                            <div className="text-zinc-300 text-xs space-y-1.5">
                              <p className="font-semibold text-zinc-400 text-[10px] uppercase">Receive Assets:</p>
                              <div className="space-y-1">
                                {offer.cpuPlayers.map((p: any) => (
                                  <div key={p.id} className="flex justify-between items-center bg-zinc-950/40 p-2 rounded-xl border border-zinc-900 gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-7 h-7 shrink-0 bg-zinc-950 border border-zinc-850 rounded-lg overflow-hidden shadow-xs">
                                        <PlayerAvatar
                                          playerId={p.id}
                                          firstName={p.firstName}
                                          lastName={p.lastName}
                                          position={p.position}
                                          teamName={offer.cpuTeamName}
                                          teamConference={null}
                                        />
                                      </div>
                                      <span className="font-bold text-zinc-100 truncate">{p.firstName} {p.lastName} <span className="text-zinc-500 font-bold text-[10px]">({p.position})</span></span>
                                    </div>
                                    <span className="text-amber-500 font-bold text-xs shrink-0">{formatPHP(p.salary)} • {p.overall} OVR</span>
                                  </div>
                                ))}
                                {offer.cpuPicks.map((p: any) => (
                                  <div key={p.id} className="flex justify-between items-center bg-zinc-950/40 p-2 rounded-xl border border-zinc-900">
                                    <span className="font-bold text-zinc-100">Season {p.season} Round {p.round} pick</span>
                                    <span className="text-orange-400 font-bold">{p.round === 1 ? 78 : 65} pts</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Comparison block */}
                            <div className="grid grid-cols-3 gap-2 py-2.5 text-center text-xs bg-zinc-950/80 rounded-xl border border-zinc-900/80">
                              <div>
                                <span className="text-zinc-500 block uppercase font-bold text-[9px] tracking-wider mb-0.5">Value</span>
                                <span className="font-extrabold text-zinc-200">
                                  {userAssetVal} ➔ {cpuTotalVal}{" "}
                                  <span className={cpuTotalVal >= userAssetVal ? "text-emerald-400" : "text-red-400"}>
                                    ({cpuTotalVal - userAssetVal >= 0 ? "+" : ""}{cpuTotalVal - userAssetVal})
                                  </span>
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-500 block uppercase font-bold text-[9px] tracking-wider mb-0.5">Salary Change</span>
                                <span className={`font-extrabold ${isCpuPayingMore ? "text-red-400" : "text-emerald-400"}`}>
                                  {isCpuPayingMore ? "+" : ""}{formatPHP(salaryDiff)}
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-500 block uppercase font-bold text-[9px] tracking-wider mb-0.5">Roster Count</span>
                                <span className="font-extrabold text-zinc-200">
                                  {selectedAssetType === "PLAYER" ? "-1" : "0"} ➔ +{offer.cpuPlayers.length}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center">
                            <button
                              onClick={() => handleAcceptTrade(offer)}
                              className="w-full md:w-auto flex items-center justify-center gap-1.5 px-5 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.98]"
                            >
                              <span>🤝 Accept Trade</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-zinc-950/60 border-t border-zinc-900/60 text-right">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:text-zinc-200 rounded-xl text-xs font-bold text-zinc-400 transition-all cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
