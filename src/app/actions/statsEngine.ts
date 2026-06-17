"use server";

import { db } from "@/db";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { players, playerGameStats, games, teams, playerAwards, allLeagueTeams, playerSalaryHistory, playerEvolutions } from "@/db/schema";


export async function getPlayerStatsAction(playerId: string) {
  try {
    if (!playerId) {
      return { success: false, error: "Player ID is required." };
    }

    // Fetch current season year from games table
    const lastGame = await db
      .select({ year: games.seasonYear })
      .from(games)
      .orderBy(desc(games.seasonYear))
      .limit(1);
    const currentSeasonYear = lastGame[0]?.year ?? 2026;

    // Fetch player overall rating and teamId
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    // Fetch team wins for winShares calculation
    let teamWins = 0;
    if (player && player.teamId) {
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

      for (const g of teamGames) {
        if (g.status !== "Completed") continue;
        const isHome = g.homeTeamId === player.teamId;
        const myScore = isHome ? g.homeScore : g.awayScore;
        const oppScore = isHome ? g.awayScore : g.homeScore;
        if (myScore > oppScore) teamWins++;
      }
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
        return { gp: 0, min: 0, ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fgPct: 0, fg3Pct: 0, ftPct: 0, per: 0, winShares: 0 };
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
      
      let per = rawPer;
      if (player && avgMin < 5) {
        per = (rawPer * avgMin + player.overall * (5 - avgMin)) / 5;
      }

      const winShares = (totalPts * 0.03 + totalReb * 0.05 + totalAst * 0.04 + totalStl * 0.1 + totalBlk * 0.1 - totalTov * 0.08) * (teamWins / 82) * 4.5;

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
        per: Number(per.toFixed(1)),
        winShares: Number(winShares.toFixed(2)),
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
        playerId: players.id,
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

// Helper for deterministic random number generator
function seedRandom(seedStr: string) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  }
  return function() {
    let t = h += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateDeterministicStatsForSeason(player: any, age: number, randFn: () => number, isPlayoffs: boolean) {
  let ageFactor = 1.0;
  if (age < 26) {
    ageFactor = 0.90 + (age - 21) * 0.02;
  } else if (age > 30) {
    ageFactor = 1.0 - (age - 30) * 0.02;
  }
  ageFactor = Math.max(0.75, Math.min(1.0, ageFactor));

  const overall = player.overall * ageFactor;
  const insideScoring = player.insideScoring * ageFactor;
  const threePoint = player.threePoint * ageFactor;
  const playmaking = player.playmaking * ageFactor;
  const defense = ((player.perimeterDefense + player.interiorDefense) / 2) * ageFactor;
  const rebounding = player.rebounding * ageFactor;
  const speed = player.speed * ageFactor;

  const gp = Math.round(isPlayoffs ? (4 + randFn() * 12) : (60 + randFn() * 22));
  
  let mp = 10 + ((overall - 55) / (90 - 55)) * 25 + randFn() * 4;
  mp = Math.max(5, Math.min(40, mp));

  const gs = Math.round(gp * (mp > 24 ? (0.7 + randFn() * 0.3) : (randFn() * 0.3)));

  const baseFGA = (mp / 30) * (5 + ((insideScoring + threePoint) / 2 - 55) * 0.15) + randFn() * 2;
  const fga = Math.max(1, Number(baseFGA.toFixed(1)));

  const fgPct = 0.40 + ((insideScoring - 55) / (90 - 55)) * 0.12 + randFn() * 0.04;
  const fgPctClamped = Math.max(0.32, Math.min(0.65, fgPct));
  const fgm = Number((fga * fgPctClamped).toFixed(1));

  let fg3a = 0;
  let fg3Pct = 0;
  let fg3m = 0;
  if (player.position !== "C" && player.position !== "PF" || threePoint > 72) {
    fg3a = (mp / 30) * (((threePoint - 55) / (90 - 55)) * 5) + randFn() * 1.5;
    fg3a = Math.max(0, Number(fg3a.toFixed(1)));
    if (fg3a > 0) {
      fg3Pct = 0.25 + ((threePoint - 55) / (90 - 55)) * 0.13 + randFn() * 0.04;
      fg3Pct = Math.max(0.15, Math.min(0.50, fg3Pct));
      fg3m = Number((fg3a * fg3Pct).toFixed(1));
    }
  }

  const fta = Math.max(0.2, Number((fga * (0.15 + randFn() * 0.15)).toFixed(1)));
  const ftPct = 0.60 + ((threePoint - 55) / (90 - 55)) * 0.22 + randFn() * 0.05;
  const ftPctClamped = Math.max(0.45, Math.min(0.95, ftPct));
  const ftm = Number((fta * ftPctClamped).toFixed(1));

  let trb = 0;
  if (player.position === "PG") trb = 2.0 + ((rebounding - 55) / (90 - 55)) * 2.5 + randFn() * 1.0;
  else if (player.position === "SG") trb = 2.5 + ((rebounding - 55) / (90 - 55)) * 3.0 + randFn() * 1.2;
  else if (player.position === "SF") trb = 3.5 + ((rebounding - 55) / (90 - 55)) * 4.5 + randFn() * 1.5;
  else if (player.position === "PF") trb = 5.5 + ((rebounding - 55) / (90 - 55)) * 6.5 + randFn() * 2.0;
  else if (player.position === "C") trb = 7.0 + ((rebounding - 55) / (90 - 55)) * 7.5 + randFn() * 2.5;
  trb = Math.max(0.5, Number(trb.toFixed(1)));
  
  const orb = Number((trb * (player.position === "C" || player.position === "PF" ? 0.32 : 0.15)).toFixed(1));
  const drb = Number((trb - orb).toFixed(1));

  let ast = 0;
  if (player.position === "PG") ast = 4.0 + ((playmaking - 55) / (90 - 55)) * 5.5 + randFn() * 1.5;
  else if (player.position === "SG") ast = 2.0 + ((playmaking - 55) / (90 - 55)) * 3.5 + randFn() * 1.0;
  else if (player.position === "SF") ast = 1.5 + ((playmaking - 55) / (90 - 55)) * 2.5 + randFn() * 0.8;
  else if (player.position === "PF") ast = 1.0 + ((playmaking - 55) / (90 - 55)) * 1.5 + randFn() * 0.5;
  else if (player.position === "C") ast = 0.5 + ((playmaking - 55) / (90 - 55)) * 1.5 + randFn() * 0.5;
  ast = Math.max(0.2, Number(ast.toFixed(1)));

  const stl = Math.max(0.1, Number(((defense / 65) * 1.2 + speed * 0.005 + randFn() * 0.4).toFixed(1)));

  let blk = 0.1;
  if (player.position === "C") blk = 0.8 + ((player.interiorDefense - 55) / 35) * 1.5 + randFn() * 0.5;
  else if (player.position === "PF") blk = 0.5 + ((player.interiorDefense - 55) / 35) * 1.0 + randFn() * 0.4;
  else blk = 0.1 + ((player.perimeterDefense - 55) / 35) * 0.4 + randFn() * 0.2;
  blk = Math.max(0.0, Number(blk.toFixed(1)));

  const tov = Math.max(0.5, Number((3.0 - ((playmaking - 55) / (90 - 55)) * 1.5 + randFn() * 0.5).toFixed(1)));
  const pf = Math.max(1.0, Number((1.5 + randFn() * 1.8).toFixed(1)));
  const pts = Number(((fgm - fg3m) * 2 + fg3m * 3 + ftm).toFixed(1));

  let rawPer = ((pts + trb * 1.2 + ast * 1.5 + stl * 2.0 + blk * 2.0 - tov * 1.5 - (fga - fgm) * 0.8 - (fta - ftm) * 0.4) / mp) * 15;
  if (mp < 5) rawPer = (rawPer * mp + player.overall * (5 - mp)) / 5;
  const per = Number(Math.max(3.0, Math.min(35.0, rawPer)).toFixed(1));
  const ws = Number(Math.max(-0.5, (pts * 0.03 + trb * 0.05 + ast * 0.04 + stl * 0.1 + blk * 0.1 - tov * 0.08) * (gp / 82) * 4.5).toFixed(2));

  return {
    gp,
    gs,
    mp: Number(mp.toFixed(1)),
    fgm,
    fga,
    fgPct: Number((fgPctClamped * 100).toFixed(1)),
    fg3m,
    fg3a,
    fg3Pct: fg3a > 0 ? Number((fg3Pct * 100).toFixed(1)) : 0,
    ftm,
    fta,
    ftPct: Number((ftPctClamped * 100).toFixed(1)),
    orb,
    drb,
    trb,
    ast,
    stl,
    blk,
    tov,
    pf,
    pts,
    per,
    winShares: ws
  };
}

export async function getPlayerProfileAction(playerId: string) {
  try {
    if (!playerId) {
      return { success: false, error: "Player ID is required." };
    }

    const [playerData] = await db
      .select({
        id: players.id,
        teamId: players.teamId,
        firstName: players.firstName,
        lastName: players.lastName,
        age: players.age,
        hometown: players.hometown,
        isFilAm: players.isFilAm,
        overall: players.overall,
        salary: players.salary,
        position: players.position,
        threePoint: players.threePoint,
        insideScoring: players.insideScoring,
        playmaking: players.playmaking,
        perimeterDefense: players.perimeterDefense,
        interiorDefense: players.interiorDefense,
        rebounding: players.rebounding,
        speed: players.speed,
        stamina: players.stamina,
        contractYearsRemaining: players.contractYearsRemaining,
        status: players.status,
        isRookie: players.isRookie,
        injuryDaysRemaining: players.injuryDaysRemaining,
        injuryType: players.injuryType,
        isOnTradeBlock: players.isOnTradeBlock,
        yearsPlayed: players.yearsPlayed,
        draftRound: players.draftRound,
        draftPick: players.draftPick,
        draftYear: players.draftYear,
        
        teamName: sql<string>`coalesce(concat(${teams.city}, ' ', ${teams.name}), 'Free Agent')`,
        teamCity: teams.city,
        teamNickname: teams.name,
        teamConference: teams.conference,
      })
      .from(players)
      .leftJoin(teams, eq(players.teamId, teams.id))
      .where(eq(players.id, playerId))
      .limit(1);

    if (!playerData) {
      return { success: false, error: "Player not found." };
    }

    const allTeams = await db.select().from(teams);
    const teamsMap = new Map(allTeams.map((t) => [t.id, t]));

    const lastGame = await db
      .select({ year: games.seasonYear })
      .from(games)
      .orderBy(desc(games.seasonYear))
      .limit(1);
    const currentSeasonYear = lastGame[0]?.year ?? 2026;

    const bioRand = seedRandom(playerData.id + "_bio");
    const shoots = bioRand() < 0.88 ? "Right" : "Left";
    
    const colleges = [
      "Ateneo de Manila University", "De La Salle University", "University of the Philippines",
      "University of Santo Tomas", "Far Eastern University", "National University",
      "Adamson University", "University of the East", "San Beda University",
      "Colegio de San Juan de Letran", "Lyceum of the Philippines University", "Mapúa University",
      "San Sebastian College - Recoletos", "Arellano University", "Jose Rizal University",
      "Emilio Aguinaldo College", "University of Perpetual Help System DALTA"
    ];
    const college = colleges[Math.floor(bioRand() * colleges.length)];
    
    let height = "6-2";
    let heightCm = 188;
    let weight = 195;
    let weightKg = 88;
    
    if (playerData.position === "PG") {
      const hInches = Math.floor(69 + bioRand() * 6);
      height = `${Math.floor(hInches / 12)}-${hInches % 12}`;
      heightCm = Math.round(hInches * 2.54);
      weight = Math.round(160 + bioRand() * 30);
      weightKg = Math.round(weight * 0.45359237);
    } else if (playerData.position === "SG") {
      const hInches = Math.floor(73 + bioRand() * 5);
      height = `${Math.floor(hInches / 12)}-${hInches % 12}`;
      heightCm = Math.round(hInches * 2.54);
      weight = Math.round(180 + bioRand() * 30);
      weightKg = Math.round(weight * 0.45359237);
    } else if (playerData.position === "SF") {
      const hInches = Math.floor(76 + bioRand() * 5);
      height = `${Math.floor(hInches / 12)}-${hInches % 12}`;
      heightCm = Math.round(hInches * 2.54);
      weight = Math.round(200 + bioRand() * 30);
      weightKg = Math.round(weight * 0.45359237);
    } else if (playerData.position === "PF") {
      const hInches = Math.floor(79 + bioRand() * 4);
      height = `${Math.floor(hInches / 12)}-${hInches % 12}`;
      heightCm = Math.round(hInches * 2.54);
      weight = Math.round(220 + bioRand() * 30);
      weightKg = Math.round(weight * 0.45359237);
    } else if (playerData.position === "C") {
      const hInches = Math.floor(81 + bioRand() * 6);
      height = `${Math.floor(hInches / 12)}-${hInches % 12}`;
      heightCm = Math.round(hInches * 2.54);
      weight = Math.round(235 + bioRand() * 45);
      weightKg = Math.round(weight * 0.45359237);
    }

    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthIdx = Math.floor(bioRand() * 12);
    const birthMonth = months[monthIdx];
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const birthDay = Math.floor(1 + bioRand() * daysInMonth[monthIdx]);
    const birthYear = 2026 - playerData.age;
    const dob = `${birthMonth} ${birthDay}, ${birthYear}`;

    const dbLogs = await db
      .select({
        gameId: games.id,
        seasonYear: games.seasonYear,
        gameNumber: games.gameNumber,
        stage: games.stage,
        status: games.status,
        homeTeamId: games.homeTeamId,
        awayTeamId: games.awayTeamId,
        homeScore: games.homeScore,
        awayScore: games.awayScore,
        
        minutes: playerGameStats.minutes,
        points: playerGameStats.points,
        rebounds: playerGameStats.rebounds,
        assists: playerGameStats.assists,
        steals: playerGameStats.steals,
        blocks: playerGameStats.blocks,
        turnovers: playerGameStats.turnovers,
        fgm: playerGameStats.fieldGoalsMade,
        fga: playerGameStats.fieldGoalsAttempted,
        fg3m: playerGameStats.threePointMade,
        fg3a: playerGameStats.threePointAttempted,
        ftm: playerGameStats.freeThrowsMade,
        fta: playerGameStats.freeThrowsAttempted,
      })
      .from(playerGameStats)
      .innerJoin(games, eq(games.id, playerGameStats.gameId))
      .where(eq(playerGameStats.playerId, playerId))
      .orderBy(desc(games.gameNumber));

    const formattedLogs = dbLogs.map(l => {
      const isHome = l.homeTeamId === playerData.teamId;
      const myTeamId = isHome ? l.homeTeamId : l.awayTeamId;
      const oppTeamId = isHome ? l.awayTeamId : l.homeTeamId;
      const myScore = isHome ? l.homeScore : l.awayScore;
      const oppScore = isHome ? l.awayScore : l.homeScore;
      const won = myScore > oppScore;
      
      const oppTeam = teamsMap.get(oppTeamId);
      const myTeam = teamsMap.get(myTeamId);
      
      return {
        gameId: l.gameId,
        seasonYear: l.seasonYear,
        gameNumber: l.gameNumber,
        stage: l.stage,
        status: l.status,
        minutes: l.minutes,
        points: l.points,
        rebounds: l.rebounds,
        assists: l.assists,
        steals: l.steals,
        blocks: l.blocks,
        turnovers: l.turnovers,
        fgm: l.fgm,
        fga: l.fga,
        fg3m: l.fg3m,
        fg3a: l.fg3a,
        ftm: l.ftm,
        fta: l.fta,
        isHome,
        opponentName: oppTeam ? `${oppTeam.city} ${oppTeam.name}` : "Unknown Team",
        myTeamName: myTeam ? `${myTeam.city} ${myTeam.name}` : "Unknown Team",
        won,
        scoreText: `${myScore}-${oppScore}`,
      };
    });

    const computeAverages = (gameLogs: typeof dbLogs, stage: string) => {
      const gp = gameLogs.length;
      if (gp === 0) return null;

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
      let per = rawPer;
      if (avgMin < 5) {
        per = (rawPer * avgMin + playerData.overall * (5 - avgMin)) / 5;
      }

      let teamWins = 0;
      if (playerData.teamId) {
        const teamGames = dbLogs.filter(l => l.stage === "Regular" && l.status === "Completed");
        for (const g of teamGames) {
          const isHome = g.homeTeamId === playerData.teamId;
          const myScore = isHome ? g.homeScore : g.awayScore;
          const oppScore = isHome ? g.awayScore : g.homeScore;
          if (myScore > oppScore) teamWins++;
        }
      }
      const winShares = (totalPts * 0.03 + totalReb * 0.05 + totalAst * 0.04 + totalStl * 0.1 + totalBlk * 0.1 - totalTov * 0.08) * (teamWins / 82) * 4.5;

      const orbPct = playerData.position === "C" || playerData.position === "PF" ? 0.32 : 0.15;
      const rpg = totalReb / gp;
      const orb = Number((rpg * orbPct).toFixed(1));
      const drb = Number((rpg - orb).toFixed(1));

      return {
        seasonYear: currentSeasonYear,
        age: playerData.age,
        teamId: playerData.teamId,
        teamName: playerData.teamId ? `${teamsMap.get(playerData.teamId)?.city} ${teamsMap.get(playerData.teamId)?.name}` : "Free Agent",
        stage,
        gp,
        gs: gameLogs.filter(l => l.minutes >= 25).length,
        mp: Number((totalMin / gp).toFixed(1)),
        fgm: Number((totalFgm / gp).toFixed(1)),
        fga: Number((totalFga / gp).toFixed(1)),
        fgPct: totalFga > 0 ? Number(((totalFgm / totalFga) * 100).toFixed(1)) : 0,
        fg3m: Number((totalFg3m / gp).toFixed(1)),
        fg3a: Number((totalFg3a / gp).toFixed(1)),
        fg3Pct: totalFg3a > 0 ? Number(((totalFg3m / totalFg3a) * 100).toFixed(1)) : 0,
        ftm: Number((totalFtm / gp).toFixed(1)),
        fta: Number((totalFta / gp).toFixed(1)),
        ftPct: totalFta > 0 ? Number(((totalFtm / totalFta) * 100).toFixed(1)) : 0,
        orb,
        drb,
        trb: Number((totalReb / gp).toFixed(1)),
        ast: Number((totalAst / gp).toFixed(1)),
        stl: Number((totalStl / gp).toFixed(1)),
        blk: Number((totalBlk / gp).toFixed(1)),
        tov: Number((totalTov / gp).toFixed(1)),
        pf: Number((2.0).toFixed(1)),
        pts: Number((totalPts / gp).toFixed(1)),
        per: Number(per.toFixed(1)),
        winShares: Number(winShares.toFixed(2)),
      };
    };

    const dbRegularSplit = computeAverages(dbLogs.filter(l => l.stage === "Regular" && l.status === "Completed"), "Regular");
    const dbPlayoffsSplit = computeAverages(dbLogs.filter(l => l.stage === "Playoffs" && l.status === "Completed"), "Playoffs");

    const yearsInLeague = playerData.yearsPlayed;
    const startYear = Math.max(2026, currentSeasonYear - Math.max(0, yearsInLeague));

    const simulatedSeasons: any[] = [];
    const simulatedPlayoffs: any[] = [];

    for (let y = startYear; y < currentSeasonYear; y++) {
      const seasonAge = playerData.age - (currentSeasonYear - y);
      
      const teamRand = seedRandom(playerData.id + "_" + y + "_team");
      const historicalTeam = allTeams.length > 0 ? allTeams[Math.floor(teamRand() * allTeams.length)] : null;
      const teamName = historicalTeam ? `${historicalTeam.city} ${historicalTeam.name}` : "Free Agent";
      const teamId = historicalTeam ? historicalTeam.id : null;

      const regRand = seedRandom(playerData.id + "_" + y + "_reg");
      const regStats = generateDeterministicStatsForSeason(playerData, seasonAge, regRand, false);
      simulatedSeasons.push({
        seasonYear: y,
        age: seasonAge,
        teamId,
        teamName,
        stage: "Regular",
        ...regStats
      });

      const pofRand = seedRandom(playerData.id + "_" + y + "_pof");
      if (pofRand() < 0.4) {
        const pofStats = generateDeterministicStatsForSeason(playerData, seasonAge, pofRand, true);
        simulatedPlayoffs.push({
          seasonYear: y,
          age: seasonAge,
          teamId,
          teamName,
          stage: "Playoffs",
          ...pofStats
        });
      }
    }

    const allRegularSeasons = [...simulatedSeasons];
    if (dbRegularSplit) allRegularSeasons.push(dbRegularSplit);

    const allPlayoffSeasons = [...simulatedPlayoffs];
    if (dbPlayoffsSplit) allPlayoffSeasons.push(dbPlayoffsSplit);

    const calculateCareerAverages = (seasonsList: any[]) => {
      const totalGp = seasonsList.reduce((sum, s) => sum + s.gp, 0);
      if (totalGp === 0) return null;

      const totalGs = seasonsList.reduce((sum, s) => sum + s.gs, 0);
      
      const weightedAvg = (key: string) => {
        const total = seasonsList.reduce((sum, s) => sum + s[key] * s.gp, 0);
        return Number((total / totalGp).toFixed(1));
      };

      const weightedPct = (madeKey: string, attKey: string) => {
        const totalMade = seasonsList.reduce((sum, s) => sum + s[madeKey] * s.gp, 0);
        const totalAtt = seasonsList.reduce((sum, s) => sum + s[attKey] * s.gp, 0);
        return totalAtt > 0 ? Number(((totalMade / totalAtt) * 100).toFixed(1)) : 0;
      };

      const totalWinShares = seasonsList.reduce((sum, s) => sum + s.winShares, 0);

      return {
        gp: totalGp,
        gs: totalGs,
        mp: weightedAvg("mp"),
        fgm: weightedAvg("fgm"),
        fga: weightedAvg("fga"),
        fgPct: weightedPct("fgm", "fga"),
        fg3m: weightedAvg("fg3m"),
        fg3a: weightedAvg("fg3a"),
        fg3Pct: weightedPct("fg3m", "fg3a"),
        ftm: weightedAvg("ftm"),
        fta: weightedAvg("fta"),
        ftPct: weightedPct("ftm", "fta"),
        orb: weightedAvg("orb"),
        drb: weightedAvg("drb"),
        trb: weightedAvg("trb"),
        ast: weightedAvg("ast"),
        stl: weightedAvg("stl"),
        blk: weightedAvg("blk"),
        tov: weightedAvg("tov"),
        pf: weightedAvg("pf"),
        pts: weightedAvg("pts"),
        per: weightedAvg("per"),
        winShares: Number(totalWinShares.toFixed(2)),
      };
    };

    const regularCareer = calculateCareerAverages(allRegularSeasons);
    const playoffCareer = calculateCareerAverages(allPlayoffSeasons);

    const awards = await db
      .select({
        seasonYear: playerAwards.seasonYear,
        awardType: playerAwards.awardType,
        teamName: sql<string>`coalesce(concat(${teams.city}, ' ', ${teams.name}), '')`
      })
      .from(playerAwards)
      .leftJoin(teams, eq(playerAwards.teamId, teams.id))
      .where(eq(playerAwards.playerId, playerId))
      .orderBy(desc(playerAwards.seasonYear));

    const allLeague = await db
      .select({
        seasonYear: allLeagueTeams.seasonYear,
        type: allLeagueTeams.type,
        position: allLeagueTeams.position
      })
      .from(allLeagueTeams)
      .where(eq(allLeagueTeams.playerId, playerId))
      .orderBy(desc(allLeagueTeams.seasonYear));

    const formattedAwards: string[] = [];
    awards.forEach(a => {
      const typeLabel = a.awardType === "MVP" ? "Most Valuable Player"
        : a.awardType === "ROY" ? "Rookie of the Year"
        : a.awardType === "DPOY" ? "Defensive Player of the Year"
        : a.awardType === "6MOTY" ? "Sixth Man of the Year"
        : a.awardType === "FMVP" ? "Finals MVP"
        : a.awardType;
      formattedAwards.push(`${a.seasonYear} ${typeLabel}`);
    });

    allLeague.forEach(al => {
      formattedAwards.push(`${al.seasonYear} ${al.type} Team (${al.position})`);
    });

    const salaryHistory = await db
      .select({
        seasonYear: playerSalaryHistory.seasonYear,
        salary: playerSalaryHistory.salary,
        teamId: playerSalaryHistory.teamId,
        teamName: sql<string>`coalesce(concat(${teams.city}, ' ', ${teams.name}), 'Free Agent')`,
        teamCity: teams.city,
        teamNickname: teams.name,
      })
      .from(playerSalaryHistory)
      .leftJoin(teams, eq(playerSalaryHistory.teamId, teams.id))
      .where(eq(playerSalaryHistory.playerId, playerId))
      .orderBy(desc(playerSalaryHistory.seasonYear));

    const evolutions = await db
      .select({
        id: playerEvolutions.id,
        seasonYear: playerEvolutions.seasonYear,
        gameDay: playerEvolutions.gameDay,
        oldOverall: playerEvolutions.oldOverall,
        newOverall: playerEvolutions.newOverall,
        attributeChangesJson: playerEvolutions.attributeChangesJson,
      })
      .from(playerEvolutions)
      .where(eq(playerEvolutions.playerId, playerId))
      .orderBy(desc(playerEvolutions.seasonYear), desc(playerEvolutions.gameDay));

    return {
      success: true,
      player: {
        ...playerData,
        shoots,
        college,
        height,
        heightCm,
        weight,
        weightKg,
        dob,
      },
      regularSeasonHistory: allRegularSeasons,
      playoffHistory: allPlayoffSeasons,
      careerRegular: regularCareer,
      careerPlayoffs: playoffCareer,
      logs: formattedLogs,
      awards: formattedAwards,
      salaryHistory,
      evolutions,
      currentSeasonYear,
    };
  } catch (error: any) {
    console.error("Failed to load player profile action:", error);
    return { success: false, error: error.message || "Failed to load player profile." };
  }
}
