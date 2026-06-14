"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import {
  Search,
  Trophy,
  MapPin,
  Sparkles,
  ChevronRight,
  Coins,
  Shield,
  Trash2,
  FolderOpen,
  Play,
  Loader2,
  Plus,
  AlertTriangle
} from "lucide-react";
import {
  getSaveSlotsAction,
  loadGameAction,
  deleteSaveSlotAction,
  resetActiveGameAction
} from "@/app/actions/saveEngine";

interface Team {
  id: string;
  name: string;
  city: string;
  conference: "Luzon" | "VisMin";
  budget: number;
}

interface SaveSlot {
  id: string;
  name: string;
  userTeamId: string | null;
  managedTeamName: string | null;
  managedTeamCity: string | null;
  currentLeagueDay: number;
  currentSeasonYear: number;
  updatedAt: Date;
}

interface TeamSelectorClientProps {
  teams: Team[];
}

export default function TeamSelectorClient({ teams }: TeamSelectorClientProps) {
  const router = useRouter();
  const setTeam = useGameStore((state) => state.setTeam);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConference, setSelectedConference] = useState<"All" | "Luzon" | "VisMin">("All");

  // Save/Load States
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [loadingSaves, setLoadingSaves] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"saves" | "new_game">("new_game");

  // Custom Alert and Confirm Modal States
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: "warning" | "danger" | "info";
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  const triggerConfirm = (options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: "warning" | "danger" | "info";
    onConfirm: () => void | Promise<void>;
  }) => {
    setConfirmModal({
      ...options,
      isOpen: true,
    });
  };

  const triggerAlert = (title: string, message: string) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
    });
  };

  const fetchSlots = async () => {
    try {
      setLoadingSaves(true);
      const res = await getSaveSlotsAction();
      if (res.success && res.slots) {
        // Parse dates correctly
        const parsedSlots = res.slots.map((s: any) => ({
          ...s,
          updatedAt: new Date(s.updatedAt)
        }));
        setSaveSlots(parsedSlots);
        if (parsedSlots.length > 0) {
          setActiveTab("saves");
        }
      }
    } catch (err) {
      console.error("Failed to load saves:", err);
    } finally {
      setLoadingSaves(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, []);

  const handleSelectTeam = async (teamId: string) => {
    triggerConfirm({
      title: "Start New Franchise",
      message: "Starting a new game will reset the active league state. Any unsaved active progress will be overwritten. Do you want to proceed?",
      type: "warning",
      confirmText: "Proceed",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          setActionLoading(true);
          const res = await resetActiveGameAction();
          if (res.success) {
            setTeam(teamId);
            // Reset client Zustand store states back to day 1 fresh game
            useGameStore.setState({
              currentLeagueDay: 1,
              tradeDeadlinePassed: false,
              isSimulating: false,
            });
            router.push("/dashboard");
          } else {
            triggerAlert("Seeding Failed", "Failed to initialize new game: " + res.error);
          }
        } catch (err: any) {
          triggerAlert("System Error", "Error starting new game: " + err.message);
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleLoadSave = async (slotId: string) => {
    try {
      setActionLoading(true);
      const res = await loadGameAction(slotId);
      if (res.success) {
        useGameStore.setState({
          userTeamId: res.userTeamId,
          currentLeagueDay: res.currentLeagueDay,
        });
        router.push("/dashboard");
      } else {
        triggerAlert("Load Failed", "Failed to load save: " + res.error);
      }
    } catch (err: any) {
      triggerAlert("System Error", "Error loading save: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSave = async (slotId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerConfirm({
      title: "Delete Save Slot",
      message: "Are you sure you want to permanently delete this save slot? This action cannot be undone.",
      type: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          setActionLoading(true);
          const res = await deleteSaveSlotAction(slotId);
          if (res.success) {
            // Refresh saves list
            const updated = saveSlots.filter((s) => s.id !== slotId);
            setSaveSlots(updated);
            if (updated.length === 0) {
              setActiveTab("new_game");
            }
          } else {
            triggerAlert("Delete Failed", "Failed to delete save slot.");
          }
        } catch (err: any) {
          triggerAlert("System Error", "An error occurred while deleting the save slot: " + err.message);
        } finally {
          setActionLoading(false);
        }
      }
    });
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
      {/* Loading Overlay */}
      {actionLoading && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md flex flex-col items-center justify-center z-50">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
          <p className="text-zinc-400 font-semibold text-lg">Loading database state, please wait...</p>
        </div>
      )}

      {/* Hero Header */}
      <div className="text-center mb-12 relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-400 text-sm font-semibold mb-6 animate-pulse">
          <Sparkles className="w-4 h-4" />
          <span>Basketball Management Sim</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6">
          FILIPINO <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">BASKETBALL</span> MANAGER
        </h1>
        <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto">
          Take control of a professional franchise. Manage your roster, draft Fil-Am talent, sign superstars, and lead your team to FBM glory.
        </p>
      </div>

      {/* Save Game / New Game Switcher Tab */}
      {saveSlots.length > 0 && (
        <div className="flex justify-center mb-12">
          <div className="bg-zinc-900/80 border border-zinc-800 p-1.5 rounded-2xl flex gap-1">
            <button
              onClick={() => setActiveTab("saves")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activeTab === "saves"
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span>Load Saved Game</span>
            </button>
            <button
              onClick={() => setActiveTab("new_game")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activeTab === "new_game"
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Start New Franchise</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Load Saved Game */}
      {activeTab === "saves" && saveSlots.length > 0 && (
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-16 animate-in fade-in slide-in-from-bottom-4 duration-350">
          {saveSlots.map((slot) => {
            const hasManagedTeam = slot.managedTeamName && slot.managedTeamCity;
            return (
              <div
                key={slot.id}
                onClick={() => handleLoadSave(slot.id)}
                className="group relative bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 hover:from-zinc-900 border border-zinc-800 hover:border-orange-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-500/5 flex flex-col justify-between"
              >
                {/* Header */}
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/10">
                      Save Slot
                    </span>
                    <button
                      onClick={(e) => handleDeleteSave(slot.id, e)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Delete Save Slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-orange-400 transition-colors">
                    {slot.name}
                  </h3>
                  <p className="text-zinc-400 text-xs mb-4">
                    Last Saved: {slot.updatedAt.toLocaleDateString("en-PH", {
                      month: "long",
                      day: "numeric",
                      year: "numeric"
                    })} at {slot.updatedAt.toLocaleTimeString("en-PH", {
                      hour: "numeric",
                      minute: "2-digit"
                    })}
                  </p>

                  {/* Managed Team Details */}
                  {hasManagedTeam ? (
                    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 mb-4 flex items-center gap-3">
                      <div className="p-2.5 bg-orange-500/10 rounded-lg text-orange-400">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
                          Managed Franchise
                        </div>
                        <div className="text-sm font-bold text-zinc-200">
                          {slot.managedTeamCity} {slot.managedTeamName}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 mb-4 text-center text-zinc-500 text-xs">
                      No team selected yet
                    </div>
                  )}
                </div>

                {/* Footer Details */}
                <div className="flex justify-between items-end mt-4 pt-4 border-t border-zinc-800/60">
                  <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                    Season {slot.currentSeasonYear} • Day {slot.currentLeagueDay}
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-500 group-hover:translate-x-1 transition-transform">
                    <span>Load Game</span>
                    <Play className="w-3.5 h-3.5 fill-orange-500" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB CONTENT: Start New Franchise */}
      {activeTab === "new_game" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-350">
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
      )}
      {/* Custom Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-zinc-955/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 md:p-8 relative shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {confirmModal.type === "danger" ? (
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
            ) : (
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full pointer-events-none" />
            )}
            
            <div className="flex items-start gap-4 mb-6">
              <div className={`p-3 rounded-2xl ${
                confirmModal.type === "danger"
                  ? "bg-red-500/10 text-red-500"
                  : "bg-orange-500/10 text-orange-500"
              }`}>
                {confirmModal.type === "danger" ? (
                  <Trash2 className="w-6 h-6 animate-pulse" />
                ) : (
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{confirmModal.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-5 py-2.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-semibold rounded-xl transition-all cursor-pointer text-sm"
              >
                {confirmModal.cancelText || "Cancel"}
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`px-5 py-2.5 text-white font-bold rounded-xl transition-all shadow-md cursor-pointer text-sm ${
                  confirmModal.type === "danger"
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                }`}
              >
                {confirmModal.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 bg-zinc-955/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 md:p-8 relative shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
            
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 rounded-2xl bg-red-500/10 text-red-500">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{alertModal.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{alertModal.message}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl transition-all shadow-md cursor-pointer text-sm"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
