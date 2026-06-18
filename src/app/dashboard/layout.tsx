"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { getTeamRoster } from "@/app/actions";
import { getTradeProposalsAction } from "@/app/actions/tradeEngine";
import { getSaveSlotsAction, saveGameAction } from "@/app/actions/saveEngine";
import {
  Users,
  Calendar,
  BarChart3,
  Briefcase,
  LogOut,
  MapPin,
  Shield,
  Coins,
  Loader2,
  Trophy,
  ChevronRight,
  TrendingUp,
  ArrowLeftRight,
  FileText,
  RefreshCw,
  Globe,
  BookOpen,
  Sparkles,
  GraduationCap,
  Save,
  CheckCircle,
  AlertTriangle,
  Search,
  MessageCircle
} from "lucide-react";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
  city: string;
  conference: "Luzon" | "VisMin";
  budget: number;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { userTeamId, setTeam, currentLeagueDay, activeSaveSlotId } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [team, setTeamDetails] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingTradeCount, setPendingTradeCount] = useState<number>(0);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const triggerAlert = (title: string, message: string) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
    });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!userTeamId) {
      router.replace("/");
      return;
    }

    async function loadTeam() {
      try {
        setLoading(true);
        const [data, propRes] = await Promise.all([
          getTeamRoster(userTeamId!),
          getTradeProposalsAction(userTeamId!),
        ]);
        if (data) {
          setTeamDetails(data.team);
        }
        if (propRes.success && propRes.proposals) {
          setPendingTradeCount(propRes.proposals.length);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadTeam();
  }, [mounted, userTeamId, router]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-center p-4">
        <Shield className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Franchise Error</h2>
        <p className="text-zinc-400 mb-6">Could not load details for your selected franchise.</p>
        <button
          onClick={() => {
            setTeam("");
            router.push("/");
          }}
          className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold transition-all cursor-pointer"
        >
          Select Franchise
        </button>
      </div>
    );
  }

  const handleLogout = () => {
    setConfirmModal({
      isOpen: true,
      title: "Exit to Main Menu",
      message: "Are you sure you want to exit to the main menu? Your franchise progress has been automatically saved.",
      confirmText: "Exit Game",
      cancelText: "Stay",
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setTeam("");
        router.push("/");
      },
    });
  };

  const formatPHP = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="flex bg-zinc-950 text-zinc-100 min-h-screen font-sans relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Sidebar Navigation */}
      <aside className="fixed top-0 left-0 h-screen w-60 overflow-y-auto z-40 bg-[var(--color-surface)] border-r border-[var(--color-border)] p-6 hidden md:flex flex-col justify-between scrollbar-hide">
        <div>
          {/* Logo / Title */}
          <div className="flex items-center gap-1.5 mb-8 px-2">
            <Trophy className="w-5 h-5 text-orange-500 mr-2 animate-pulse" />
            <div>
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted block">FILIPINO</span>
              <span className="text-[13px] font-bold text-zinc-100 block">BASKETBALL MGR</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {[
              {
                title: "Franchise Management",
                links: [
                  { name: "Active Roster", path: "/dashboard", icon: Users },
                  { name: "Player Evolution", path: "/dashboard/evolution", icon: Sparkles },
                  { name: "Team Schedule", path: "/dashboard/schedule", icon: Calendar },
                  { name: "Transactions Office", path: "/dashboard/trades", icon: ArrowLeftRight },
                  { name: "Team Finances", path: "/dashboard/finances", icon: Coins },
                  { name: "Free Agency Market", path: "/dashboard/free-agency", icon: Briefcase },
                  { name: "Trade Proposals", path: "/dashboard/trade-proposals", icon: RefreshCw },
                ],
              },
              {
                title: "League Core Hub",
                links: [
                  { name: "Conference Standings", path: "/dashboard/standings", icon: BarChart3 },
                  { name: "Playoffs", path: "/dashboard/playoffs", icon: Trophy },
                  { name: "Statistical Leaders", path: "/dashboard/leaders", icon: TrendingUp },
                  { name: "Player Directory", path: "/dashboard/player-directory", icon: Search },
                  { name: "League Directory", path: "/dashboard/teams", icon: Globe },
                  { name: "Draft Prospects", path: "/dashboard/prospects", icon: GraduationCap },
                ],
              },
              {
                title: "Records & Timelines",
                links: [
                  { name: "League History", path: "/dashboard/history", icon: BookOpen },
                  { name: "League News Feed", path: "/dashboard/transactions", icon: FileText },
                  { name: "Tambayan", path: "/dashboard/tambayan", icon: MessageCircle },
                  { name: "Offseason Hub", path: "/dashboard/offseason", icon: Sparkles },
                ],
              },
            ].map((group) => (
              <div key={group.title} className="flex flex-col gap-1">
                <div className="text-xs font-semibold text-zinc-500 mt-6 mb-2 px-3 tracking-wider uppercase">
                  {group.title}
                </div>
                {group.links.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.path;
                  const hasBadge = item.name === "Trade Proposals" && pendingTradeCount > 0;
                  return (
                    <Link
                      key={item.name}
                      href={item.path}
                      className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_4px_15px_rgba(249,115,22,0.15)]"
                          : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                      <span>{item.name}</span>
                      {hasBadge && (
                        <span className="ml-auto px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full leading-none animate-pulse">
                          {pendingTradeCount}
                        </span>
                      )}
                      {isActive && !hasBadge && <ChevronRight className="w-4 h-4 ml-auto" />}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Autosave Status Indicator */}
        <div className="w-full border-t border-zinc-900 mt-auto pt-4 mb-2">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-zinc-900/30 border border-zinc-900/40">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-zinc-400 tracking-wide">
              Autosave Active
            </span>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="ml-0 md:ml-60 flex-1 flex flex-col min-h-screen relative z-10 overflow-y-auto min-w-0">
        {/* Top Header */}
        <header className="border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4 md:hidden">
            <button
              onClick={handleLogout}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-lg cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <h1 className="font-bold tracking-tight text-white">Front Office</h1>
          </div>

          <div className="hidden md:flex items-center gap-2 text-zinc-400 text-sm">
            <span>Franchise Mode</span>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
            <span className="text-zinc-200 font-medium">{team.city} {team.name}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit to Main Menu</span>
            </button>
          </div>

          {/* Quick links for mobile */}
          <div className="flex md:hidden gap-1 text-[10px] sm:text-xs overflow-x-auto pb-1 max-w-full">
            <Link href="/dashboard" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Roster</Link>
            <Link href="/dashboard/evolution" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Evolution</Link>
            <Link href="/dashboard/schedule" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Games</Link>
            <Link href="/dashboard/trades" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Trades</Link>
            <Link href="/dashboard/finances" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Finances</Link>
            <Link href="/dashboard/free-agency" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">FA</Link>
            <Link href="/dashboard/trade-proposals" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap flex items-center gap-1">
              <span>Proposals</span>
              {pendingTradeCount > 0 && (
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
              )}
            </Link>
            <Link href="/dashboard/standings" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Standings</Link>
            <Link href="/dashboard/playoffs" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Playoffs</Link>
            <Link href="/dashboard/leaders" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Leaders</Link>
            <Link href="/dashboard/player-directory" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Players</Link>
            <Link href="/dashboard/teams" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Teams</Link>
            <Link href="/dashboard/prospects" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Prospects</Link>
            <Link href="/dashboard/history" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">History</Link>
            <Link href="/dashboard/transactions" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">News</Link>
            <Link href="/dashboard/tambayan" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Tambayan</Link>
            <Link href="/dashboard/offseason" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Offseason</Link>
          </div>
        </header>

        {/* Inner Content Area */}
        <div className="flex-1 p-6 md:p-8 min-w-0">
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

          {children}
        </div>
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

        {/* Custom Confirm Modal */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-zinc-955/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 md:p-8 relative shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full pointer-events-none" />
              
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-500">
                  <LogOut className="w-6 h-6 animate-pulse" />
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
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl transition-all shadow-md cursor-pointer text-sm"
                >
                  {confirmModal.confirmText || "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
