"use client";

import { useEffect, useState, useMemo } from "react";
import { getDraftProspectsAction, Prospect } from "@/app/actions/prospectsEngine";
import React from "react";

const POS_CLASSES: Record<string, string> = {
  PG: "G", SG: "G", SF: "F", PF: "F", C: "C",
};

const BAR_COLORS: Record<string, string> = {
  "3PT": "#40C4FF",
  "INS": "#FF6D00",
  "DEF": "#76FF03",
  "REB": "#E040FB",
};

function RatingBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, (value / 99) * 100);
  return (
    <div className="ps-bar-row">
      <span className="ps-bar-label">{label}</span>
      <div className="ps-bar-track">
        <div
          className="ps-bar-fill"
          style={{ width: `${pct}%`, background: BAR_COLORS[label] ?? "#f97316" }}
        />
      </div>
      <span className="ps-bar-val">{value}</span>
    </div>
  );
}

function OvrBadge({ ovr }: { ovr: number }) {
  const tier = ovr >= 85 ? "elite" : ovr >= 78 ? "good" : ovr >= 70 ? "avg" : "low";
  return <span className={`ps-ovr ps-ovr--${tier}`}>{ovr}</span>;
}

export default function ProspectsPage() {
  const [mounted, setMounted] = useState(false);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<"All" | "G" | "F" | "C">("All");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    async function load() {
      try {
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
    load();
  }, [mounted]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return prospects.filter((p) => {
      const nameMatch = q === "" || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || p.hometown.toLowerCase().includes(q);
      const posMatch = posFilter === "All" || POS_CLASSES[p.position] === posFilter;
      return nameMatch && posMatch;
    });
  }, [prospects, search, posFilter]);

  if (!mounted || loading) {
    return (
      <div className="ps-loading">
        <div className="ps-spinner" />
        <p>Loading scouting reports...</p>
      </div>
    );
  }

  return (
    <div className="ps-root">
      {/* Header */}
      <header className="ps-header">
        <div className="ps-header-inner">
          <span className="ps-hdr-icon">🎓</span>
          <div>
            <h1 className="ps-title">Draft Prospect Board</h1>
            <p className="ps-subtitle">Upcoming Rookie Class · Scouting Intelligence</p>
          </div>
        </div>
      </header>

      {error ? (
        <div className="ps-empty">
          <div className="ps-empty-icon">⚠️</div>
          <h2 className="ps-empty-title">Error Loading Prospects</h2>
          <p className="ps-empty-desc">{error}</p>
        </div>
      ) : prospects.length === 0 ? (
        <div className="ps-empty">
          <div className="ps-empty-icon">🔭</div>
          <h2 className="ps-empty-title">Scouting Reports Pending</h2>
          <p className="ps-empty-desc">
            The next generation of local and Fil-Am prospects will be unveiled prior to the offseason draft sequence.
          </p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="ps-filters">
            <div className="ps-search-wrap">
              <span className="ps-search-icon">🔍</span>
              <input
                className="ps-search"
                type="text"
                placeholder="Search by name or hometown..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="ps-pos-tabs">
              {(["All", "G", "F", "C"] as const).map((pos) => (
                <button
                  key={pos}
                  className={`ps-pos-tab ${posFilter === pos ? "ps-pos-tab--active" : ""}`}
                  onClick={() => setPosFilter(pos)}
                >
                  {pos === "All" ? "All Positions" : pos === "G" ? "Guards" : pos === "F" ? "Forwards" : "Centers"}
                </button>
              ))}
            </div>
            <span className="ps-count">{filtered.length} prospect{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {filtered.length === 0 ? (
            <div className="ps-no-match">No prospects match your filters.</div>
          ) : (
            <div className="ps-grid">
              {filtered.map((p, idx) => (
                <div key={p.id} className="ps-card">
                  <div className="ps-card-top">
                    <div className="ps-card-meta">
                      <span className="ps-draft-pick">#{idx + 1}</span>
                      <div className="ps-name-block">
                        <span className="ps-name">
                          {p.firstName} {p.lastName}
                          {p.isFilAm && <span className="ps-filam-badge">🇵🇭 Fil-Am</span>}
                        </span>
                        <span className="ps-sub">{p.position} · Age {p.age} · {p.hometown}</span>
                      </div>
                    </div>
                    <OvrBadge ovr={p.overall} />
                  </div>
                  <div className="ps-bars">
                    <RatingBar label="3PT" value={p.threePoint} />
                    <RatingBar label="INS" value={p.insideScoring} />
                    <RatingBar label="DEF" value={Math.round((p.perimeterDefense + p.interiorDefense) / 2)} />
                    <RatingBar label="REB" value={p.rebounding} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <style>{`
        .ps-root { min-height: 100vh; background: #0d0f14; font-family: 'Inter','Outfit',sans-serif; color: #e2e8f0; padding-bottom: 4rem; }
        .ps-loading { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 6rem 1rem; color: #64748b; }
        .ps-spinner { width: 40px; height: 40px; border: 3px solid rgba(0,229,255,.2); border-top-color: #00E5FF; border-radius: 50%; animation: psspin .7s linear infinite; }
        @keyframes psspin { to { transform: rotate(360deg); } }
        .ps-header { background: linear-gradient(135deg, #181c28 0%, #0d1526 100%); border-bottom: 1px solid rgba(0,229,255,0.15); padding: 2rem 2.5rem; margin-bottom: 2rem; }
        .ps-header-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 1.25rem; }
        .ps-hdr-icon { font-size: 2.8rem; filter: drop-shadow(0 0 10px rgba(0,229,255,.4)); }
        .ps-title { margin: 0 0 .25rem; font-size: 2rem; font-weight: 800; background: linear-gradient(90deg, #00E5FF, #40C4FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .ps-subtitle { margin: 0; color: #64748b; font-size: .88rem; }
        .ps-empty { max-width: 520px; margin: 6rem auto; text-align: center; }
        .ps-empty-icon { font-size: 4rem; margin-bottom: 1rem; }
        .ps-empty-title { color: #94a3b8; font-size: 1.3rem; margin: 0 0 .5rem; }
        .ps-empty-desc { color: #475569; font-size: .92rem; line-height: 1.65; }
        .ps-no-match { text-align: center; color: #475569; padding: 3rem 1rem; }
        .ps-filters { max-width: 1200px; margin: 0 auto 1.5rem; padding: 0 2.5rem; display: flex; align-items: center; flex-wrap: wrap; gap: 1rem; }
        .ps-search-wrap { display: flex; align-items: center; gap: .5rem; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); border-radius: .65rem; padding: .55rem 1rem; flex: 1; min-width: 240px; }
        .ps-search-icon { color: #64748b; font-size: 1rem; }
        .ps-search { background: transparent; border: none; outline: none; color: #f1f5f9; font-size: .9rem; width: 100%; font-family: inherit; }
        .ps-search::placeholder { color: #475569; }
        .ps-pos-tabs { display: flex; gap: .4rem; }
        .ps-pos-tab { padding: .4rem .85rem; border-radius: .55rem; border: 1px solid rgba(255,255,255,.09); background: rgba(255,255,255,.04); color: #94a3b8; font-size: .78rem; font-weight: 600; cursor: pointer; transition: all .15s; }
        .ps-pos-tab:hover { background: rgba(255,255,255,.08); color: #e2e8f0; }
        .ps-pos-tab--active { background: rgba(0,229,255,.15); border-color: rgba(0,229,255,.4); color: #00E5FF; }
        .ps-count { color: #64748b; font-size: .82rem; white-space: nowrap; }
        .ps-grid { max-width: 1200px; margin: 0 auto; padding: 0 2.5rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
        .ps-card { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); border-radius: 1rem; overflow: hidden; transition: transform .15s, box-shadow .15s; }
        .ps-card:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(0,229,255,.08); }
        .ps-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; padding: .9rem 1rem; background: rgba(255,255,255,.025); border-bottom: 1px solid rgba(255,255,255,.06); }
        .ps-card-meta { display: flex; align-items: flex-start; gap: .6rem; }
        .ps-draft-pick { font-size: .72rem; font-weight: 800; color: #64748b; padding-top: .2rem; min-width: 1.4rem; }
        .ps-name-block { display: flex; flex-direction: column; gap: .15rem; }
        .ps-name { font-size: .95rem; font-weight: 700; color: #f1f5f9; display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; }
        .ps-filam-badge { font-size: .62rem; background: rgba(59,130,246,.2); border: 1px solid rgba(59,130,246,.3); color: #93c5fd; border-radius: 100px; padding: .08rem .4rem; font-weight: 700; letter-spacing: .03em; }
        .ps-sub { font-size: .72rem; color: #64748b; }
        .ps-ovr { font-size: 1.1rem; font-weight: 900; border-radius: .5rem; padding: .2rem .55rem; flex-shrink: 0; }
        .ps-ovr--elite { background: rgba(255,215,0,.15); color: #FFD700; border: 1px solid rgba(255,215,0,.3); }
        .ps-ovr--good  { background: rgba(118,255,3,.1);  color: #76FF03; border: 1px solid rgba(118,255,3,.25); }
        .ps-ovr--avg   { background: rgba(249,115,22,.1); color: #f97316; border: 1px solid rgba(249,115,22,.25); }
        .ps-ovr--low   { background: rgba(100,116,139,.1); color: #94a3b8; border: 1px solid rgba(100,116,139,.2); }
        .ps-bars { padding: .75rem 1rem; display: flex; flex-direction: column; gap: .4rem; }
        .ps-bar-row { display: flex; align-items: center; gap: .5rem; }
        .ps-bar-label { font-size: .62rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; min-width: 2rem; }
        .ps-bar-track { flex: 1; height: 5px; background: rgba(255,255,255,.06); border-radius: 100px; overflow: hidden; }
        .ps-bar-fill { height: 100%; border-radius: 100px; }
        .ps-bar-val { font-size: .72rem; font-weight: 700; color: #94a3b8; min-width: 1.8rem; text-align: right; }
        @media (max-width: 640px) { .ps-header { padding: 1.25rem 1rem; } .ps-title { font-size: 1.4rem; } .ps-filters { padding: 0 1rem; } .ps-grid { padding: 0 1rem; grid-template-columns: 1fr; } .ps-pos-tabs { flex-wrap: wrap; } }
      `}</style>
    </div>
  );
}
