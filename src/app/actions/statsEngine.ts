"use server";

import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import { players, playerGameStats, games } from "@/db/schema";

export async function getPlayerStatsAction(playerId: string) {
  try {
    if (!playerId) {
      return { success: false, error: "Player ID is required." };
    }

    const logs = await db
      .select({
        stage: games.stage,
        points: playerGameStats.points,
        rebounds: playerGameStats.rebounds,
        assists: playerGameStats.assists,
        steals: playerGameStats.steals,
        blocks: playerGameStats.blocks,
        turnovers: playerGameStats.turnovers,
        fgm: playerGameStats.fieldGoalsMade,
        fga: playerGameStats.fieldGoalsAttempted,
        minutes: playerGameStats.minutes,
        fg3m: playerGameStats.threePointMade,
        fg3a: playerGameStats.threePointAttempted,
        ftm: playerGameStats.freeThrowsMade,
        fta: playerGameStats.freeThrowsAttempted,
      })
      .from(playerGameStats)
      .innerJoin(games, eq(games.id, playerGameStats.gameId))
      .where(eq(playerGameStats.playerId, playerId));

    const computeAverages = (gameLogs: typeof logs) => {
      const gp = gameLogs.length;
      if (gp === 0) {
        return { gp: 0, min: 0, ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fgPct: 0, fg3Pct: 0, ftPct: 0 };
      }

      const totalMin = gameLogs.reduce((sum, l) => sum + l.minutes, 0);
      const totalPts = gameLogs.reduce((sum, l) => sum + l.points, 0);
      const totalReb = gameLogs.reduce((sum, l) => sum + l.rebounds, 0);
      const totalAst = gameLogs.reduce((sum, l) => sum + l.assists, 0);
      const totalStl = gameLogs.reduce((sum, l) => sum + l.steals, 0);
      const totalBlk = gameLogs.reduce((sum, l) => sum + l.blocks, 0);

      const totalFgm = gameLogs.reduce((sum, l) => sum + l.fgm, 0);
      const totalFga = gameLogs.reduce((sum, l) => sum + l.fga, 0);
      const totalFg3m = gameLogs.reduce((sum, l) => sum + l.fg3m, 0);
      const totalFg3a = gameLogs.reduce((sum, l) => sum + l.fg3a, 0);
      const totalFtm = gameLogs.reduce((sum, l) => sum + l.ftm, 0);
      const totalFta = gameLogs.reduce((sum, l) => sum + l.fta, 0);

      return {
        gp,
        min: Number((totalMin / gp).toFixed(1)),
        ppg: Number((totalPts / gp).toFixed(1)),
        rpg: Number((totalReb / gp).toFixed(1)),
        apg: Number((totalAst / gp).toFixed(1)),
        spg: Number((totalStl / gp).toFixed(1)),
        bpg: Number((totalBlk / gp).toFixed(1)),
        fgPct: totalFga > 0 ? Number(((totalFgm / totalFga) * 100).toFixed(1)) : 0,
        fg3Pct: totalFg3a > 0 ? Number(((totalFg3m / totalFg3a) * 100).toFixed(1)) : 0,
        ftPct: totalFta > 0 ? Number(((totalFtm / totalFta) * 100).toFixed(1)) : 0,
      };
    };

    const regularSeasonLogs = logs.filter((l) => l.stage === "Regular");
    const playoffsLogs = logs.filter((l) => l.stage === "Playoffs");

    return {
      success: true,
      regularSeason: computeAverages(regularSeasonLogs),
      playoffs: computeAverages(playoffsLogs),
      career: computeAverages(logs),
    };
  } catch (error: any) {
    console.error("Failed to compute player stats splits:", error);
    return { success: false, error: error.message || "Failed to load player stats." };
  }
}

export async function getTeamSeasonStatsAction(teamId: string) {
  try {
    if (!teamId) {
      return { success: false, error: "Team ID is required." };
    }

    const statsList = await db
      .select({
        playerId: playerGameStats.playerId,
        stage: games.stage,
        points: playerGameStats.points,
        rebounds: playerGameStats.rebounds,
        assists: playerGameStats.assists,
        steals: playerGameStats.steals,
        blocks: playerGameStats.blocks,
        turnovers: playerGameStats.turnovers,
        fgm: playerGameStats.fieldGoalsMade,
        fga: playerGameStats.fieldGoalsAttempted,
        minutes: playerGameStats.minutes,
        fg3m: playerGameStats.threePointMade,
        fg3a: playerGameStats.threePointAttempted,
        ftm: playerGameStats.freeThrowsMade,
        fta: playerGameStats.freeThrowsAttempted,
      })
      .from(playerGameStats)
      .innerJoin(games, eq(games.id, playerGameStats.gameId))
      .innerJoin(players, eq(players.id, playerGameStats.playerId))
      .where(eq(players.teamId, teamId));

    // Group logs by playerId
    const playerLogsMap: Record<string, typeof statsList> = {};
    for (const log of statsList) {
      if (!playerLogsMap[log.playerId]) {
        playerLogsMap[log.playerId] = [];
      }
      playerLogsMap[log.playerId].push(log);
    }

    const teamPlayers = await db
      .select()
      .from(players)
      .where(eq(players.teamId, teamId));

    const computePlayerAveragesForLogs = (playerId: string, gameLogs: typeof statsList) => {
      const gp = gameLogs.length;
      if (gp === 0) {
        return { playerId, gp: 0, mpg: 0, ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fgPct: 0, fg3Pct: 0, ftPct: 0 };
      }

      const totalMin = gameLogs.reduce((sum, l) => sum + l.minutes, 0);
      const totalPts = gameLogs.reduce((sum, l) => sum + l.points, 0);
      const totalReb = gameLogs.reduce((sum, l) => sum + l.rebounds, 0);
      const totalAst = gameLogs.reduce((sum, l) => sum + l.assists, 0);
      const totalStl = gameLogs.reduce((sum, l) => sum + l.steals, 0);
      const totalBlk = gameLogs.reduce((sum, l) => sum + l.blocks, 0);

      const totalFgm = gameLogs.reduce((sum, l) => sum + l.fgm, 0);
      const totalFga = gameLogs.reduce((sum, l) => sum + l.fga, 0);
      const totalFg3m = gameLogs.reduce((sum, l) => sum + l.fg3m, 0);
      const totalFg3a = gameLogs.reduce((sum, l) => sum + l.fg3a, 0);
      const totalFtm = gameLogs.reduce((sum, l) => sum + l.ftm, 0);
      const totalFta = gameLogs.reduce((sum, l) => sum + l.fta, 0);

      return {
        playerId,
        gp,
        mpg: Number((totalMin / gp).toFixed(1)),
        ppg: Number((totalPts / gp).toFixed(1)),
        rpg: Number((totalReb / gp).toFixed(1)),
        apg: Number((totalAst / gp).toFixed(1)),
        spg: Number((totalStl / gp).toFixed(1)),
        bpg: Number((totalBlk / gp).toFixed(1)),
        fgPct: totalFga > 0 ? Number(((totalFgm / totalFga) * 100).toFixed(1)) : 0,
        fg3Pct: totalFg3a > 0 ? Number(((totalFg3m / totalFg3a) * 100).toFixed(1)) : 0,
        ftPct: totalFta > 0 ? Number(((totalFtm / totalFta) * 100).toFixed(1)) : 0,
      };
    };

    const regularSeason = teamPlayers.map((p) => {
      const logs = (playerLogsMap[p.id] || []).filter((l) => l.stage === "Regular");
      return computePlayerAveragesForLogs(p.id, logs);
    });

    const playoffs = teamPlayers.map((p) => {
      const logs = (playerLogsMap[p.id] || []).filter((l) => l.stage === "Playoffs");
      return computePlayerAveragesForLogs(p.id, logs);
    });

    const career = teamPlayers.map((p) => {
      const logs = playerLogsMap[p.id] || [];
      return computePlayerAveragesForLogs(p.id, logs);
    });

    return {
      success: true,
      regularSeason,
      playoffs,
      career,
    };
  } catch (error: any) {
    console.error("Failed to fetch team season stats splits:", error);
    return { success: false, error: error.message || "Failed to calculate team splits." };
  }
}
