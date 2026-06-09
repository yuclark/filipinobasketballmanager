"use server";

import { db } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { teams, players, games, playerGameStats } from "@/db/schema";

// Box-Muller transform for Gaussian/Normal distribution
function randomNormal(mean = 0, stdDev = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  if (u1 === 0) return mean;
  const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
  return mean + stdDev * randStdNormal;
}

// Berger tables rotation for Round Robin
function rotateBerger(arr: any[], round: number) {
  const n = arr.length;
  const list = [...arr];
  const roundRotation = round % (n - 1);
  for (let step = 0; step < roundRotation; step++) {
    const last = list.pop()!;
    list.splice(1, 0, last);
  }
  const pairs: [any, any][] = [];
  for (let i = 0; i < n / 2; i++) {
    pairs.push([list[i], list[n - 1 - i]]);
  }
  return pairs;
}

export async function generateScheduleAction(seasonYear: number = 2026) {
  try {
    console.log(`Generating league schedule for season ${seasonYear}...`);
    const allTeams = await db.select().from(teams);
    const luzon = allTeams.filter((t) => t.conference === "Luzon");
    const visMin = allTeams.filter((t) => t.conference === "VisMin");

    if (luzon.length !== 15 || visMin.length !== 15) {
      throw new Error(`Expected exactly 15 Luzon and 15 VisMin teams. Found ${luzon.length} and ${visMin.length}.`);
    }

    await db.delete(games);

    const luzonList = [...luzon, null];
    const visMinList = [...visMin, null];
    const gamesToInsert: Array<typeof games.$inferInsert> = [];

    for (let r = 0; r < 82; r++) {
      const gameNumber = r + 1;
      const luzonPairs = rotateBerger(luzonList, r);
      const visMinPairs = rotateBerger(visMinList, r);

      let luzonBye: any = null;
      let visMinBye: any = null;

      for (const [teamA, teamB] of luzonPairs) {
        if (teamA === null) {
          luzonBye = teamB;
        } else if (teamB === null) {
          luzonBye = teamA;
        } else {
          const home = r % 2 === 0 ? teamA : teamB;
          const away = r % 2 === 0 ? teamB : teamA;
          gamesToInsert.push({
            homeTeamId: home.id,
            awayTeamId: away.id,
            seasonYear,
            gameNumber,
            status: "Scheduled",
          });
        }
      }

      for (const [teamA, teamB] of visMinPairs) {
        if (teamA === null) {
          visMinBye = teamB;
        } else if (teamB === null) {
          visMinBye = teamA;
        } else {
          const home = r % 2 === 0 ? teamA : teamB;
          const away = r % 2 === 0 ? teamB : teamA;
          gamesToInsert.push({
            homeTeamId: home.id,
            awayTeamId: away.id,
            seasonYear,
            gameNumber,
            status: "Scheduled",
          });
        }
      }

      if (luzonBye && visMinBye) {
        const home = r % 2 === 0 ? luzonBye : visMinBye;
        const away = r % 2 === 0 ? visMinBye : luzonBye;
        gamesToInsert.push({
          homeTeamId: home.id,
          awayTeamId: away.id,
          seasonYear,
          gameNumber,
          status: "Scheduled",
        });
      }
    }

    const chunkSize = 100;
    for (let i = 0; i < gamesToInsert.length; i += chunkSize) {
      const chunk = gamesToInsert.slice(i, i + chunkSize);
      await db.insert(games).values(chunk);
    }

    console.log(`Generated ${gamesToInsert.length} games for season ${seasonYear}.`);
    return { success: true, count: gamesToInsert.length };
  } catch (error: any) {
    console.error("Failed to generate schedule:", error);
    return { success: false, error: error.message || "Failed to generate schedule." };
  }
}

export async function getLeagueDayGames(day: number) {
  try {
    const dayGames = await db.select().from(games).where(eq(games.gameNumber, day));
    const allTeams = await db.select().from(teams);
    const teamsMap = new Map(allTeams.map((t) => [t.id, t]));

    return dayGames.map((g) => ({
      ...g,
      homeTeam: teamsMap.get(g.homeTeamId)!,
      awayTeam: teamsMap.get(g.awayTeamId)!,
    }));
  } catch (error) {
    console.error("Failed to fetch games for day:", error);
    return [];
  }
}

export async function getGameBoxScore(gameId: string) {
  try {
    const stats = await db
      .select()
      .from(playerGameStats)
      .where(eq(playerGameStats.gameId, gameId));

    const allPlayers = await db.select().from(players);
    const playersMap = new Map(allPlayers.map((p) => [p.id, p]));

    return stats.map((s) => ({
      ...s,
      player: playersMap.get(s.playerId)!,
    }));
  } catch (error) {
    console.error("Failed to fetch box score:", error);
    return [];
  }
}

interface DBPlayer {
  id: string;
  teamId: string | null;
  firstName: string;
  lastName: string;
  age: number;
  hometown: string;
  isFilAm: boolean;
  overall: number;
  salary: number;
  position: string;
  threePoint: number;
  insideScoring: number;
  playmaking: number;
  perimeterDefense: number;
  interiorDefense: number;
  rebounding: number;
  speed: number;
  stamina: number;
  contractYearsRemaining: number;
  status: string;
}

function simulateGameLogic(
  game: { id: string; homeTeamId: string; awayTeamId: string; stage?: string; playoffRound?: string | null; seriesId?: string | null },
  homePlayersList: DBPlayer[],
  awayPlayersList: DBPlayer[]
) {
  const homePlayers = [...homePlayersList].sort((a, b) => b.overall - a.overall);
  const awayPlayers = [...awayPlayersList].sort((a, b) => b.overall - a.overall);

  if (homePlayers.length === 0 || awayPlayers.length === 0) {
    throw new Error(`Rosters cannot be empty.`);
  }

  const getWeightedAttr = (roster: DBPlayer[], key: keyof DBPlayer): number => {
    return roster.reduce((sum, player, idx) => {
      const weight = idx < 5 ? 0.15 : 0.025;
      const val = player[key] as number;
      return sum + val * weight;
    }, 0);
  };

  const homeORtg =
    getWeightedAttr(homePlayers, "threePoint") * 0.3 +
    getWeightedAttr(homePlayers, "insideScoring") * 0.35 +
    getWeightedAttr(homePlayers, "playmaking") * 0.25 +
    getWeightedAttr(homePlayers, "speed") * 0.1;

  const homeDRtg =
    getWeightedAttr(homePlayers, "perimeterDefense") * 0.3 +
    getWeightedAttr(homePlayers, "interiorDefense") * 0.3 +
    getWeightedAttr(homePlayers, "rebounding") * 0.3 +
    getWeightedAttr(homePlayers, "speed") * 0.1;

  const awayORtg =
    getWeightedAttr(awayPlayers, "threePoint") * 0.3 +
    getWeightedAttr(awayPlayers, "insideScoring") * 0.35 +
    getWeightedAttr(awayPlayers, "playmaking") * 0.25 +
    getWeightedAttr(awayPlayers, "speed") * 0.1;

  const awayDRtg =
    getWeightedAttr(awayPlayers, "perimeterDefense") * 0.3 +
    getWeightedAttr(awayPlayers, "interiorDefense") * 0.3 +
    getWeightedAttr(awayPlayers, "rebounding") * 0.3 +
    getWeightedAttr(awayPlayers, "speed") * 0.1;

  const homeReboundRating = getWeightedAttr(homePlayers, "rebounding");
  const awayReboundRating = getWeightedAttr(awayPlayers, "rebounding");

  const expectedHome = 100 + 3 + (homeORtg - awayDRtg) * 0.5;
  const expectedAway = 100 + (awayORtg - homeDRtg) * 0.5;

  let homeScore = Math.max(70, Math.round(expectedHome + randomNormal(0, 8)));
  let awayScore = Math.max(70, Math.round(expectedAway + randomNormal(0, 8)));

  let otPeriods = 0;
  while (homeScore === awayScore) {
    otPeriods++;
    homeScore += Math.max(2, Math.round(12 + randomNormal(0, 3)));
    awayScore += Math.max(2, Math.round(12 + randomNormal(0, 3)));
  }

  const distributeStats = (
    teamTotal: number,
    roster: DBPlayer[],
    weightFn: (p: DBPlayer, idx: number) => number
  ) => {
    const weights = roster.map((p, idx) => weightFn(p, idx));
    const totalWeight = weights.reduce((s, w) => s + w, 0);

    const stats = new Array(roster.length).fill(0);
    let allocated = 0;

    for (let i = 0; i < roster.length; i++) {
      const share = totalWeight > 0 ? weights[i] / totalWeight : 1 / roster.length;
      stats[i] = Math.floor(teamTotal * share);
      allocated += stats[i];
    }

    let remainder = teamTotal - allocated;
    while (remainder > 0) {
      const idx = Math.floor(Math.random() * roster.length);
      stats[idx]++;
      remainder--;
    }
    return stats;
  };

  const totalHomeRebounds = Math.round(44 + (homeReboundRating - awayReboundRating) * 0.15 + randomNormal(0, 4));
  const totalAwayRebounds = Math.round(44 + (awayReboundRating - homeReboundRating) * 0.15 + randomNormal(0, 4));

  const totalHomeAssists = Math.round(homeScore * 0.22 + randomNormal(0, 2.5));
  const totalAwayAssists = Math.round(awayScore * 0.22 + randomNormal(0, 2.5));

  const totalHomeSteals = Math.max(2, Math.round(homeDRtg * 0.08 + randomNormal(0, 1.5)));
  const totalAwaySteals = Math.max(2, Math.round(awayDRtg * 0.08 + randomNormal(0, 1.5)));

  const totalHomeBlocks = Math.max(1, Math.round(getWeightedAttr(homePlayers, "interiorDefense") * 0.06 + randomNormal(0, 1.5)));
  const totalAwayBlocks = Math.max(1, Math.round(getWeightedAttr(awayPlayers, "interiorDefense") * 0.06 + randomNormal(0, 1.5)));

  const totalHomeTurnovers = Math.max(5, Math.round((100 - getWeightedAttr(homePlayers, "playmaking")) * 0.18 + randomNormal(0, 2)));
  const totalAwayTurnovers = Math.max(5, Math.round((100 - getWeightedAttr(awayPlayers, "playmaking")) * 0.18 + randomNormal(0, 2)));

  const homePoints = distributeStats(homeScore, homePlayers, (p, idx) => p.overall * (idx < 5 ? 3.5 : 1));
  const awayPoints = distributeStats(awayScore, awayPlayers, (p, idx) => p.overall * (idx < 5 ? 3.5 : 1));

  const homeRebounds = distributeStats(totalHomeRebounds, homePlayers, (p, idx) => p.rebounding * (idx < 5 ? 3.5 : 1));
  const awayRebounds = distributeStats(totalAwayRebounds, awayPlayers, (p, idx) => p.rebounding * (idx < 5 ? 3.5 : 1));

  const homeAssists = distributeStats(totalHomeAssists, homePlayers, (p, idx) => p.playmaking * (idx < 5 ? 4.5 : 1));
  const awayAssists = distributeStats(totalAwayAssists, awayPlayers, (p, idx) => p.playmaking * (idx < 5 ? 4.5 : 1));

  const homeSteals = distributeStats(totalHomeSteals, homePlayers, (p, idx) => p.perimeterDefense * (idx < 5 ? 3 : 1));
  const awaySteals = distributeStats(totalAwaySteals, awayPlayers, (p, idx) => p.perimeterDefense * (idx < 5 ? 3 : 1));

  const homeBlocks = distributeStats(totalHomeBlocks, homePlayers, (p, idx) => p.interiorDefense * (idx < 5 ? 3 : 1));
  const awayBlocks = distributeStats(totalAwayBlocks, awayPlayers, (p, idx) => p.interiorDefense * (idx < 5 ? 3 : 1));

  const homeTurnovers = distributeStats(totalHomeTurnovers, homePlayers, (p, idx) => (100 - p.playmaking) * (idx < 5 ? 3 : 1));
  const awayTurnovers = distributeStats(totalAwayTurnovers, awayPlayers, (p, idx) => (100 - p.playmaking) * (idx < 5 ? 3 : 1));

  const playerStatsToInsert: Array<typeof playerGameStats.$inferInsert> = [];

  const addPlayerStats = (
    roster: DBPlayer[],
    ptsArr: number[],
    rebArr: number[],
    astArr: number[],
    stlArr: number[],
    blkArr: number[],
    toArr: number[]
  ) => {
    for (let i = 0; i < roster.length; i++) {
      const p = roster[i];
      const pts = ptsArr[i];
      const rebs = rebArr[i];
      const asts = astArr[i];
      const steals = stlArr[i];
      const blocks = blkArr[i];
      const turnovers = toArr[i];

      const threeProb = p.threePoint / (p.threePoint + p.insideScoring + 1);
      let fg3m = Math.min(Math.floor(pts / 3), Math.round(pts * threeProb * 0.25 + Math.random()));
      let fg2m = Math.round((pts - fg3m * 3) / 2);

      if (fg3m * 3 + fg2m * 2 > pts) {
        fg2m = Math.max(0, fg2m - 1);
      }

      const fgm = fg3m + fg2m;
      const accuracy = p.overall * 0.0035 + 0.25;
      const fga = fgm + Math.max(0, Math.round(fgm * (1 / accuracy - 1) + randomNormal(0, 1.5)));

      const ftm = Math.max(0, pts - fg3m * 3 - fg2m * 2);
      const fta = ftm + Math.max(0, Math.round(ftm * 0.25 + Math.floor(Math.random() * 2)));

      const threeAccuracy = p.threePoint * 0.0035 + 0.2;
      const fg3a = fg3m + Math.max(0, Math.round(fg3m * (1 / threeAccuracy - 1) + Math.random() * 2));

      const minutes = i < 5
        ? Math.floor(Math.random() * 11) + 28
        : Math.floor(Math.random() * 15) + 10;

      playerStatsToInsert.push({
        gameId: game.id,
        playerId: p.id,
        points: pts,
        rebounds: rebs,
        assists: asts,
        steals,
        blocks,
        turnovers,
        fieldGoalsMade: fgm,
        fieldGoalsAttempted: Math.max(fgm, fga),
        minutes,
        threePointMade: fg3m,
        threePointAttempted: Math.max(fg3m, fg3a),
        freeThrowsMade: ftm,
        freeThrowsAttempted: Math.max(ftm, fta),
      });
    }
  };

  addPlayerStats(homePlayers, homePoints, homeRebounds, homeAssists, homeSteals, homeBlocks, homeTurnovers);
  addPlayerStats(awayPlayers, awayPoints, awayRebounds, awayAssists, awaySteals, awayBlocks, awayTurnovers);

  return {
    updatedGame: {
      id: game.id,
      homeScore,
      awayScore,
      status: "Completed" as const,
    },
    playerStatsToInsert,
    overtimes: otPeriods,
  };
}

export async function simulateGameAction(gameId: string) {
  try {
    const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
    if (!game) throw new Error("Game not found.");
    if (game.status === "Completed") return { success: true, game };

    const homePlayersList = await db
      .select()
      .from(players)
      .where(and(eq(players.teamId, game.homeTeamId), eq(players.status, "Active")));
    
    const awayPlayersList = await db
      .select()
      .from(players)
      .where(and(eq(players.teamId, game.awayTeamId), eq(players.status, "Active")));

    const res = simulateGameLogic(
      game,
      homePlayersList as unknown as DBPlayer[],
      awayPlayersList as unknown as DBPlayer[]
    );

    await db.insert(playerGameStats).values(res.playerStatsToInsert);

    const updatedGame = await db
      .update(games)
      .set({
        status: "Completed",
        homeScore: res.updatedGame.homeScore,
        awayScore: res.updatedGame.awayScore,
      })
      .where(eq(games.id, game.id))
      .returning();

    return {
      success: true,
      game: updatedGame[0],
      overtimes: res.overtimes,
    };
  } catch (error: any) {
    console.error("Simulation failed:", error);
    throw error;
  }
}

export async function simulateRemainingDayGames(day: number) {
  try {
    const scheduledGames = await db
      .select()
      .from(games)
      .where(and(eq(games.gameNumber, day), eq(games.status, "Scheduled")));

    const results = [];
    for (const game of scheduledGames) {
      const res = await simulateGameAction(game.id);
      results.push(res);
    }
    return { success: true, count: results.length };
  } catch (error: any) {
    console.error("Failed to simulate remaining day games:", error);
    return { success: false, error: error.message || "Simulation failed." };
  }
}

export async function getStandingsDataAction() {
  try {
    const allTeams = await db.select().from(teams);
    const completedGames = await db
      .select()
      .from(games)
      .where(eq(games.status, "Completed"));

    return { success: true, teams: allTeams, completedGames };
  } catch (error: any) {
    console.error("Failed to fetch standings data:", error);
    return { success: false, error: error.message || "Failed to fetch standings data." };
  }
}

export async function simulateBatchDaysAction(daysToSimulate: number, bypassDeadline: boolean = false) {
  try {
    const allTeams = await db.select().from(teams);
    const allPlayers = await db
      .select()
      .from(players)
      .where(eq(players.status, "Active"));

    const rostersByTeam = new Map<string, typeof players.$inferSelect[]>();
    for (const player of allPlayers) {
      if (player.teamId) {
        if (!rostersByTeam.has(player.teamId)) {
          rostersByTeam.set(player.teamId, []);
        }
        rostersByTeam.get(player.teamId)!.push(player);
      }
    }

    const nextGame = await db
      .select({ day: games.gameNumber })
      .from(games)
      .where(and(eq(games.status, "Scheduled"), eq(games.stage, "Regular")))
      .orderBy(games.gameNumber)
      .limit(1);

    if (nextGame.length === 0) {
      return { status: "SUCCESS", daysSimulated: 0, currentDay: 82 };
    }

    const startDay = nextGame[0].day;
    const endDay = startDay + daysToSimulate - 1;

    let daysSimulated = 0;
    const daysToSimulateList: number[] = [];
    let hitDeadline = false;

    for (let d = startDay; d <= endDay; d++) {
      if (d === 50 && !bypassDeadline) {
        hitDeadline = true;
        break;
      }
      daysToSimulateList.push(d);
    }

    if (daysToSimulateList.length === 0 && hitDeadline) {
      return { status: "DEADLINE_REACHED", daysSimulated: 0, currentDay: 50 };
    }

    if (daysToSimulateList.length > 0) {
      const scheduledGames = await db
        .select()
        .from(games)
        .where(and(
          inArray(games.gameNumber, daysToSimulateList),
          eq(games.status, "Scheduled"),
          eq(games.stage, "Regular")
        ))
        .orderBy(games.gameNumber);

      const gamesByDay = new Map<number, typeof games.$inferSelect[]>();
      for (const game of scheduledGames) {
        if (!gamesByDay.has(game.gameNumber)) {
          gamesByDay.set(game.gameNumber, []);
        }
        gamesByDay.get(game.gameNumber)!.push(game);
      }

      const gamesToUpdate: Array<{ id: string; homeScore: number; awayScore: number }> = [];
      const statsToInsert: Array<typeof playerGameStats.$inferInsert> = [];

      for (const day of daysToSimulateList) {
        const dayGames = gamesByDay.get(day) || [];
        for (const game of dayGames) {
          const homeRoster = rostersByTeam.get(game.homeTeamId) || [];
          const awayRoster = rostersByTeam.get(game.awayTeamId) || [];

          if (homeRoster.length === 0 || awayRoster.length === 0) {
            continue;
          }

          const res = simulateGameLogic(
            game,
            homeRoster as unknown as DBPlayer[],
            awayRoster as unknown as DBPlayer[]
          );
          gamesToUpdate.push(res.updatedGame);
          statsToInsert.push(...res.playerStatsToInsert);
        }
        daysSimulated++;
      }

      if (gamesToUpdate.length > 0) {
        const batchQueries: any[] = [];

        const statChunkSize = 1000;
        for (let i = 0; i < statsToInsert.length; i += statChunkSize) {
          const chunk = statsToInsert.slice(i, i + statChunkSize);
          batchQueries.push(db.insert(playerGameStats).values(chunk));
        }

        for (const g of gamesToUpdate) {
          batchQueries.push(
            db.update(games)
              .set({
                status: "Completed",
                homeScore: g.homeScore,
                awayScore: g.awayScore,
              })
              .where(eq(games.id, g.id))
          );
        }

        const queryChunkSize = 100;
        for (let i = 0; i < batchQueries.length; i += queryChunkSize) {
          const queryChunk = batchQueries.slice(i, i + queryChunkSize);
          await db.batch(queryChunk as any);
        }
      }
    }

    if (hitDeadline) {
      return { status: "DEADLINE_REACHED", daysSimulated, currentDay: 50 };
    }

    const nextGameAfter = await db
      .select({ day: games.gameNumber })
      .from(games)
      .where(and(eq(games.status, "Scheduled"), eq(games.stage, "Regular")))
      .orderBy(games.gameNumber)
      .limit(1);

    const finalDay = nextGameAfter[0]?.day ?? 82;

    return { status: "SUCCESS", daysSimulated, currentDay: finalDay };
  } catch (error: any) {
    console.error("Batch simulation failed:", error);
    return { status: "ERROR", error: error.message || "Failed to run batch simulation.", currentDay: 1 };
  }
}

