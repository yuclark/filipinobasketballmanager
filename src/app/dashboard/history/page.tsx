"use client";

import { useEffect, useState } from "react";
import { getLeagueHistoryAction } from "@/app/actions/awardsEngine";
import { BookOpen, Trophy, Loader2, Star, Shield, Award, Calendar } from "lucide-react";
import React from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type SeasonData = {
  year: number;
  champion: {
    championTeam: string;
    runnerUpTeam: string;
    finalsMvp: string;
    finalsMvpTeam: string;
    seriesScore: string;
  } | null;
  awards: { type: string; playerName: string; teamName: string; position: string }[];
  allLeagueTeams: { type: string; members: { position: string; playerName: string }[] }[];
};

const AWARD_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  MVP:     { label: "Most Valuable Player",     bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  ROY:     { label: "Rookie of the Year",       bg: "bg-cyan-500/10",  text: "text-cyan-400",  border: "border-cyan-500/20" },
  DPOY:    { label: "Defensive Player of Year", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  "6MOTY": { label: "Sixth Man of the Year",    bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
};

const TIER_COLORS: Record<string, string> = {
  "All-League 1st":  "text-amber-400",
  "All-League 2nd":  "text-zinc-400",
  "All-League 3rd":  "text-orange-400/80",
  "All-Defensive":   "text-emerald-400",
};

export default function HistoryPage() {
  const [seasons, setSeasons] = useState<SeasonData[]>([]);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result = await getLeagueHistoryAction();
        if (result.success) {
          setSeasons(result.seasons as SeasonData[]);
        } else {
          setError(result.error || "Failed to load league history.");
        }
      } catch (err: any) {
        setError(err.message || "Unexpected error.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-zinc-500 text-sm font-semibold">Loading league archive...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p className="mb-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="border-b border-[var(--color-border)] pb-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">League History Hub</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          Historical archive of FBM Philippine Champions, Individual Trophy Winners, and All-League honorees.
        </p>
      </div>

      {seasons.length === 0 ? (
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-900 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-2xl">
          <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h4 className="text-lg font-bold text-zinc-200">No History Recorded Yet</h4>
          <p className="text-zinc-500 text-xs mt-2 max-w-xs mx-auto">
            Complete the postseason tournament and crown a champion to begin populating the league history archive.
          </p>
        </div>
      ) : (
        /* History Table */
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--color-text-faint)]">Season</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--color-text-faint)]">Champion</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--color-text-faint)]">Finals MVP</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--color-text-faint)]">MVP</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--color-text-faint)]">DPOY</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--color-text-faint)]">6MOY</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--color-text-faint)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((season) => {
                  const championName = season.champion?.championTeam ?? '—';
                  const finalsMvpName = season.champion?.finalsMvp ?? '—';
                  const mvpName = season.awards.find(a => a.type === "MVP")?.playerName ?? '—';
                  const dpoyName = season.awards.find(a => a.type === "DPOY")?.playerName ?? '—';
                  const smoyName = season.awards.find(a => a.type === "6MOTY")?.playerName ?? '—';
                  const status = season.champion ? 'POSTSEASON COMPLETED' : 'IN PROGRESS';

                  const firstTeam = season.allLeagueTeams.find(t => t.type === "All-League 1st")?.members ?? [];
                  const secondTeam = season.allLeagueTeams.find(t => t.type === "All-League 2nd")?.members ?? [];
                  const thirdTeam = season.allLeagueTeams.find(t => t.type === "All-League 3rd")?.members ?? [];
                  const defensiveTeam = season.allLeagueTeams.find(t => t.type === "All-Defensive")?.members ?? [];

                  return (
                    <React.Fragment key={season.year}>
                      <tr
                        className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)] transition-colors duration-100 cursor-pointer"
                        onClick={() => setExpandedSeason(expandedSeason === season.year ? null : season.year)}
                      >
                        <td className="px-4 py-3 text-[13px] font-bold font-display text-[var(--color-primary)]">
                          {season.year}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[13px] font-semibold text-[var(--color-text)]">{championName}</span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[var(--color-text-muted)]">{finalsMvpName}</td>
                        <td className="px-4 py-3 text-[13px] text-[var(--color-text-muted)]">{mvpName}</td>
                        <td className="px-4 py-3 text-[13px] text-[var(--color-text-muted)]">{dpoyName}</td>
                        <td className="px-4 py-3 text-[13px] text-[var(--color-text-muted)]">{smoyName}</td>
                        <td className="px-4 py-3">
                          {status === 'POSTSEASON COMPLETED' ? (
                            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded border border-[var(--color-border-strong)] text-[var(--color-text-muted)]">
                              Completed
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded border border-orange-500/30 text-[var(--color-primary)] bg-[var(--color-primary-dim)]">
                              In Progress
                            </span>
                          )}
                        </td>
                      </tr>
                      {expandedSeason === season.year && (
                        <tr className="bg-[var(--color-surface-2)]">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                              <div>
                                <p className="text-[10px] font-bold tracking-wider uppercase text-[var(--color-text-faint)] mb-2">All-League 1st Team</p>
                                <div className="flex flex-col gap-1.5">
                                  {firstTeam.length > 0 ? firstTeam.map((m, i) => (
                                    <div key={i} className="flex justify-between text-[11px] text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-1 last:border-0">
                                      <span className="font-medium text-[var(--color-text)]">{m.playerName}</span>
                                      <span className="text-[var(--color-text-faint)]">{m.position}</span>
                                    </div>
                                  )) : <span className="text-[11px] text-[var(--color-text-faint)]">None selected</span>}
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold tracking-wider uppercase text-[var(--color-text-faint)] mb-2">All-League 2nd Team</p>
                                <div className="flex flex-col gap-1.5">
                                  {secondTeam.length > 0 ? secondTeam.map((m, i) => (
                                    <div key={i} className="flex justify-between text-[11px] text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-1 last:border-0">
                                      <span className="font-medium text-[var(--color-text)]">{m.playerName}</span>
                                      <span className="text-[var(--color-text-faint)]">{m.position}</span>
                                    </div>
                                  )) : <span className="text-[11px] text-[var(--color-text-faint)]">None selected</span>}
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold tracking-wider uppercase text-[var(--color-text-faint)] mb-2">All-League 3rd Team</p>
                                <div className="flex flex-col gap-1.5">
                                  {thirdTeam.length > 0 ? thirdTeam.map((m, i) => (
                                    <div key={i} className="flex justify-between text-[11px] text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-1 last:border-0">
                                      <span className="font-medium text-[var(--color-text)]">{m.playerName}</span>
                                      <span className="text-[var(--color-text-faint)]">{m.position}</span>
                                    </div>
                                  )) : <span className="text-[11px] text-[var(--color-text-faint)]">None selected</span>}
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold tracking-wider uppercase text-[var(--color-text-faint)] mb-2">All-Defensive Team</p>
                                <div className="flex flex-col gap-1.5">
                                  {defensiveTeam.length > 0 ? defensiveTeam.map((m, i) => (
                                    <div key={i} className="flex justify-between text-[11px] text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-1 last:border-0">
                                      <span className="font-medium text-[var(--color-text)]">{m.playerName}</span>
                                      <span className="text-[var(--color-text-faint)]">{m.position}</span>
                                    </div>
                                  )) : <span className="text-[11px] text-[var(--color-text-faint)]">None selected</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
