"use client";

import { useEffect, useState } from "react";
import { getTransactionsAction } from "@/app/actions/transactions";
import {
  FileText,
  Loader2,
  RefreshCw,
  ArrowLeftRight,
  UserPlus,
  UserMinus,
  Calendar,
  Activity,
  GraduationCap,
  Sparkles
} from "lucide-react";
import React from "react";

interface Transaction {
  id: string;
  type: "Trade" | "Signing" | "Release" | "Injury" | "Draft";
  description: string;
  seasonYear: number;
  gameDay: number;
  createdAt: string | Date;
}

type FilterType = "All" | "Trade" | "Signing" | "Injury" | "Draft";

export default function TransactionsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<FilterType>("All");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadTransactions = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const res = await getTransactionsAction();
      setTransactions((res as unknown as Transaction[]) || []);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load transactions history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      loadTransactions();
    }
  }, [mounted]);

  // Filter transactions dynamically
  const filteredTransactions = transactions.filter((tx) => {
    if (filter === "All") return true;
    if (filter === "Signing") {
      return tx.type === "Signing" || tx.type === "Release";
    }
    return tx.type === filter;
  });

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // Helper for type badges
  const getBadgeConfig = (type: string) => {
    switch (type) {
      case "Signing":
        return {
          bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          label: "Signing",
          icon: UserPlus,
        };
      case "Release":
        return {
          bg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
          label: "Waiver",
          icon: UserMinus,
        };
      case "Trade":
        return {
          bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          label: "Trade",
          icon: ArrowLeftRight,
        };
      case "Injury":
        return {
          bg: "bg-red-500/10 text-red-400 border-red-500/20",
          label: "Injury",
          icon: Activity,
        };
      case "Draft":
        return {
          bg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
          label: "Draft Pick",
          icon: GraduationCap,
        };
      default:
        return {
          bg: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
          label: "Transaction",
          icon: FileText,
        };
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-orange-500/10 rounded-2xl text-orange-500">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">League News & Logs</h3>
            <p className="text-zinc-500 text-sm font-semibold tracking-wide">
              Official front-office movements, roster trades, waivers, and injury updates
            </p>
          </div>
        </div>

        <button
          onClick={() => loadTransactions(true)}
          disabled={refreshing}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl font-semibold cursor-pointer text-sm transition-all"
        >
          <RefreshCw className={`w-4 h-4 text-zinc-400 ${refreshing ? "animate-spin" : ""}`} />
          <span>Refresh News</span>
        </button>
      </div>

      {/* Segmented Filter Bar */}
      <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-900 self-start max-w-full overflow-x-auto gap-1">
        {[
          { label: "All News", value: "All" },
          { label: "Trades", value: "Trade" },
          { label: "Signings", value: "Signing" },
          { label: "Injuries", value: "Injury" },
          { label: "Draft Picks", value: "Draft" },
        ].map((item) => (
          <button
            key={item.value}
            onClick={() => setFilter(item.value as FilterType)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer whitespace-nowrap ${
              filter === item.value
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="text-center py-12 text-zinc-500">
          <p className="mb-4">{error}</p>
          <button
            onClick={() => loadTransactions()}
            className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-all text-white"
          >
            Try Again
          </button>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-900 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-2xl">
          <Calendar className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h4 className="text-lg font-bold text-zinc-200">No News to Display</h4>
          <p className="text-zinc-500 text-xs mt-2 max-w-xs mx-auto">
            Roster activity matching your filter will be displayed here once it occurs.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm max-w-4xl mx-auto">
          {/* Feed Timeline */}
          <div className="relative border-l border-zinc-900 ml-3 md:ml-6 space-y-8 py-2">
            {filteredTransactions.map((tx) => {
              const { bg, label, icon: Icon } = getBadgeConfig(tx.type);
              const formattedDate = new Date(tx.createdAt).toLocaleDateString("en-PH", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              const isBlockbuster = tx.description.startsWith("BLOCKBUSTER:");
              const cleanDescription = isBlockbuster 
                ? tx.description.replace(/^BLOCKBUSTER:\s*/, "") 
                : tx.description;

              return (
                <div key={tx.id} className="relative pl-8 group">
                  {/* Timeline point */}
                  <span className={`absolute -left-[18px] top-1.5 p-1.5 rounded-full border bg-zinc-950 transition-transform duration-200 group-hover:scale-110 ${bg}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>

                  <div className="bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 rounded-2xl p-5 transition-all shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      {/* Badge and Title */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border self-start ${bg}`}>
                          {label}
                        </span>
                        {isBlockbuster && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-[9px] font-extrabold uppercase tracking-wider animate-pulse">
                            <Sparkles className="w-2.5 h-2.5 text-yellow-400" />
                            Blockbuster
                          </span>
                        )}
                      </div>
                      {/* Day / Date Meta */}
                      <div className="flex items-center gap-2.5 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                        <span>Season {tx.seasonYear} • Day {tx.gameDay}</span>
                        <span className="hidden sm:inline text-zinc-700">•</span>
                        <span className="text-[10px] lowercase text-zinc-600 font-semibold">{formattedDate}</span>
                      </div>
                    </div>

                    {/* Details content */}
                    <p className="text-zinc-200 text-sm leading-relaxed font-semibold">
                      {cleanDescription}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
