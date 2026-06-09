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
} from "lucide-react";

interface Transaction {
  id: string;
  type: "Trade" | "Signing" | "Release";
  description: string;
  seasonYear: number;
  gameDay: number;
  createdAt: Date;
}

export default function TransactionsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // Helper for type badges
  const getBadgeConfig = (type: "Trade" | "Signing" | "Release") => {
    switch (type) {
      case "Signing":
        return {
          bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          label: "Signing",
          icon: UserPlus,
        };
      case "Release":
        return {
          bg: "bg-red-500/10 text-red-400 border-red-500/20",
          label: "Waiver",
          icon: UserMinus,
        };
      case "Trade":
        return {
          bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          label: "Trade",
          icon: ArrowLeftRight,
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
    <div className="space-y-8 relative">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-orange-500/10 rounded-2xl text-orange-500">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">League News & Logs</h3>
            <p className="text-zinc-500 text-sm font-semibold tracking-wide">
              Official front-office movements, roster trades, and waiver wire transactions
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
      ) : transactions.length === 0 ? (
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-900 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-2xl">
          <Calendar className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h4 className="text-lg font-bold text-zinc-200">No Transaction History</h4>
          <p className="text-zinc-500 text-xs mt-2 max-w-xs mx-auto">
            Roster signings, waiver releases, and team trade activities will be logged here once they occur.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm max-w-4xl mx-auto">
          {/* Feed Timeline */}
          <div className="relative border-l border-zinc-805 ml-3 md:ml-6 space-y-8 py-2">
            {transactions.map((tx) => {
              const { bg, label, icon: Icon } = getBadgeConfig(tx.type);
              const formattedDate = new Date(tx.createdAt).toLocaleDateString("en-PH", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div key={tx.id} className="relative pl-8 group">
                  {/* Timeline point */}
                  <span className={`absolute -left-[18px] top-1.5 p-1.5 rounded-full border bg-zinc-950 transition-transform duration-200 group-hover:scale-110 ${bg}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>

                  <div className="bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 rounded-2xl p-5 transition-all shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      {/* Badge and Title */}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border self-start ${bg}`}>
                        {label}
                      </span>
                      {/* Day / Date Meta */}
                      <div className="flex items-center gap-2.5 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                        <span>Season {tx.seasonYear} • Day {tx.gameDay}</span>
                        <span className="hidden sm:inline text-zinc-700">•</span>
                        <span className="text-[10px] lowercase text-zinc-600 font-semibold">{formattedDate}</span>
                      </div>
                    </div>

                    {/* Details content */}
                    <p className="text-zinc-200 text-sm leading-relaxed font-semibold">
                      {tx.description}
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
