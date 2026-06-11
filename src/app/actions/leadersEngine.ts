"use server";

import { db } from "@/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { players, games, playerGameStats, teams } from "@/db/schema";

export interface LeaderEntry {
  rank: number;
  playerId?: string;
  playerName?: string;
  teamId?: string;
  teamName: string;
  value: number;
}

export interface LeaderCategory {
  key: string;
  label: string;
  emoji: string;
  color: string;
  format: "decimal" | "pct" | "integer";
  leaders: LeaderEntry[];
}

export async function getLeagueLeadersAction(): Promise<{
  success: boolean;
  seasonYear: number;
  categories: LeaderCategory[];
  teamCategories: LeaderCategory[];
  playerCount: number;
  error?: string;
}> {
  try {
    // Find current active season year
    const [latestGame] = await db
      .select({ seasonYear: games.seasonYear })
      .from(games)
      .where(eq(games.stage, "Regular"))
      .orderBy(games.seasonYear)
      .limit(1);

    const seasonYear = latestGame?.seasonYear ?? new Date().getFullYear();

    const regularGameRows = await db
      .select({
        id: games.id,
        homeTeamId: games.homeTeamId,
        awayTeamId: games.awayTeamId,
        homeScore: games.homeScore,
        awayScore: games.awayScore,
        status: games.status,
      })
      .from(games)
      .where(and(eq(games.stage, "Regular"), eq(games.seasonYear, seasonYear)));

    if (regularGameRows.length === 0) {
      return { success: true, seasonYear, categories: [], teamCategories: [], playerCount: 0 };
    }

    const gameIds = regularGameRows.map((g) => g.id);

    // Calculate team wins, losses, and point differential
    const teamStatsMap = new Map<string, { wins: number; losses: number; pointDiffSum: number; gamesPlayed: number }>();
    const allTeams = await db.select({ id: teams.id, name: teams.name, city: teams.city }).from(teams);

    for (const t of allTeams) {
      teamStatsMap.set(t.id, { wins: 0, losses: 0, pointDiffSum: 0, gamesPlayed: 0 });
    }

    for (const g of regularGameRows) {
      if (g.status !== "Completed") continue;
      const homeStats = teamStatsMap.get(g.homeTeamId);
      const awayStats = teamStatsMap.get(g.awayTeamId);

      if (homeStats && awayStats) {
        homeStats.gamesPlayed++;
        awayStats.gamesPlayed++;

        const diff = g.homeScore - g.awayScore;
        homeStats.pointDiffSum += diff;
        awayStats.pointDiffSum -= diff;

        if (g.homeScore > g.awayScore) {
          homeStats.wins++;
          awayStats.losses++;
        } else {
          awayStats.wins++;
          homeStats.losses++;
        }
      }
    }

    const [allLogs, allPlayers] = await Promise.all([
      db
        .select({
          playerId: playerGameStats.playerId,
          points: playerGameStats.points,
          rebounds: playerGameStats.rebounds,
          assists: playerGameStats.assists,
          steals: playerGameStats.steals,
          blocks: playerGameStats.blocks,
          turnovers: playerGameStats.turnovers,
          fieldGoalsMade: playerGameStats.fieldGoalsMade,
          fieldGoalsAttempted: playerGameStats.fieldGoalsAttempted,
          threePointMade: playerGameStats.threePointMade,
          threePointAttempted: playerGameStats.threePointAttempted,
          freeThrowsMade: playerGameStats.freeThrowsMade,
          freeThrowsAttempted: playerGameStats.freeThrowsAttempted,
          minutes: playerGameStats.minutes,
        })
        .from(playerGameStats)
        .where(inArray(playerGameStats.gameId, gameIds)),
      db.select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        teamId: players.teamId,
        overall: players.overall,
      }).from(players),
    ]);

    const playerMap = new Map(allPlayers.map((p) => [p.id, p]));
    const teamMap = new Map(allTeams.map((t) => [t.id, `${t.city} ${t.name}`]));

    // Calculate Team OVRs from roster averages
    const teamOvrSum = new Map<string, number>();
    const teamPlayersCount = new Map<string, number>();
    for (const p of allPlayers) {
      if (p.teamId) {
        teamOvrSum.set(p.teamId, (teamOvrSum.get(p.teamId) ?? 0) + p.overall);
        teamPlayersCount.set(p.teamId, (teamPlayersCount.get(p.teamId) ?? 0) + 1);
      }
    }

    const teamList = allTeams.map((t) => {
      const stats = teamStatsMap.get(t.id) ?? { wins: 0, losses: 0, pointDiffSum: 0, gamesPlayed: 0 };
      const playerCount = teamPlayersCount.get(t.id) ?? 0;
      const ovr = playerCount > 0 ? Math.round(teamOvrSum.get(t.id)! / playerCount) : 60;
      const winPct = stats.gamesPlayed > 0 ? (stats.wins / stats.gamesPlayed) * 100 : 0;
      const avgPointDiff = stats.gamesPlayed > 0 ? stats.pointDiffSum / stats.gamesPlayed : 0;

      return {
        teamId: t.id,
        teamName: `${t.city} ${t.name}`,
        ovr,
        wins: stats.wins,
        losses: stats.losses,
        winPct,
        avgPointDiff,
      };
    });

    // Aggregate per player
    type Agg = {
      gp: number; pts: number; reb: number; ast: number; stl: number; blk: number;
      fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number;
      tov: number; min: number;
    };
    const agg = new Map<string, Agg>();

    for (const log of allLogs) {
      const prev = agg.get(log.playerId) ?? { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, tov: 0, min: 0 };
      agg.set(log.playerId, {
        gp: prev.gp + 1,
        pts: prev.pts + log.points,
        reb: prev.reb + log.rebounds,
        ast: prev.ast + log.assists,
        stl: prev.stl + log.steals,
        blk: prev.blk + log.blocks,
        fgm: prev.fgm + log.fieldGoalsMade,
        fga: prev.fga + log.fieldGoalsAttempted,
        tpm: prev.tpm + log.threePointMade,
        tpa: prev.tpa + log.threePointAttempted,
        ftm: prev.ftm + log.freeThrowsMade,
        fta: prev.fta + log.freeThrowsAttempted,
        tov: prev.tov + log.turnovers,
        min: prev.min + log.minutes,
      });
    }

    const MIN_GP = 10;
    type QP = {
      playerId: string; playerName: string; teamId: string; teamName: string; gp: number;
      ppg: number; rpg: number; apg: number; spg: number; bpg: number;
      fgPct: number; tpPct: number; ftPct: number;
      per: number; winShares: number;
    };

    const qualified: QP[] = [];
    for (const [pid, stat] of agg.entries()) {
      if (stat.gp < MIN_GP) continue;
      const p = playerMap.get(pid);
      if (!p) continue;
      const tid = p.teamId ?? "";

      const ppg = stat.pts / stat.gp;
      const rpg = stat.reb / stat.gp;
      const apg = stat.ast / stat.gp;
      const spg = stat.stl / stat.gp;
      const bpg = stat.blk / stat.gp;
      const fgPct = stat.fga > 0 ? (stat.fgm / stat.fga) * 100 : 0;
      const tpPct = stat.tpa > 0 ? (stat.tpm / stat.tpa) * 100 : 0;
      const ftPct = stat.fta > 0 ? (stat.ftm / stat.fta) * 100 : 0;

      // PER Formula
      const avgMin = stat.min / stat.gp;
      let rawPer = 0;
      if (stat.min > 0) {
        rawPer = ((stat.pts + stat.reb * 1.2 + stat.ast * 1.5 + stat.stl * 2.0 + stat.blk * 2.0 - stat.tov * 1.5 - (stat.fga - stat.fgm) * 0.8 - (stat.fta - stat.ftm) * 0.4) / stat.min) * 15;
      }
      let per = rawPer;
      if (avgMin < 5) {
        per = (rawPer * avgMin + p.overall * (5 - avgMin)) / 5;
      }

      // Win Shares Formula
      const teamStats = teamStatsMap.get(tid) ?? { wins: 0, losses: 0, pointDiffSum: 0, gamesPlayed: 0 };
      const winShares = (stat.pts * 0.03 + stat.reb * 0.05 + stat.ast * 0.04 + stat.stl * 0.1 + stat.blk * 0.1 - stat.tov * 0.08) * (teamStats.wins / 82) * 4.5;

      qualified.push({
        playerId: pid,
        playerName: `${p.firstName} ${p.lastName}`,
        teamId: tid,
        teamName: teamMap.get(tid) ?? "Free Agent",
        gp: stat.gp,
        ppg,
        rpg,
        apg,
        spg,
        bpg,
        fgPct,
        tpPct,
        ftPct,
        per,
        winShares,
      });
    }

    const makeCategory = (
      key: string, label: string, emoji: string, color: string,
      format: "decimal" | "pct" | "integer", getter: (p: QP) => number
    ): LeaderCategory => ({
      key, label, emoji, color, format,
      leaders: [...qualified]
        .sort((a, b) => getter(b) - getter(a))
        .slice(0, 10)
        .map((p, i) => ({
          rank: i + 1,
          playerId: p.playerId,
          playerName: p.playerName,
          teamId: p.teamId,
          teamName: p.teamName,
          value: getter(p),
        })),
    });

    const playerCategories: LeaderCategory[] = [
      makeCategory("ppg",   "Points Per Game",    "🏀", "#FF6D00", "decimal", (p) => p.ppg),
      makeCategory("rpg",   "Rebounds Per Game",  "💪", "#00E5FF", "decimal", (p) => p.rpg),
      makeCategory("apg",   "Assists Per Game",   "🎯", "#76FF03", "decimal", (p) => p.apg),
      makeCategory("spg",   "Steals Per Game",    "🤚", "#FFD700", "decimal", (p) => p.spg),
      makeCategory("bpg",   "Blocks Per Game",    "🛡️", "#E040FB", "decimal", (p) => p.bpg),
      makeCategory("fgPct", "Field Goal %",       "📊", "#FF4081", "pct",     (p) => p.fgPct),
      makeCategory("tpPct", "3-Point %",          "🎯", "#40C4FF", "pct",     (p) => p.tpPct),
      makeCategory("ftPct", "Free Throw %",       "🎪", "#69F0AE", "pct",     (p) => p.ftPct),
      makeCategory("per",   "Player Efficiency",  "⚡", "#FF9100", "decimal", (p) => p.per),
      makeCategory("winShares", "Win Shares",     "📈", "#00E676", "decimal", (p) => p.winShares),
    ];

    const makeTeamCategory = (
      key: string, label: string, emoji: string, color: string,
      format: "decimal" | "pct" | "integer", getter: (t: typeof teamList[0]) => number
    ): LeaderCategory => ({
      key, label, emoji, color, format,
      leaders: [...teamList]
        .sort((a, b) => {
          if (key === "losses") {
            // Sort ascending for losses (worst is team with least losses)
            return getter(a) - getter(b);
          }
          return getter(b) - getter(a);
        })
        .slice(0, 10)
        .map((t, i) => ({
          rank: i + 1,
          teamId: t.teamId,
          teamName: t.teamName,
          value: getter(t),
        })),
    });

    const teamCategories = [
      makeTeamCategory("ovr",       "Team OVR Rating",   "🛡️", "#29B6F6", "integer", (t) => t.ovr),
      makeTeamCategory("wins",      "Total Wins",        "🏆", "#66BB6A", "integer", (t) => t.wins),
      makeTeamCategory("losses",    "Total Losses",      "💔", "#EF5350", "integer", (t) => t.losses),
      makeTeamCategory("winPct",    "Win Percentage",    "📈", "#FFA726", "pct",     (t) => t.winPct),
      makeTeamCategory("pointDiff", "Avg Point Diff",    "📊", "#AB47BC", "decimal", (t) => t.avgPointDiff),
    ];

    return { success: true, seasonYear, categories: playerCategories, teamCategories, playerCount: qualified.length };
  } catch (error: any) {
    console.error("[Leaders Action] Failed:", error);
    return { success: false, seasonYear: 0, categories: [], teamCategories: [], playerCount: 0, error: error.message };
  }
}
