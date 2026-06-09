"use client";

import { useEffect, useState } from "react";
import { getLeagueLeadersAction, LeaderCategory } from "@/app/actions/leadersEngine";
import { useGameStore } from "@/store/useGameStore";
import React from "react";

export default function LeadersPage() {
  const { userTeamId } = useGameStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seasonYear, setSeasonYear] = useState(0);
  const [categories, setCategories] = useState<LeaderCategory[]>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    async function load() {
      try {
        const res = await getLeagueLeadersAction();
        if (res.success) {
          setSeasonYear(res.seasonYear);
          setCategories(res.categories);
          setPlayerCount(res.playerCount);
        } else {
          setError(res.error ?? "Failed to load leaders.");
        }
      } catch (err: any) {
        setError(err.message ?? "Unexpected error.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [mounted]);

  const fmt = (v: number, format: "decimal" | "pct") =>
    format === "pct" ? `${Math.round(v)}%` : v.toFixed(1);

  if (!mounted || loading) {
    return (
      <div className="ll-loading">
        <div className="ll-spinner" />
        <p>Loading league leaders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ll-empty">
        <div className="ll-empty-icon">⚠️</div>
        <h2 className="ll-empty-title">Error</h2>
        <p className="ll-empty-desc">{error}</p>
      </div>
    );
  }

  return (
    <div className="ll-root">
      {/* Header */}
      <header className="ll-header">
        <div className="ll-header-inner">
          <span className="ll-hdr-icon">📊</span>
          <div>
            <h1 className="ll-title">League Leaders</h1>
            <p className="ll-subtitle">
              {seasonYear > 0 ? `Season ${seasonYear} · ` : ""}Regular Season · {playerCount} Qualified Players (min. 10 GP)
            </p>
          </div>
        </div>
      </header>

      {categories.length === 0 || categories.every((c) => c.leaders.length === 0) ? (
        <div className="ll-empty">
          <div className="ll-empty-icon">📭</div>
          <h2 className="ll-empty-title">No Stats Available Yet</h2>
          <p className="ll-empty-desc">Play at least 10 regular season games to populate the leaderboards.</p>
        </div>
      ) : (
        <div className="ll-grid-outer">
          {categories.map((cat) => (
            <div key={cat.key} className="ll-cat-card" style={{ "--cat-color": cat.color } as React.CSSProperties}>
              <div className="ll-cat-header">
                <span className="ll-cat-icon">{cat.emoji}</span>
                <span className="ll-cat-label">{cat.label}</span>
              </div>

              {cat.leaders.length === 0 ? (
                <p className="ll-no-data">Not enough data yet</p>
              ) : (
                <ol className="ll-list">
                  {cat.leaders.map((entry) => {
                    const isMyTeam = entry.teamId === userTeamId;
                    return (
                      <li
                        key={entry.playerId}
                        className={`ll-entry ${isMyTeam ? "ll-entry--myteam" : ""}`}
                        data-rank={entry.rank}
                      >
                        <span className="ll-rank">{entry.rank}</span>
                        <div className="ll-player-info">
                          <span className="ll-player-name">{entry.playerName}</span>
                          <span className="ll-team-name">{entry.teamName}</span>
                        </div>
                        <span className="ll-value">{fmt(entry.value, cat.format)}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .ll-root { min-height: 100vh; background: #0d0f14; font-family: 'Inter','Outfit',sans-serif; color: #e2e8f0; padding-bottom: 4rem; }
        .ll-loading { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 6rem 1rem; color: #64748b; }
        .ll-spinner { width: 40px; height: 40px; border: 3px solid rgba(249,115,22,.2); border-top-color: #f97316; border-radius: 50%; animation: llspin .7s linear infinite; }
        @keyframes llspin { to { transform: rotate(360deg); } }
        .ll-header { background: linear-gradient(135deg, #181c28 0%, #0d1526 100%); border-bottom: 1px solid rgba(249,115,22,0.15); padding: 2rem 2.5rem; margin-bottom: 2rem; }
        .ll-header-inner { max-width: 1300px; margin: 0 auto; display: flex; align-items: center; gap: 1.25rem; }
        .ll-hdr-icon { font-size: 2.8rem; filter: drop-shadow(0 0 10px rgba(249,115,22,.4)); }
        .ll-title { margin: 0 0 .25rem; font-size: 2rem; font-weight: 800; background: linear-gradient(90deg, #f97316, #fbbf24); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .ll-subtitle { margin: 0; color: #64748b; font-size: .88rem; }
        .ll-empty { max-width: 440px; margin: 6rem auto; text-align: center; }
        .ll-empty-icon { font-size: 4rem; margin-bottom: 1rem; }
        .ll-empty-title { color: #94a3b8; font-size: 1.3rem; margin: 0 0 .5rem; }
        .ll-empty-desc { color: #475569; font-size: .9rem; line-height: 1.6; }
        .ll-no-data { color: #475569; font-size: .85rem; padding: .5rem 1rem; }
        .ll-grid-outer { max-width: 1300px; margin: 0 auto; padding: 0 2.5rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem; }
        .ll-cat-card { background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.07); border-top: 3px solid var(--cat-color, #f97316); border-radius: 1rem; overflow: hidden; }
        .ll-cat-header { display: flex; align-items: center; gap: .6rem; padding: .9rem 1rem; background: rgba(255,255,255,.025); border-bottom: 1px solid rgba(255,255,255,.06); }
        .ll-cat-icon { font-size: 1.3rem; line-height: 1; }
        .ll-cat-label { font-size: .75rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: var(--cat-color, #f97316); }
        .ll-list { list-style: none; margin: 0; padding: 0; }
        .ll-entry { display: flex; align-items: center; gap: .75rem; padding: .6rem 1rem; border-bottom: 1px solid rgba(255,255,255,.04); transition: background .12s; }
        .ll-entry:last-child { border-bottom: none; }
        .ll-entry:hover { background: rgba(255,255,255,.04); }
        .ll-entry--myteam { background: rgba(249,115,22,.07) !important; border-left: 2px solid rgba(249,115,22,.5); }
        .ll-rank { font-size: .8rem; font-weight: 800; color: #64748b; min-width: 1.4rem; text-align: center; }
        .ll-entry[data-rank="1"] .ll-rank { color: #FFD700; }
        .ll-entry[data-rank="2"] .ll-rank { color: #C0C0C0; }
        .ll-entry[data-rank="3"] .ll-rank { color: #CD7F32; }
        .ll-player-info { flex: 1; display: flex; flex-direction: column; gap: .05rem; min-width: 0; }
        .ll-player-name { font-size: .88rem; font-weight: 700; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ll-team-name { font-size: .7rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ll-value { font-size: .95rem; font-weight: 800; color: var(--cat-color, #f97316); min-width: 3rem; text-align: right; }
        @media (max-width: 640px) { .ll-header { padding: 1.25rem 1rem; } .ll-title { font-size: 1.4rem; } .ll-grid-outer { padding: 0 1rem; grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
