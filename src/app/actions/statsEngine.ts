"use server";

import { db } from "@/db";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { players, playerGameStats, games, teams } from "@/db/schema";


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

    // Fetch current season year from games table
    const lastGame = await db
      .select({ year: games.seasonYear })
      .from(games)
      .orderBy(desc(games.seasonYear))
      .limit(1);
    const currentSeasonYear = lastGame[0]?.year ?? 2026;

    // Fetch team games to calculate wins
    const teamGames = await db
      .select({
        homeTeamId: games.homeTeamId,
        awayTeamId: games.awayTeamId,
        homeScore: games.homeScore,
        awayScore: games.awayScore,
        status: games.status,
      })
      .from(games)
      .where(and(eq(games.stage, "Regular"), eq(games.seasonYear, currentSeasonYear)));

    let teamWins = 0;
    for (const g of teamGames) {
      if (g.status !== "Completed") continue;
      const isHome = g.homeTeamId === teamId;
      const myScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;
      if (myScore > oppScore) teamWins++;
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
        return { playerId, gp: 0, mpg: 0, ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fgPct: 0, fg3Pct: 0, ftPct: 0, per: 0, winShares: 0 };
      }

      const totalMin = gameLogs.reduce((sum, l) => sum + l.minutes, 0);
      const totalPts = gameLogs.reduce((sum, l) => sum + l.points, 0);
      const totalReb = gameLogs.reduce((sum, l) => sum + l.rebounds, 0);
      const totalAst = gameLogs.reduce((sum, l) => sum + l.assists, 0);
      const totalStl = gameLogs.reduce((sum, l) => sum + l.steals, 0);
      const totalBlk = gameLogs.reduce((sum, l) => sum + l.blocks, 0);
      const totalTov = gameLogs.reduce((sum, l) => sum + l.turnovers, 0);

      const totalFgm = gameLogs.reduce((sum, l) => sum + l.fgm, 0);
      const totalFga = gameLogs.reduce((sum, l) => sum + l.fga, 0);
      const totalFg3m = gameLogs.reduce((sum, l) => sum + l.fg3m, 0);
      const totalFg3a = gameLogs.reduce((sum, l) => sum + l.fg3a, 0);
      const totalFtm = gameLogs.reduce((sum, l) => sum + l.ftm, 0);
      const totalFta = gameLogs.reduce((sum, l) => sum + l.fta, 0);

      const avgMin = totalMin / gp;
      let rawPer = 0;
      if (totalMin > 0) {
        rawPer = ((totalPts + totalReb * 1.2 + totalAst * 1.5 + totalStl * 2.0 + totalBlk * 2.0 - totalTov * 1.5 - (totalFga - totalFgm) * 0.8 - (totalFta - totalFtm) * 0.4) / totalMin) * 15;
      }
      
      const p = teamPlayers.find((pl) => pl.id === playerId);
      let per = rawPer;
      if (p && avgMin < 5) {
        per = (rawPer * avgMin + p.overall * (5 - avgMin)) / 5;
      }

      const winShares = (totalPts * 0.03 + totalReb * 0.05 + totalAst * 0.04 + totalStl * 0.1 + totalBlk * 0.1 - totalTov * 0.08) * (teamWins / 82) * 4.5;

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
        per: Number(per.toFixed(1)),
        winShares: Number(winShares.toFixed(2)),
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

export async function getGameBoxScoreAction(gameId: string) {
  try {
    const stats = await db
      .select({
        name: sql<string>`${players.firstName} || ' ' || ${players.lastName}`,
        position: players.position,
        isFilAm: players.isFilAm,
        teamId: players.teamId,
        minutes: playerGameStats.minutes,
        points: playerGameStats.points,
        rebounds: playerGameStats.rebounds,
        assists: playerGameStats.assists,
        steals: playerGameStats.steals,
        blocks: playerGameStats.blocks,
        turnovers: playerGameStats.turnovers,
        fgm: playerGameStats.fieldGoalsMade,
        fga: playerGameStats.fieldGoalsAttempted,
        threepm: playerGameStats.threePointMade,
        threepa: playerGameStats.threePointAttempted,
        ftm: playerGameStats.freeThrowsMade,
        fta: playerGameStats.freeThrowsAttempted,
      })
      .from(playerGameStats)
      .innerJoin(players, eq(playerGameStats.playerId, players.id))
      .where(eq(playerGameStats.gameId, gameId))
      .orderBy(desc(playerGameStats.points));

    const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
    if (game.length === 0) {
      return { userTeam: [], opponentTeam: [] };
    }
    const homeTeamId = game[0].homeTeamId;
    const awayTeamId = game[0].awayTeamId;

    return {
      userTeam: stats.filter(s => s.teamId === homeTeamId),
      opponentTeam: stats.filter(s => s.teamId === awayTeamId),
    };
  } catch (error) {
    console.error("Failed to fetch game box score action:", error);
    return { userTeam: [], opponentTeam: [] };
  }
}

export async function getTeamScheduleAction(teamId: string) {
  try {
    if (!teamId) return [];

    const list = await db
      .select({
        id: games.id,
        gameNumber: games.gameNumber,
        status: games.status,
        homeTeamId: games.homeTeamId,
        awayTeamId: games.awayTeamId,
        homeScore: games.homeScore,
        awayScore: games.awayScore,
        seasonYear: games.seasonYear,
      })
      .from(games)
      .where(or(eq(games.homeTeamId, teamId), eq(games.awayTeamId, teamId)))
      .orderBy(games.gameNumber);

    const allTeams = await db.select().from(teams);
    const teamsMap = new Map(allTeams.map((t) => [t.id, t]));

    return list.map((g) => {
      const isHome = g.homeTeamId === teamId;
      const oppId = isHome ? g.awayTeamId : g.homeTeamId;
      const opp = teamsMap.get(oppId);
      const user = teamsMap.get(teamId);

      const userScore = isHome ? g.homeScore : g.awayScore;
      const opponentScore = isHome ? g.awayScore : g.homeScore;
      const userWon = userScore > opponentScore;

      return {
        id: g.id,
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        date: `Day ${g.gameNumber}`,
        opponentName: opp ? `${opp.city} ${opp.name}` : "Unknown",
        userScore,
        opponentScore,
        userWon,
        status: g.status,
        userTeamName: user ? `${user.city} ${user.name}` : "Your Team",
      };
    });
  } catch (error) {
    console.error("Failed to fetch team schedule:", error);
    return [];
  }
}
