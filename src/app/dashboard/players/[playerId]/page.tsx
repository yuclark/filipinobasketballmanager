import React from "react";
import Link from "next/link";
import { ChevronLeft, Calendar, User, MapPin, Award, Shield, Coins, Activity, Zap, Star } from "lucide-react";
import { getPlayerProfileAction } from "@/app/actions/statsEngine";
import ClientTabs from "./ClientTabs";
import PlayerAvatar from "@/components/PlayerAvatar";

interface PageProps {
  params: {
    playerId: string;
  };
}

export default async function PlayerProfilePage({ params }: PageProps) {
  const resolvedParams = await (params as any);
  const playerId = resolvedParams.playerId;

  if (!playerId) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p className="mb-4">No player selected.</p>
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-semibold hover:text-white transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const profileRes = await getPlayerProfileAction(playerId);

  if (!profileRes.success || !profileRes.player) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p className="mb-4">{profileRes.error || "Player not found."}</p>
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-semibold hover:text-white transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const { player, regularSeasonHistory, playoffHistory, careerRegular, careerPlayoffs, logs, awards, salaryHistory, evolutions, currentSeasonYear } = profileRes;

  const getOverallBadgeClass = (overall: number) => {
    if (overall >= 90) return "bg-orange-500/10 text-orange-400 border border-orange-500/30 shadow-lg shadow-orange-500/10";
    if (overall >= 80) return "bg-purple-500/10 text-purple-400 border border-purple-500/30 shadow-lg shadow-purple-500/10";
    if (overall >= 70) return "bg-blue-500/10 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/10";
    return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/30";
  };

  const formatPHP = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Bio values
  const age = player.age;
  const hometown = player.hometown;
  const college = player.college || "N/A";
  const height = player.height || "6-2";
  const heightCm = player.heightCm || 188;
  const weight = player.weight || 195;
  const weightKg = player.weightKg || 88;
  const shoots = player.shoots || "Right";
  const dob = player.dob || "N/A";
  const teamName = player.teamName;
  const teamConference = player.teamConference;

  // Primary Career average display points (using computed Regular Season career averages)
  const displayGP = careerRegular?.gp ?? 0;
  const displayPTS = careerRegular?.pts ?? "0.0";
  const displayTRB = careerRegular?.trb ?? "0.0";
  const displayAST = careerRegular?.ast ?? "0.0";
  const displayFG = careerRegular?.fgPct ?? "0.0";
  const display3P = careerRegular?.fg3Pct ?? "0.0";
  const displayFT = careerRegular?.ftPct ?? "0.0";
  const displayPER = careerRegular?.per ?? "0.0";
  const displayWS = careerRegular?.winShares ?? "0.00";

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <Link
          href={player.teamId ? `/dashboard/teams/${player.teamId}` : "/dashboard/free-agency"}
          className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-300 font-bold text-xs uppercase tracking-wider transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to {player.teamId ? "Franchise Roster" : "Free Agency"}</span>
        </Link>
      </div>

      {/* Main Bio Card */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-900 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/5 blur-3xl rounded-full pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row gap-8 items-start relative z-10">
          
          {/* Left Block: Avatar + Name + Core Info */}
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start w-full lg:w-auto">
            {/* Avatar / Cartoon Headshot */}
            <div className="w-28 h-28 shrink-0 rounded-2xl bg-zinc-950 border border-zinc-850 relative group overflow-hidden shadow-xl">
              <PlayerAvatar
                playerId={player.id}
                firstName={player.firstName}
                lastName={player.lastName}
                position={player.position}
                teamName={player.teamName}
                teamConference={player.teamConference}
              />
            </div>

            <div className="text-center sm:text-left space-y-3">
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                    teamConference === "Luzon"
                      ? "bg-red-500/10 text-red-400 border-red-500/25"
                      : teamConference === "VisMin"
                      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/25"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700"
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  {teamName}
                </span>

                {player.isFilAm && (
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 tracking-wider">
                    <Star className="w-3 h-3 fill-amber-400" />
                    Fil-Am
                  </span>
                )}
                {player.isRookie && (
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20 tracking-wider">
                    Rookie
                  </span>
                )}
              </div>

              <h1 className="text-4xl font-extrabold text-white tracking-tight">
                {player.firstName}{" "}
                <span className="bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
                  {player.lastName}
                </span>
              </h1>

              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-zinc-400 font-medium max-w-md">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Shoots: <b className="text-zinc-200">{shoots}</b></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Height: <b className="text-zinc-200">{height} ({heightCm}cm)</b></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Weight: <b className="text-zinc-200">{weight} lb ({weightKg}kg)</b></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Born: <b className="text-zinc-200">{dob}</b></span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Hometown: <b className="text-zinc-200">{hometown}</b></span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                  <Award className="w-3.5 h-3.5 text-zinc-500" />
                  <span>College: <b className="text-zinc-200">{college}</b></span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Draft: <b className="text-zinc-200">{
                    player.draftPick ? (
                      `Round ${player.draftRound}, Pick ${player.draftPick} (${player.draftYear})`
                    ) : player.draftYear ? (
                      `Undrafted (${player.draftYear})`
                    ) : (
                      "Undrafted (2026 Seeded)"
                    )
                  }</b></span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Block: Stats Summaries, Overall Rating, Contract */}
          <div className="flex flex-col sm:flex-row gap-6 lg:ml-auto w-full sm:w-auto">
            {/* OVR Box */}
            <div className="flex flex-col items-center justify-center p-6 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl min-w-[120px] text-center shrink-0">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Overall</span>
              <span
                className={`inline-flex items-center justify-center font-black text-3xl w-16 h-16 rounded-2xl ${getOverallBadgeClass(
                  player.overall
                )}`}
              >
                {player.overall}
              </span>
            </div>

            {/* Contract & Salary */}
            <div className="flex-1 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-center min-w-[240px]">
              <div className="flex items-center gap-3 mb-2 text-amber-500">
                <Coins className="w-5 h-5" />
                <span className="text-zinc-400 font-extrabold uppercase tracking-wider text-[11px] block">
                  Contract details
                </span>
              </div>
              <span className="text-xl font-extrabold text-zinc-100 block">
                {formatPHP(player.salary)} <span className="text-xs text-zinc-500 font-medium">/ year</span>
              </span>
              <span className="text-xs text-zinc-400 font-medium mt-1 block">
                {player.contractYearsRemaining} Year{player.contractYearsRemaining > 1 ? "s" : ""} Contract Remaining
              </span>

              {/* Injury Indicator */}
              {player.injuryDaysRemaining > 0 ? (
                <div className="mt-3 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 self-start">
                  <span className="animate-pulse w-2 h-2 rounded-full bg-red-500" />
                  🤕 Injured: {player.injuryType} ({player.injuryDaysRemaining}d remaining)
                </div>
              ) : (
                <div className="mt-3 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 self-start">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Active & Healthy
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>

      {/* Career Summary Banner */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-4">
        {[
          { label: "G", val: displayGP, desc: "Games Played" },
          { label: "PTS", val: displayPTS, desc: "Points Per Game" },
          { label: "TRB", val: displayTRB, desc: "Rebounds Per Game" },
          { label: "AST", val: displayAST, desc: "Assists Per Game" },
          { label: "FG%", val: `${displayFG}%`, desc: "Field Goal Percentage" },
          { label: "3P%", val: `${display3P}%`, desc: "3PT Percentage" },
          { label: "FT%", val: `${displayFT}%`, desc: "Free Throw Percentage" },
          { label: "PER", val: displayPER, desc: "Player Efficiency Rating", highlight: "text-red-400" },
          { label: "WS", val: displayWS, desc: "Career Win Shares", highlight: "text-green-400" },
        ].map((item, idx) => (
          <div key={idx} className="bg-zinc-900/30 border border-zinc-900/80 rounded-2xl p-4 text-center hover:border-zinc-800 transition-all flex flex-col justify-center shadow-md">
            <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block mb-0.5" title={item.desc}>
              {item.label}
            </span>
            <span className={`text-base font-extrabold ${item.highlight || "text-zinc-100"} block`}>
              {item.val}
            </span>
          </div>
        ))}
      </div>

      {/* Main Stats / Attributes / Logs Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Dynamic Tabs Content */}
        <div className="lg:col-span-9 space-y-6 min-w-0">
          <ClientTabs
            player={player}
            regularSeason={regularSeasonHistory}
            playoffs={playoffHistory}
            careerRegular={careerRegular}
            careerPlayoffs={careerPlayoffs}
            logs={logs}
            salaryHistory={salaryHistory || []}
            evolutions={evolutions || []}
            currentSeasonYear={currentSeasonYear ?? 2026}
          />
        </div>

        {/* Right Side: Sidebar for Awards & Honors */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-2.5 mb-4 border-b border-zinc-900 pb-3">
              <Award className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                Awards & Honors
              </h3>
            </div>
            
            {awards.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs italic">
                No trophies or league awards recorded yet.
              </div>
            ) : (
              <ul className="space-y-3.5">
                {awards.map((award, i) => (
                  <li
                    key={i}
                    className="flex gap-3 items-start p-3 bg-zinc-950/40 border border-zinc-900 rounded-xl text-xs font-semibold text-zinc-300"
                  >
                    <TrophyIcon className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>{award}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

// Small Trophy Icon helper
function TrophyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
      <path d="M12 2a6 6 0 0 1 6 6v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8a6 6 0 0 1 6-6z" />
    </svg>
  );
}
