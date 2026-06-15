"use client";

import React, { useState } from "react";
import { Users, BarChart3, ListFilter, Star, Sparkles } from "lucide-react";

interface ClientTabsProps {
  player: any;
  regularSeason: any[];
  playoffs: any[];
  careerRegular: any;
  careerPlayoffs: any;
  logs: any[];
  currentSeasonYear: number;
  salaryHistory: any[];
}

export default function ClientTabs({
  player,
  regularSeason,
  playoffs,
  careerRegular,
  careerPlayoffs,
  logs,
  currentSeasonYear,
  salaryHistory = [],
}: ClientTabsProps) {
  const [activeTab, setActiveTab] = useState<"stats" | "attributes" | "logs" | "contract">("stats");
  const [splitTab, setSplitTab] = useState<"regular" | "playoffs">("regular");
  const [selectedYear, setSelectedYear] = useState<number>(currentSeasonYear);

  const years: number[] = [];
  for (let y = 2026; y <= currentSeasonYear; y++) {
    years.push(y);
  }

  const filteredLogs = logs.filter((log) => log.seasonYear === selectedYear);

  const formatPHP = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getAttrColor = (val: number) => {
    if (val >= 90) return "bg-orange-500 text-orange-400";
    if (val >= 80) return "bg-amber-500 text-amber-400";
    if (val >= 70) return "bg-blue-500 text-blue-400";
    return "bg-zinc-600 text-zinc-400";
  };

  const getAttrProgressClass = (val: number) => {
    if (val >= 90) return "bg-gradient-to-r from-orange-600 to-orange-400";
    if (val >= 80) return "bg-gradient-to-r from-amber-600 to-amber-400";
    if (val >= 70) return "bg-gradient-to-r from-blue-600 to-blue-400";
    return "bg-gradient-to-r from-zinc-700 to-zinc-500";
  };

  // Stats table lists
  const activeHistory = splitTab === "regular" ? regularSeason : playoffs;
  const activeCareer = splitTab === "regular" ? careerRegular : careerPlayoffs;

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      
      {/* Tabs Switcher Header */}
      <div className="flex border-b border-zinc-900 pb-px">
        <div className="flex space-x-1 bg-zinc-950 p-1 rounded-xl border border-zinc-900/60">
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === "stats"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Per Game Stats
          </button>
          <button
            onClick={() => setActiveTab("attributes")}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === "attributes"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Ratings & Attributes
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === "logs"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Season Game Logs ({filteredLogs.length})
          </button>
          <button
            onClick={() => setActiveTab("contract")}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === "contract"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Contract & Salary History
          </button>
        </div>
      </div>

      {/* Stats Tab Content */}
      {activeTab === "stats" && (
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          
          {/* Sub-toggle split: Regular vs Playoffs */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Per Game Career Splits</h3>
              <p className="text-zinc-550 text-xs font-medium">Averages computed by season since league entrance.</p>
            </div>
            
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-900 shrink-0">
              <button
                onClick={() => setSplitTab("regular")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                  splitTab === "regular"
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Regular Season
              </button>
              <button
                onClick={() => setSplitTab("playoffs")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                  splitTab === "playoffs"
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Playoffs
              </button>
            </div>
          </div>

          {/* Stats Grid Table */}
          <div className="w-full overflow-x-auto rounded-xl border border-zinc-900">
            <table className="w-full min-w-[1200px] text-left border-collapse text-xs select-none">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-550 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-4">Season</th>
                  <th className="py-4 px-3 text-center">Age</th>
                  <th className="py-4 px-4">Team</th>
                  <th className="py-4 px-3 text-center">Lg</th>
                  <th className="py-4 px-3 text-center">Pos</th>
                  <th className="py-4 px-3 text-center">G</th>
                  <th className="py-4 px-3 text-center">GS</th>
                  <th className="py-4 px-3 text-center">MP</th>
                  <th className="py-4 px-3 text-center">FG</th>
                  <th className="py-4 px-3 text-center">FGA</th>
                  <th className="py-4 px-3 text-center">FG%</th>
                  <th className="py-4 px-3 text-center">3P</th>
                  <th className="py-4 px-3 text-center">3PA</th>
                  <th className="py-4 px-3 text-center">3P%</th>
                  <th className="py-4 px-3 text-center">FT</th>
                  <th className="py-4 px-3 text-center">FTA</th>
                  <th className="py-4 px-3 text-center">FT%</th>
                  <th className="py-4 px-3 text-center">ORB</th>
                  <th className="py-4 px-3 text-center">DRB</th>
                  <th className="py-4 px-3 text-center">TRB</th>
                  <th className="py-4 px-3 text-center">AST</th>
                  <th className="py-4 px-3 text-center">STL</th>
                  <th className="py-4 px-3 text-center">BLK</th>
                  <th className="py-4 px-3 text-center">TOV</th>
                  <th className="py-4 px-3 text-center">PF</th>
                  <th className="py-4 px-3 text-center font-bold text-orange-400">PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 bg-zinc-950/20 text-zinc-300">
                {activeHistory.length > 0 ? (
                  activeHistory.map((s, idx) => (
                    <tr key={idx} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-zinc-400">{s.seasonYear}-{String(s.seasonYear + 1).slice(2)}</td>
                      <td className="py-3 px-3 text-center">{s.age}</td>
                      <td className="py-3 px-4 font-medium text-zinc-300">{s.teamName}</td>
                      <td className="py-3 px-3 text-center text-zinc-500">FBM</td>
                      <td className="py-3 px-3 text-center font-semibold text-zinc-400">{player.position}</td>
                      <td className="py-3 px-3 text-center">{s.gp}</td>
                      <td className="py-3 px-3 text-center">{s.gs}</td>
                      <td className="py-3 px-3 text-center font-semibold">{s.mp.toFixed(1)}</td>
                      <td className="py-3 px-3 text-center">{s.fgm.toFixed(1)}</td>
                      <td className="py-3 px-3 text-center">{s.fga.toFixed(1)}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-zinc-200">{s.fgPct.toFixed(1)}%</td>
                      <td className="py-3 px-3 text-center">{s.fg3m.toFixed(1)}</td>
                      <td className="py-3 px-3 text-center">{s.fg3a.toFixed(1)}</td>
                      <td className="py-3 px-3 text-center font-mono">{s.fg3a > 0 ? `${s.fg3Pct.toFixed(1)}%` : "—"}</td>
                      <td className="py-3 px-3 text-center">{s.ftm.toFixed(1)}</td>
                      <td className="py-3 px-3 text-center">{s.fta.toFixed(1)}</td>
                      <td className="py-3 px-3 text-center font-mono">{s.ftPct.toFixed(1)}%</td>
                      <td className="py-3 px-3 text-center text-zinc-450">{s.orb.toFixed(1)}</td>
                      <td className="py-3 px-3 text-center text-zinc-450">{s.drb.toFixed(1)}</td>
                      <td className="py-3 px-3 text-center font-semibold">{s.trb.toFixed(1)}</td>
                      <td className="py-3 px-3 text-center font-semibold">{s.ast.toFixed(1)}</td>
                      <td className="py-3 px-3 text-center">{s.stl.toFixed(1)}</td>
                      <td className="py-3 px-3 text-center">{s.blk.toFixed(1)}</td>
                      <td className="py-3 px-3 text-center text-zinc-450">{s.tov.toFixed(1)}</td>
                      <td className="py-3 px-3 text-center text-zinc-500">{s.pf.toFixed(1)}</td>
                      <td className="py-3 px-3 text-center font-extrabold text-orange-400">{s.pts.toFixed(1)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={26} className="py-8 text-center text-zinc-500 italic">
                      No matching season records found.
                    </td>
                  </tr>
                )}

                {/* Career Totals Row */}
                {activeCareer && (
                  <tr className="bg-zinc-900 border-t-2 border-zinc-850 text-zinc-100 font-extrabold">
                    <td className="py-3.5 px-4 uppercase tracking-wider text-orange-400">Career</td>
                    <td className="py-3.5 px-3 text-center">—</td>
                    <td className="py-3.5 px-4 text-zinc-450">Averages</td>
                    <td className="py-3.5 px-3 text-center text-zinc-600">—</td>
                    <td className="py-3.5 px-3 text-center text-zinc-400">{player.position}</td>
                    <td className="py-3.5 px-3 text-center">{activeCareer.gp}</td>
                    <td className="py-3.5 px-3 text-center">{activeCareer.gs}</td>
                    <td className="py-3.5 px-3 text-center font-black">{activeCareer.mp.toFixed(1)}</td>
                    <td className="py-3.5 px-3 text-center">{activeCareer.fgm.toFixed(1)}</td>
                    <td className="py-3.5 px-3 text-center">{activeCareer.fga.toFixed(1)}</td>
                    <td className="py-3.5 px-3 text-center font-mono font-black text-zinc-100">{activeCareer.fgPct.toFixed(1)}%</td>
                    <td className="py-3.5 px-3 text-center">{activeCareer.fg3m.toFixed(1)}</td>
                    <td className="py-3.5 px-3 text-center">{activeCareer.fg3a.toFixed(1)}</td>
                    <td className="py-3.5 px-3 text-center font-mono">{activeCareer.fg3a > 0 ? `${activeCareer.fg3Pct.toFixed(1)}%` : "—"}</td>
                    <td className="py-3.5 px-3 text-center">{activeCareer.ftm.toFixed(1)}</td>
                    <td className="py-3.5 px-3 text-center">{activeCareer.fta.toFixed(1)}</td>
                    <td className="py-3.5 px-3 text-center font-mono">{activeCareer.ftPct.toFixed(1)}%</td>
                    <td className="py-3.5 px-3 text-center text-zinc-400">{activeCareer.orb.toFixed(1)}</td>
                    <td className="py-3.5 px-3 text-center text-zinc-400">{activeCareer.drb.toFixed(1)}</td>
                    <td className="py-3.5 px-3 text-center font-black">{activeCareer.trb.toFixed(1)}</td>
                    <td className="py-3.5 px-3 text-center font-black">{activeCareer.ast.toFixed(1)}</td>
                    <td className="py-3.5 px-3 text-center">{activeCareer.stl.toFixed(1)}</td>
                    <td className="py-3.5 px-3 text-center">{activeCareer.blk.toFixed(1)}</td>
                    <td className="py-3.5 px-3 text-center text-zinc-400">{activeCareer.tov.toFixed(1)}</td>
                    <td className="py-3.5 px-3 text-center text-zinc-500">{activeCareer.pf.toFixed(1)}</td>
                    <td className="py-3.5 px-3 text-center font-black text-orange-400">{activeCareer.pts.toFixed(1)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ratings Tab Content */}
      {activeTab === "attributes" && (
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl relative">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-1">Skill Profile</h3>
            <p className="text-zinc-550 text-xs font-medium">Ratings represent overall attributes computed in simulated court matches.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {[
              { label: "Three Point (3PT)", value: player.threePoint, desc: "Shooting efficiency from outside the arc." },
              { label: "Inside Scoring (INS)", value: player.insideScoring, desc: "Layups, posts, dunks, and close shots." },
              { label: "Playmaking (PLY)", value: player.playmaking, desc: "Passing vision, ball handling, and court control." },
              { label: "Perimeter Defense (PDF)", value: player.perimeterDefense, desc: "Contesting guards, stealing, and perimeter containment." },
              { label: "Interior Defense (IDF)", value: player.interiorDefense, desc: "Paint protection, shot blocking, and post contest." },
              { label: "Rebounding (REB)", value: player.rebounding, desc: "Positioning and boxing out for offensive and defensive boards." },
              { label: "Speed (SPD)", value: player.speed, desc: "Footwork speed, acceleration, and court sprints." },
              { label: "Stamina (STA)", value: player.stamina, desc: "Stamina levels, playing capacity, and injury resistance." },
            ].map((attr, index) => {
              const cfg = getAttrColor(attr.value);
              const colorText = cfg.split(" ")[1];
              return (
                <div key={index} className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-xs font-bold text-zinc-200 block">{attr.label}</span>
                      <span className="text-[10px] text-zinc-500 font-medium block">{attr.desc}</span>
                    </div>
                    <span className={`text-sm font-black uppercase ${colorText}`}>
                      {attr.value}
                    </span>
                  </div>
                  
                  <div className="bg-zinc-950 h-2 border border-zinc-900/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${getAttrProgressClass(attr.value)}`}
                      style={{ width: `${attr.value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Game Logs Tab Content */}
      {activeTab === "logs" && (
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Season Game Logs ({selectedYear})</h3>
              <p className="text-zinc-550 text-xs font-medium">Individual performance breakdown for each completed matchup.</p>
            </div>
            
            <div className="flex items-center gap-2 bg-zinc-950 p-1.5 px-3 rounded-xl border border-zinc-900 shrink-0">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">Season:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-transparent text-xs font-bold text-zinc-200 focus:outline-none cursor-pointer border-none"
              >
                {years.map((y) => (
                  <option key={y} value={y} className="bg-zinc-950 text-zinc-200">
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="bg-zinc-950/20 border border-zinc-900 rounded-2xl p-12 text-center text-zinc-500 text-sm italic">
              No games simulated in the {selectedYear} season yet.
            </div>
          ) : (
            <div className="w-full overflow-x-auto rounded-xl border border-zinc-900">
              <table className="w-full min-w-[900px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-550 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-4.5 px-4 text-center">Day</th>
                    <th className="py-4.5 px-4">Opponent</th>
                    <th className="py-4.5 px-4 text-center">Result</th>
                    <th className="py-4.5 px-3 text-center">MIN</th>
                    <th className="py-4.5 px-3 text-center">FG</th>
                    <th className="py-4.5 px-3 text-center">3P</th>
                    <th className="py-4.5 px-3 text-center">FT</th>
                    <th className="py-4.5 px-3 text-center">ORB</th>
                    <th className="py-4.5 px-3 text-center">DRB</th>
                    <th className="py-4.5 px-3 text-center font-bold">TRB</th>
                    <th className="py-4.5 px-3 text-center font-bold">AST</th>
                    <th className="py-4.5 px-3 text-center">STL</th>
                    <th className="py-4.5 px-3 text-center">BLK</th>
                    <th className="py-4.5 px-3 text-center">TO</th>
                    <th className="py-4.5 px-3 text-center font-black text-orange-400">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 bg-zinc-950/20 text-zinc-300">
                  {filteredLogs.map((log, index) => (
                    <tr key={index} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="py-3 px-4 text-center font-bold text-zinc-400">Day {log.gameNumber}</td>
                      <td className="py-3 px-4 font-medium text-zinc-300">
                        {log.isHome ? "vs " : "@ "}
                        {log.opponentName}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                            log.won
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                              : "bg-red-500/10 text-red-400 border-red-500/25"
                          }`}
                        >
                          {log.won ? "W" : "L"} {log.scoreText}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-semibold">{log.minutes}</td>
                      <td className="py-3 px-3 text-center">{log.fgm}-{log.fga}</td>
                      <td className="py-3 px-3 text-center">{log.fg3m}-{log.fg3a}</td>
                      <td className="py-3 px-3 text-center">{log.ftm}-{log.fta}</td>
                      <td className="py-3 px-3 text-center text-zinc-450">{log.orb}</td>
                      <td className="py-3 px-3 text-center text-zinc-450">{log.drb}</td>
                      <td className="py-3 px-3 text-center font-bold">{log.rebounds}</td>
                      <td className="py-3 px-3 text-center font-bold">{log.assists}</td>
                      <td className="py-3 px-3 text-center text-zinc-300">{log.steals}</td>
                      <td className="py-3 px-3 text-center text-zinc-300">{log.blocks}</td>
                      <td className="py-3 px-3 text-center text-zinc-450">{log.turnovers}</td>
                      <td className="py-3 px-3 text-center font-black text-orange-400">{log.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Contract & Salary History Tab Content */}
      {activeTab === "contract" && (
        <div className="space-y-6">
          {/* Current Contract Details Card */}
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />
            
            <h3 className="text-lg font-bold text-white mb-4">Current Contract Summary</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-zinc-950/40 border border-zinc-900/80 rounded-2xl p-4 shadow-sm hover:border-zinc-800 transition-all">
                <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest block mb-1">Annual Salary</span>
                <span className="text-lg font-black text-amber-500">{formatPHP(player.salary)}</span>
              </div>
              
              <div className="bg-zinc-950/40 border border-zinc-900/80 rounded-2xl p-4 shadow-sm hover:border-zinc-800 transition-all">
                <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest block mb-1">Contract Duration</span>
                <span className="text-lg font-black text-zinc-100">{player.contractYearsRemaining} Year{player.contractYearsRemaining > 1 ? "s" : ""}</span>
              </div>
              
              <div className="bg-zinc-950/40 border border-zinc-900/80 rounded-2xl p-4 shadow-sm hover:border-zinc-800 transition-all">
                <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest block mb-1">Current Team</span>
                {player.teamId ? (
                  <a
                    href={`/dashboard/teams/${player.teamId}`}
                    className="text-lg font-black text-blue-400 hover:text-blue-300 transition-colors inline-block hover:underline"
                  >
                    {player.teamName || "View Team"}
                  </a>
                ) : (
                  <span className="text-lg font-black text-zinc-400">Free Agent</span>
                )}
              </div>
            </div>
          </div>

          {/* Salary History Table */}
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-white mb-1">Career Earnings & Salary History</h3>
              <p className="text-zinc-550 text-xs font-medium">Historical snapshot of contract salaries earned per season.</p>
            </div>

            <div className="w-full overflow-x-auto rounded-xl border border-zinc-900">
              <table className="w-full text-left border-collapse text-xs select-none">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-550 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-4 px-6">Season</th>
                    <th className="py-4 px-6">Franchise / Team</th>
                    <th className="py-4 px-6 text-right">Salary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 bg-zinc-950/20 text-zinc-300">
                  {salaryHistory.length > 0 ? (
                    salaryHistory.map((historyItem, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="py-4.5 px-6 font-bold text-zinc-400">
                          {historyItem.seasonYear}
                        </td>
                        <td className="py-4.5 px-6 font-medium">
                          {historyItem.teamId ? (
                            <a
                              href={`/dashboard/teams/${historyItem.teamId}`}
                              className="text-blue-400 hover:text-blue-300 transition-colors hover:underline"
                            >
                              {historyItem.teamName}
                            </a>
                          ) : (
                            <span className="text-zinc-500 font-semibold">Free Agent</span>
                          )}
                        </td>
                        <td className="py-4.5 px-6 text-right font-extrabold text-zinc-100">
                          {formatPHP(historyItem.salary)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-zinc-500 italic">
                        No salary history records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
