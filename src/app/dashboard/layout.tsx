"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { getTeamRoster } from "@/app/actions";
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
  BarChart2,
  GraduationCap,
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
  const { userTeamId, setTeam } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [team, setTeamDetails] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

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
        const data = await getTeamRoster(userTeamId!);
        if (data) {
          setTeamDetails(data.team);
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
    setTeam("");
    router.push("/");
  };

  const formatPHP = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

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
              { name: "Roster", path: "/dashboard", icon: Users },
              { name: "Schedule", path: "/dashboard/schedule", icon: Calendar },
              { name: "Standings", path: "/dashboard/standings", icon: BarChart3 },
              { name: "Playoffs", path: "/dashboard/playoffs", icon: Trophy },
              { name: "League News", path: "/dashboard/transactions", icon: FileText },
              { name: "League Leaders", path: "/dashboard/leaders", icon: BarChart2 },
              { name: "League Teams", path: "/dashboard/teams", icon: Globe },
              { name: "Free Agency", path: "/dashboard/free-agency", icon: Briefcase },
              { name: "Trades Office", path: "/dashboard/trades", icon: ArrowLeftRight },
              { name: "Draft Prospects", path: "/dashboard/prospects", icon: GraduationCap },
              { name: "Offseason Hub", path: "/dashboard/offseason", icon: RefreshCw },
              { name: "League History", path: "/dashboard/history", icon: BookOpen },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
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
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
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
            <h1 className="font-bold tracking-tight text-white">Front Office</h1>
          </div>

          <div className="hidden md:flex items-center gap-2 text-zinc-400 text-sm">
            <span>Franchise Mode</span>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
            <span className="text-zinc-200 font-medium">{team.city} {team.name}</span>
          </div>

          {/* Quick links for mobile */}
          <div className="flex md:hidden gap-1 text-[10px] sm:text-xs overflow-x-auto pb-1 max-w-full">
            <Link href="/dashboard" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Roster</Link>
            <Link href="/dashboard/schedule" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Games</Link>
            <Link href="/dashboard/standings" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Standings</Link>
            <Link href="/dashboard/playoffs" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Playoffs</Link>
            <Link href="/dashboard/transactions" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">News</Link>
            <Link href="/dashboard/leaders" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Leaders</Link>
            <Link href="/dashboard/teams" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Teams</Link>
            <Link href="/dashboard/free-agency" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">FA</Link>
            <Link href="/dashboard/trades" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Trades</Link>
            <Link href="/dashboard/prospects" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">Prospects</Link>
            <Link href="/dashboard/history" className="px-2 py-1 bg-zinc-900 rounded whitespace-nowrap">History</Link>
          </div>
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

          {children}
        </div>
      </main>
    </div>
  );
}
