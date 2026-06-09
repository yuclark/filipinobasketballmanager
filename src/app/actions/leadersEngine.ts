"use server";

import { db } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { players, games, playerGameStats, teams } from "@/db/schema";

export interface LeaderEntry {
  rank: number;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  value: number;
}

export interface LeaderCategory {
  key: string;
  label: string;
  emoji: string;
  color: string;
  format: "decimal" | "pct";
  leaders: LeaderEntry[];
}

export async function getLeagueLeadersAction(): Promise<{
  success: boolean;
  seasonYear: number;
  categories: LeaderCategory[];
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
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.stage, "Regular"), eq(games.seasonYear, seasonYear)));

    if (regularGameRows.length === 0) {
      return { success: true, seasonYear, categories: [], playerCount: 0 };
    }

    const gameIds = regularGameRows.map((g) => g.id);

    const [allLogs, allPlayers, allTeams] = await Promise.all([
      db
        .select({
          playerId: playerGameStats.playerId,
          points: playerGameStats.points,
          rebounds: playerGameStats.rebounds,
          assists: playerGameStats.assists,
          steals: playerGameStats.steals,
          blocks: playerGameStats.blocks,
          fieldGoalsMade: playerGameStats.fieldGoalsMade,
          fieldGoalsAttempted: playerGameStats.fieldGoalsAttempted,
          threePointMade: playerGameStats.threePointMade,
          threePointAttempted: playerGameStats.threePointAttempted,
          freeThrowsMade: playerGameStats.freeThrowsMade,
          freeThrowsAttempted: playerGameStats.freeThrowsAttempted,
        })
        .from(playerGameStats)
        .where(inArray(playerGameStats.gameId, gameIds)),
      db.select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        teamId: players.teamId,
      }).from(players),
      db.select({ id: teams.id, name: teams.name, city: teams.city }).from(teams),
    ]);

    const playerMap = new Map(allPlayers.map((p) => [p.id, p]));
    const teamMap = new Map(allTeams.map((t) => [t.id, `${t.city} ${t.name}`]));

    // Aggregate per player
    type Agg = {
      gp: number; pts: number; reb: number; ast: number; stl: number; blk: number;
      fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number;
    };
    const agg = new Map<string, Agg>();

    for (const log of allLogs) {
      const prev = agg.get(log.playerId) ?? { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 };
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
      });
    }

    const MIN_GP = 10;
    type QP = {
      playerId: string; playerName: string; teamId: string; teamName: string; gp: number;
      ppg: number; rpg: number; apg: number; spg: number; bpg: number;
      fgPct: number; tpPct: number; ftPct: number;
    };

    const qualified: QP[] = [];
    for (const [pid, stat] of agg.entries()) {
      if (stat.gp < MIN_GP) continue;
      const p = playerMap.get(pid);
      if (!p) continue;
      const tid = p.teamId ?? "";
      qualified.push({
        playerId: pid,
        playerName: `${p.firstName} ${p.lastName}`,
        teamId: tid,
        teamName: teamMap.get(tid) ?? "Free Agent",
        gp: stat.gp,
        ppg: stat.pts / stat.gp,
        rpg: stat.reb / stat.gp,
        apg: stat.ast / stat.gp,
        spg: stat.stl / stat.gp,
        bpg: stat.blk / stat.gp,
        fgPct: stat.fga > 0 ? (stat.fgm / stat.fga) * 100 : 0,
        tpPct: stat.tpa > 0 ? (stat.tpm / stat.tpa) * 100 : 0,
        ftPct: stat.fta > 0 ? (stat.ftm / stat.fta) * 100 : 0,
      });
    }

    const makeCategory = (
      key: string, label: string, emoji: string, color: string,
      format: "decimal" | "pct", getter: (p: QP) => number
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

    const categories: LeaderCategory[] = [
      makeCategory("ppg",   "Points Per Game",    "🏀", "#FF6D00", "decimal", (p) => p.ppg),
      makeCategory("rpg",   "Rebounds Per Game",  "💪", "#00E5FF", "decimal", (p) => p.rpg),
      makeCategory("apg",   "Assists Per Game",   "🎯", "#76FF03", "decimal", (p) => p.apg),
      makeCategory("spg",   "Steals Per Game",    "🤚", "#FFD700", "decimal", (p) => p.spg),
      makeCategory("bpg",   "Blocks Per Game",    "🛡️", "#E040FB", "decimal", (p) => p.bpg),
      makeCategory("fgPct", "Field Goal %",       "📊", "#FF4081", "pct",     (p) => p.fgPct),
      makeCategory("tpPct", "3-Point %",          "🎯", "#40C4FF", "pct",     (p) => p.tpPct),
      makeCategory("ftPct", "Free Throw %",       "🎪", "#69F0AE", "pct",     (p) => p.ftPct),
    ];

    return { success: true, seasonYear, categories, playerCount: qualified.length };
  } catch (error: any) {
    console.error("[Leaders Action] Failed:", error);
    return { success: false, seasonYear: 0, categories: [], playerCount: 0, error: error.message };
  }
}
