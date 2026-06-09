"use client";

import { useEffect, useState } from "react";
import { getLeagueHistoryAction } from "@/app/actions/awardsEngine";
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

const AWARD_META: Record<string, { label: string; icon: string; color: string }> = {
  MVP:     { label: "Most Valuable Player",       icon: "🏆", color: "#FFD700" },
  ROY:     { label: "Rookie of the Year",         icon: "🌟", color: "#00E5FF" },
  DPOY:    { label: "Defensive Player of Year",   icon: "🛡️",  color: "#76FF03" },
  "6MOTY": { label: "Sixth Man of the Year",      icon: "🔥", color: "#FF6D00" },
};

const TIER_COLORS: Record<string, string> = {
  "All-League 1st":  "#FFD700",
  "All-League 2nd":  "#C0C0C0",
  "All-League 3rd":  "#CD7F32",
  "All-Defensive":   "#76FF03",
};

export default function HistoryPage() {
  const [seasons, setSeasons] = useState<SeasonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await getLeagueHistoryAction();
        if (result.success) {
          setSeasons(result.seasons as SeasonData[]);
        } else {
          setError("Failed to load league history.");
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
      <div className="hp-loading">
        <div className="hp-spinner" />
        <p>Loading league archive...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hp-empty">
        <div className="hp-empty-icon">⚠️</div>
        <h2 className="hp-empty-title">Error Loading History</h2>
        <p className="hp-empty-desc">{error}</p>
      </div>
    );
  }

  return (
    <div className="hp-root">
      {/* ── Page Header ── */}
      <header className="hp-header">
        <div className="hp-header-inner">
          <span className="hp-header-icon">🏆</span>
          <div>
            <h1 className="hp-title">League History Hub</h1>
            <p className="hp-subtitle">Champions · Award Winners · All-League Honorees</p>
          </div>
        </div>
      </header>

      {/* ── Empty State ── */}
      {seasons.length === 0 ? (
        <div className="hp-empty">
          <div className="hp-empty-icon">📋</div>
          <h2 className="hp-empty-title">No History Yet</h2>
          <p className="hp-empty-desc">Complete a full season to populate the archive.</p>
        </div>
      ) : (
        <div className="hp-seasons">
          {seasons.map((season) => (
            <section key={season.year} className="hp-card">
              {/* Season Banner */}
              <div className="hp-card-banner">
                <span className="hp-card-banner-label">Season</span>
                <span className="hp-card-banner-year">{season.year}</span>
              </div>

              <div className="hp-card-body">
                {/* ── 1. Championship Frame ── */}
                {season.champion ? (
                  <div className="hp-champion">
                    <div className="hp-champion-crown">👑</div>
                    <div className="hp-champion-detail">
                      <p className="hp-champion-eyebrow">PBA Philippines Champion</p>
                      <h2 className="hp-champion-name">{season.champion.championTeam}</h2>
                      <p className="hp-champion-series">
                        defeated&nbsp;
                        <span className="hp-runnerup">{season.champion.runnerUpTeam}</span>
                        &nbsp;
                        <span className="hp-series-score">{season.champion.seriesScore}</span>
                      </p>
                      <div className="hp-finals-mvp-pill">
                        <span className="hp-fmvp-label">Finals MVP</span>
                        <strong className="hp-fmvp-name">{season.champion.finalsMvp}</strong>
                        {season.champion.finalsMvpTeam && (
                          <span className="hp-fmvp-team">{season.champion.finalsMvpTeam}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="hp-champion hp-champion--pending">
                    <div className="hp-champion-crown">⏳</div>
                    <p className="hp-champion-eyebrow">Grand Finals not yet completed</p>
                  </div>
                )}

                {/* ── 2. Individual Award Grid ── */}
                {season.awards.length > 0 && (
                  <div className="hp-section">
                    <h3 className="hp-section-label">Individual Awards</h3>
                    <div className="hp-awards-grid">
                      {season.awards.map((award) => {
                        const meta = AWARD_META[award.type] ?? { label: award.type, icon: "🏅", color: "#888" };
                        return (
                          <div
                            key={award.type}
                            className="hp-award-card"
                            style={{ "--aw-color": meta.color } as React.CSSProperties}
                          >
                            <div className="hp-award-icon">{meta.icon}</div>
                            <div className="hp-award-body">
                              <p className="hp-award-label">{meta.label}</p>
                              <p className="hp-award-player">{award.playerName}</p>
                              <p className="hp-award-team">{award.teamName}</p>
                              {award.position && (
                                <span className="hp-award-pos">{award.position}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── 3. All-League Roster Tables ── */}
                {season.allLeagueTeams.length > 0 && (
                  <div className="hp-section">
                    <h3 className="hp-section-label">All-League & Defensive Teams</h3>
                    <div className="hp-allleague-grid">
                      {season.allLeagueTeams.map((tier) => (
                        <div key={tier.type} className="hp-tier">
                          <div
                            className="hp-tier-label"
                            style={{ color: TIER_COLORS[tier.type] ?? "#aaa" }}
                          >
                            {tier.type} Team
                          </div>
                          <div className="hp-tier-members">
                            {tier.members.map((m, i) => (
                              <div key={i} className="hp-tier-member">
                                <span className="hp-pos-badge">{m.position}</span>
                                <span className="hp-member-name">{m.playerName}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <style>{`
        .hp-root {
          min-height: 100vh;
          background: #0d0f14;
          font-family: 'Inter', 'Outfit', sans-serif;
          color: #e2e8f0;
          padding-bottom: 4rem;
        }
        .hp-loading {
          display: flex; flex-direction: column; align-items: center;
          gap: 1rem; padding: 6rem 1rem; color: #64748b;
        }
        .hp-spinner {
          width: 40px; height: 40px;
          border: 3px solid rgba(255,215,0,.2);
          border-top-color: #FFD700;
          border-radius: 50%;
          animation: hpspin .7s linear infinite;
        }
        @keyframes hpspin { to { transform: rotate(360deg); } }
        .hp-header {
          background: linear-gradient(135deg, #181c28 0%, #0d1526 100%);
          border-bottom: 1px solid rgba(255,215,0,0.15);
          padding: 2rem 2.5rem;
          margin-bottom: 2rem;
        }
        .hp-header-inner { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; gap: 1.25rem; }
        .hp-header-icon { font-size: 3rem; filter: drop-shadow(0 0 14px rgba(255,215,0,.5)); }
        .hp-title {
          margin: 0 0 .25rem; font-size: 2rem; font-weight: 800;
          background: linear-gradient(90deg, #FFD700, #FFA500);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .hp-subtitle { margin: 0; color: #64748b; font-size: .88rem; letter-spacing: .04em; }
        .hp-empty { max-width: 460px; margin: 7rem auto; text-align: center; }
        .hp-empty-icon { font-size: 4rem; margin-bottom: 1rem; }
        .hp-empty-title { color: #94a3b8; font-size: 1.4rem; margin: 0 0 .5rem; }
        .hp-empty-desc { color: #475569; font-size: .92rem; line-height: 1.6; }
        .hp-seasons { max-width: 1100px; margin: 0 auto; padding: 0 2.5rem; display: flex; flex-direction: column; gap: 2.5rem; }
        .hp-card { border-radius: 1.25rem; border: 1px solid rgba(255,255,255,.07); background: rgba(255,255,255,.025); overflow: hidden; transition: box-shadow .2s; }
        .hp-card:hover { box-shadow: 0 0 50px rgba(255,215,0,.05); }
        .hp-card-banner { display: flex; align-items: baseline; gap: .75rem; background: linear-gradient(90deg,#1e2537 0%,#141824 100%); border-bottom: 1px solid rgba(255,215,0,.12); padding: .9rem 1.5rem; }
        .hp-card-banner-label { font-size: .72rem; text-transform: uppercase; letter-spacing: .1em; color: #94a3b8; font-weight: 700; }
        .hp-card-banner-year { font-size: 1.6rem; font-weight: 800; color: #FFD700; letter-spacing: -.02em; }
        .hp-card-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.75rem; }
        .hp-champion { display: flex; align-items: center; gap: 1.5rem; background: linear-gradient(135deg, rgba(255,215,0,.09) 0%, rgba(255,215,0,.02) 100%); border: 1px solid rgba(255,215,0,.22); border-radius: 1rem; padding: 1.25rem 1.5rem; }
        .hp-champion--pending { opacity: .5; background: rgba(255,255,255,.02); border-color: rgba(255,255,255,.07); }
        .hp-champion-crown { font-size: 3rem; flex-shrink: 0; filter: drop-shadow(0 0 10px rgba(255,215,0,.4)); }
        .hp-champion-eyebrow { margin: 0 0 .2rem; font-size: .7rem; text-transform: uppercase; letter-spacing: .1em; color: #FFD700; font-weight: 700; opacity: .8; }
        .hp-champion-name { margin: 0 0 .25rem; font-size: 1.65rem; font-weight: 800; color: #f8fafc; }
        .hp-champion-series { margin: 0 0 .6rem; color: #94a3b8; font-size: .9rem; }
        .hp-runnerup { color: #cbd5e1; }
        .hp-series-score { color: #FFD700; font-weight: 700; }
        .hp-finals-mvp-pill { display: inline-flex; align-items: center; gap: .5rem; background: rgba(255,215,0,.12); border: 1px solid rgba(255,215,0,.28); border-radius: 100px; padding: .28rem .85rem; font-size: .8rem; flex-wrap: wrap; }
        .hp-fmvp-label { color: #78716c; }
        .hp-fmvp-name { color: #fbbf24; font-weight: 700; }
        .hp-fmvp-team { color: #64748b; font-size: .72rem; }
        .hp-section { }
        .hp-section-label { margin: 0 0 .85rem; font-size: .7rem; text-transform: uppercase; letter-spacing: .12em; color: #64748b; font-weight: 700; }
        .hp-awards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: .85rem; }
        .hp-award-card { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); border-left: 3px solid var(--aw-color, #888); border-radius: .75rem; padding: .9rem 1rem; display: flex; align-items: flex-start; gap: .65rem; transition: background .15s, transform .15s; }
        .hp-award-card:hover { background: rgba(255,255,255,.055); transform: translateY(-2px); }
        .hp-award-icon { font-size: 1.6rem; flex-shrink: 0; line-height: 1; margin-top: .05rem; }
        .hp-award-body { display: flex; flex-direction: column; gap: .15rem; }
        .hp-award-label { margin: 0; font-size: .63rem; text-transform: uppercase; letter-spacing: .1em; color: var(--aw-color, #888); font-weight: 700; line-height: 1; }
        .hp-award-player { margin: 0; font-size: .95rem; font-weight: 700; color: #f1f5f9; line-height: 1.2; }
        .hp-award-team { margin: 0; font-size: .75rem; color: #64748b; }
        .hp-award-pos { margin-top: .2rem; display: inline-block; background: rgba(255,255,255,.07); border-radius: 4px; padding: .08rem .35rem; font-size: .6rem; color: #94a3b8; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
        .hp-allleague-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
        .hp-tier { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); border-radius: .85rem; padding: .9rem 1rem; }
        .hp-tier-label { font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; margin-bottom: .6rem; }
        .hp-tier-members { display: flex; flex-direction: column; gap: .35rem; }
        .hp-tier-member { display: flex; align-items: center; gap: .5rem; }
        .hp-pos-badge { background: rgba(255,255,255,.08); border-radius: 4px; padding: .08rem .35rem; font-size: .62rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; min-width: 1.8rem; text-align: center; }
        .hp-member-name { font-size: .85rem; color: #cbd5e1; font-weight: 500; }
        @media (max-width: 640px) {
          .hp-header { padding: 1.25rem 1rem; } .hp-title { font-size: 1.4rem; }
          .hp-seasons { padding: 0 1rem; } .hp-card-body { padding: 1rem; }
          .hp-champion { flex-direction: column; align-items: flex-start; gap: .75rem; }
          .hp-awards-grid { grid-template-columns: 1fr 1fr; } .hp-allleague-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  );
}
