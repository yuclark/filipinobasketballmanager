"use client";

import { useEffect, useState, useMemo } from "react";
import { getDraftProspectsAction, Prospect } from "@/app/actions/prospectsEngine";
import { getPlayoffBracketAction } from "@/app/actions/playoffEngine";
import { GraduationCap, Search, Loader2, Sparkles, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import React from "react";

const POS_CLASSES: Record<string, string> = {
  PG: "G", SG: "G", SF: "F", PF: "F", C: "C",
};

const ATTRIBUTE_LABELS = {
  threePoint: "3PT",
  insideScoring: "INS",
  perimeterDefense: "DEF",
  rebounding: "REB",
};

export default function ProspectsPage() {
  const [mounted, setMounted] = useState(false);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<"All" | "G" | "F" | "C">("All");
  const [inDraftPhase, setInDraftPhase] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // 1. Check if we are in Phase 4 of the Offseason Wizard
        const saved = localStorage.getItem("filipino-basketball-manager-offseason-wizard");
        if (saved) {
          const loaded = JSON.parse(saved);
          if (loaded.currentPhase === 4) {
            const bracketRes = await getPlayoffBracketAction();
            if (bracketRes.success && bracketRes.bracket) {
              const gfSeries = bracketRes.bracket.find((n: any) => n.round === "GrandFinals");
              const clinched = gfSeries && gfSeries.status === "Completed";
              if (clinched) {
                setInDraftPhase(true);
                setLoading(false);
                return;
              }
            }
          }
        }

        // 2. Otherwise load the draft prospects pool
        const res = await getDraftProspectsAction();
        if (res.success) {
          setProspects(res.prospects);
        } else {
          setError(res.error ?? "Failed to load prospects.");
        }
      } catch (err: any) {
        setError(err.message ?? "Unexpected error.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [mounted]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return prospects.filter((p) => {
      const nameMatch = q === "" || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || p.hometown.toLowerCase().includes(q);
      const posMatch = posFilter === "All" || POS_CLASSES[p.position] === posFilter;
      return nameMatch && posMatch;
    });
  }, [prospects, search, posFilter]);

  const getOvrBadgeClass = (overall: number) => {
    if (overall >= 82) return "bg-orange-500/10 text-orange-400 border border-orange-500/30";
    if (overall >= 75) return "bg-purple-500/10 text-purple-400 border border-purple-500/30";
    if (overall >= 68) return "bg-blue-500/10 text-blue-400 border border-blue-500/30";
    return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/30";
  };

  const renderStatBar = (label: string, val: number, colorClass: string) => {
    return (
      <div className="flex items-center justify-between text-xs gap-3">
        <span className="font-bold text-zinc-500 w-8">{label}</span>
        <div className="flex-1 bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-900">
          <div
            className={`h-full rounded-full ${colorClass}`}
            style={{ width: `${(val / 99) * 100}%` }}
          />
        </div>
        <span className="font-bold text-zinc-300 w-6 text-right">{val}</span>
      </div>
    );
  };

  if (!mounted || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-zinc-500 text-sm font-semibold">Loading scouting board...</p>
      </div>
    );
  }

  // Active Draft Redirect Notice
  if (inDraftPhase) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <GraduationCap className="w-48 h-48" />
          </div>
          
          <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-orange-500/25">
            <AlertCircle className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-bold text-white mb-2">Draft actively in progress</h3>
          <p className="text-zinc-400 text-sm font-medium leading-relaxed mb-8">
            The FBM Rookie Draft is currently underway. Please head to the Offseason Hub to inspect the board and make selections.
          </p>

          <Link
            href="/dashboard/offseason"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg hover:shadow-orange-500/10 transition-all text-sm"
          >
            <span>Go to Offseason Hub</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-orange-500/10 rounded-2xl text-orange-500">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">Draft Prospect Board</h3>
            <p className="text-zinc-500 text-sm font-semibold tracking-wide">
              Scouting and evaluations of the upcoming rookie class
            </p>
          </div>
        </div>

        <div className="text-zinc-400 text-sm font-bold bg-zinc-950 px-4 py-2 rounded-xl border border-zinc-900">
          Total Pool: <span className="text-orange-500">{prospects.length} Rookies</span>
        </div>
      </div>

      {error ? (
        <div className="text-center py-12 text-zinc-500">
          <p className="mb-4">{error}</p>
        </div>
      ) : prospects.length === 0 ? (
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-900 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-2xl">
          <GraduationCap className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h4 className="text-lg font-bold text-zinc-200">No Prospects Available</h4>
          <p className="text-zinc-500 text-xs mt-2 max-w-xs mx-auto">
            The next generation of local and Fil-Am prospects will be generated when a new season initializes.
          </p>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Position Tabs */}
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-900 self-start sm:self-auto">
              {(["All", "G", "F", "C"] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(pos)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer ${
                    posFilter === pos
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {pos === "All" ? "All Positions" : pos === "G" ? "Guards" : pos === "F" ? "Forwards" : "Centers"}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search name or hometown..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">No prospects match your search criteria.</div>
          ) : (
            /* Prospects Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((p, idx) => (
                <div key={p.id} className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700/80 rounded-2xl overflow-hidden transition-all shadow-md relative group">
                  {/* Top Header Card */}
                  <div className="flex items-start justify-between gap-4 p-5 bg-zinc-950/40 border-b border-zinc-900/60">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-900 font-bold text-xs text-zinc-500">
                        #{idx + 1}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-white text-base leading-tight">
                          {p.firstName} {p.lastName}
                        </h4>
                        <span className="text-zinc-500 text-xs font-semibold mt-1 block">
                          {p.position} · Age {p.age} · {p.hometown}
                        </span>
                        {p.isFilAm && (
                          <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 tracking-wider">
                            <Sparkles className="w-2.5 h-2.5" />
                            Fil-Am
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <span className={`px-2.5 py-1 text-xs font-extrabold rounded-lg border ${getOvrBadgeClass(p.overall)}`}>
                      OVR {p.overall}
                    </span>
                  </div>

                  {/* Attributes Bars */}
                  <div className="p-5 space-y-3">
                    {renderStatBar("3PT", p.threePoint, "bg-sky-500")}
                    {renderStatBar("INS", p.insideScoring, "bg-orange-500")}
                    {renderStatBar("DEF", Math.round((p.perimeterDefense + p.interiorDefense) / 2), "bg-emerald-500")}
                    {renderStatBar("REB", p.rebounding, "bg-purple-500")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
