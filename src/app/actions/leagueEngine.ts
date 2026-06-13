"use server";

import { db } from "@/db";
import { eq, and, inArray, sql, isNotNull } from "drizzle-orm";
import { teams, players, games, playerGameStats, transactions } from "@/db/schema";
import { MIN_ROSTER_SIZE, MAX_ROSTER_SIZE } from "@/lib/constants";
import { calculateRegularSeasonAwardsAction } from "@/app/actions/awardsEngine";
import { enforceLeagueRosterLimitsAction, runCpuDailyAiEngineAction } from "@/app/actions/cpuAiEngine";
import { generateTradeProposalsAction } from "@/app/actions/tradeEngine";

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

export async function simulateCpuTradesAction(
  gameDay: number,
  seasonYear: number,
  userTeamId?: string | null
) {
  try {
    if (gameDay >= 50) return null;
    if (Math.random() >= 0.10) return null; // 10% chance of execution

    console.log(`[CPU Trade Engine] Attempting trade on Day ${gameDay}, Season ${seasonYear}`);

    const allTeams = await db.select().from(teams);
    const cpuTeams = allTeams.filter((t) => t.id !== userTeamId);
    if (cpuTeams.length < 2) return null;

    const cpuTeamIds = cpuTeams.map((t) => t.id);
    const allCpuPlayers = await db
      .select()
      .from(players)
      .where(and(inArray(players.teamId, cpuTeamIds), eq(players.status, "Active")));

    const rosterByTeam = new Map<string, typeof players.$inferSelect[]>();
    for (const p of allCpuPlayers) {
      if (p.teamId) {
        if (!rosterByTeam.has(p.teamId)) {
          rosterByTeam.set(p.teamId, []);
        }
        rosterByTeam.get(p.teamId)!.push(p);
      }
    }

    const getPositionClass = (pos: string): "G" | "F" | "C" | null => {
      const p = pos.toUpperCase();
      if (p === "PG" || p === "SG" || p === "G") return "G";
      if (p === "SF" || p === "PF" || p === "F") return "F";
      if (p === "C") return "C";
      return null;
    };

    const shuffledTeams = [...cpuTeams].sort(() => Math.random() - 0.5);

    for (const teamA of shuffledTeams) {
      const rosterA = rosterByTeam.get(teamA.id) || [];
      if (rosterA.length < MIN_ROSTER_SIZE || rosterA.length > MAX_ROSTER_SIZE) continue;

      const shuffledRosterA = [...rosterA].sort(() => Math.random() - 0.5);

      for (const playerA of shuffledRosterA) {
        const classA = getPositionClass(playerA.position);
        if (!classA) continue;

        const otherTeams = cpuTeams.filter((t) => t.id !== teamA.id).sort(() => Math.random() - 0.5);

        for (const teamB of otherTeams) {
          const rosterB = rosterByTeam.get(teamB.id) || [];
          if (rosterB.length < MIN_ROSTER_SIZE || rosterB.length > MAX_ROSTER_SIZE) continue;

          const shuffledRosterB = [...rosterB].sort(() => Math.random() - 0.5);

          for (const playerB of shuffledRosterB) {
            const classB = getPositionClass(playerB.position);
            if (classA !== classB) continue;

            // Check overall variance (15% limit)
            const ovrDiff = Math.abs(playerA.overall - playerB.overall);
            const maxOvr = Math.max(playerA.overall, playerB.overall);
            if (ovrDiff > maxOvr * 0.15) continue;

            // Check salary cap limits
            const totalSalaryA = rosterA.reduce((sum, p) => sum + p.salary, 0);
            const totalSalaryB = rosterB.reduce((sum, p) => sum + p.salary, 0);
            const newSalaryA = totalSalaryA - playerA.salary + playerB.salary;
            const newSalaryB = totalSalaryB - playerB.salary + playerA.salary;

            if (newSalaryA > 50000000 || newSalaryB > 50000000) continue;

            // Valid trade found, execute transaction and exit immediately
            await db.transaction(async (tx) => {
              await tx.update(players).set({ teamId: teamB.id }).where(eq(players.id, playerA.id));
              await tx.update(players).set({ teamId: teamA.id }).where(eq(players.id, playerB.id));

              const description = `TRADE: The ${teamA.city} ${teamA.name} traded ${playerA.firstName} ${playerA.lastName} (${playerA.position}) to the ${teamB.city} ${teamB.name} in exchange for ${playerB.firstName} ${playerB.lastName} (${playerB.position}).`;
              await tx.insert(transactions).values({
                type: "Trade",
                description,
                seasonYear,
                gameDay,
              });

              console.log(`[CPU Trade Engine] Trade executed: ${description}`);
            });

            return {
              playerAId: playerA.id,
              playerBId: playerB.id,
              teamAId: teamA.id,
              teamBId: teamB.id,
            };
          }
        }
      }
    }

    console.log(`[CPU Trade Engine] No valid trades found on Day ${gameDay}.`);
    return null;
  } catch (error) {
    console.error("[CPU Trade Engine] Error simulating trade:", error);
    return null;
  }
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

export interface DBPlayer {
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
  injuryDaysRemaining?: number;
  injuryType?: string | null;
}

export async function simulateGameLogic(
  game: { id: string; homeTeamId: string; awayTeamId: string; stage?: string; playoffRound?: string | null; seriesId?: string | null },
  homePlayersList: DBPlayer[],
  awayPlayersList: DBPlayer[]
) {
  const homePlayers = [...homePlayersList].sort((a, b) => b.overall - a.overall);
  const awayPlayers = [...awayPlayersList].sort((a, b) => b.overall - a.overall);

  if (homePlayers.length === 0 || awayPlayers.length === 0) {
    throw new Error(`Rosters cannot be empty.`);
  }

  // Helpers for stat generation
  function getNightlyVariance(player: DBPlayer, isStar: boolean): number {
    const rand = Math.random();
    if (isStar) {
      if (rand < 0.15) { // Cold night
        return 0.75 + Math.random() * 0.15;
      } else if (rand < 0.80) { // Normal night
        return 0.92 + Math.random() * 0.16;
      } else if (rand < 0.95) { // Hot night
        return 1.10 + Math.random() * 0.18;
      } else { // Rare explosion night
        return 1.28 + Math.random() * 0.10;
      }
    } else {
      if (rand < 0.25) { // Cold
        return 0.65 + Math.random() * 0.20;
      } else if (rand < 0.75) { // Normal
        return 0.88 + Math.random() * 0.20;
      } else { // Hot
        return 1.10 + Math.random() * 0.20;
      }
    }
  }

  function getBaseUsage(rank: number): number {
    if (rank === 0) return 0.24 + Math.random() * 0.09; // 24% - 33%
    if (rank === 1) return 0.20 + Math.random() * 0.06; // 20% - 26%
    if (rank === 2) return 0.15 + Math.random() * 0.06; // 15% - 21%
    if (rank === 3 || rank === 4) return 0.10 + Math.random() * 0.06; // 10% - 16%
    if (rank === 5) return 0.12 + Math.random() * 0.06; // 12% - 18%
    if (rank >= 6 && rank <= 9) return 0.06 + Math.random() * 0.06; // 6% - 12%
    return 0.01 + Math.random() * 0.05; // 1% - 6%
  }

  function allocateMinutes(rosterLength: number, isBlowout: boolean, isClose: boolean, otPeriods: number): number[] {
    const baseMinutes = new Array(rosterLength).fill(0);
    for (let i = 0; i < rosterLength; i++) {
      let min = 0;
      if (i === 0) min = 34;
      else if (i === 1) min = 32;
      else if (i === 2) min = 30;
      else if (i === 3) min = 28;
      else if (i === 4) min = 26;
      else if (i === 5) min = 24;
      else if (i <= 9) min = 14;
      else min = 4;

      if (isBlowout) {
        if (i < 5) min -= 6 + Math.round(Math.random() * 3);
        else if (i <= 9) min += 2 + Math.round(Math.random() * 2);
        else min += 4 + Math.round(Math.random() * 3);
      } else if (isClose) {
        if (i < 5) min += 2 + Math.round(Math.random() * 2);
        else if (i <= 9) min -= 1 + Math.round(Math.random());
        else min = Math.max(0, min - 2);
      } else {
        min += Math.round(randomNormal(0, 2));
      }

      if (otPeriods > 0) {
        if (i < 6) {
          min += otPeriods * 4 + Math.round(Math.random() * 2);
        } else if (i <= 9) {
          min += otPeriods * 1;
        }
      }

      baseMinutes[i] = Math.max(0, Math.min(48, min));
    }
    return baseMinutes;
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

  // Lower Filipino league scoring environment
  const expectedHome = 86 + 2 + (homeORtg - awayDRtg) * 0.4;
  const expectedAway = 86 + (awayORtg - homeDRtg) * 0.4;

  let homeScore = Math.max(68, Math.round(expectedHome + randomNormal(0, 6)));
  let awayScore = Math.max(68, Math.round(expectedAway + randomNormal(0, 6)));

  // Clamp team scores to realistic maximum of 114 except in double overtime or rare outliers
  if (homeScore > 114 && Math.random() > 0.1) homeScore = 108 + Math.floor(Math.random() * 6);
  if (awayScore > 114 && Math.random() > 0.1) awayScore = 108 + Math.floor(Math.random() * 6);

  let otPeriods = 0;
  while (homeScore === awayScore) {
    otPeriods++;
    homeScore += Math.max(2, Math.round(12 + randomNormal(0, 3)));
    awayScore += Math.max(2, Math.round(12 + randomNormal(0, 3)));
  }

  const scoreDiff = Math.abs(homeScore - awayScore);
  const isBlowout = scoreDiff >= 18;
  const isClose = scoreDiff <= 6;

  const homeMinutes = allocateMinutes(homePlayers.length, isBlowout, isClose, otPeriods);
  const awayMinutes = allocateMinutes(awayPlayers.length, isBlowout, isClose, otPeriods);

  const getScoringWeight = (p: DBPlayer, idx: number, minutes: number) => {
    const usage = getBaseUsage(idx);
    const scoringAttr = (p.insideScoring + p.threePoint + p.overall) / 3;
    const variance = getNightlyVariance(p, idx <= 2);
    return usage * scoringAttr * (minutes / 30) * variance;
  };

  const getReboundWeight = (p: DBPlayer, idx: number, minutes: number) => {
    const base = p.rebounding * 1.5 + p.interiorDefense * 0.4;
    return base * (minutes / 30) * (0.8 + Math.random() * 0.4);
  };

  const getAssistWeight = (p: DBPlayer, idx: number, minutes: number) => {
    const base = p.playmaking * 1.6 + p.speed * 0.2;
    return base * (minutes / 30) * (0.8 + Math.random() * 0.4);
  };

  const getStealWeight = (p: DBPlayer, idx: number, minutes: number) => {
    const base = p.perimeterDefense * 1.4 + p.speed * 0.4;
    return base * (minutes / 30) * (0.8 + Math.random() * 0.4);
  };

  const getBlockWeight = (p: DBPlayer, idx: number, minutes: number) => {
    const base = p.interiorDefense * 1.5 + p.rebounding * 0.3;
    return base * (minutes / 30) * (0.8 + Math.random() * 0.4);
  };

  const getTurnoverWeight = (p: DBPlayer, idx: number, minutes: number) => {
    const base = (100 - p.playmaking) * 1.5 + (100 - p.overall) * 0.5;
    return base * (minutes / 30) * (0.8 + Math.random() * 0.4);
  };

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

  const homePoints = distributeStats(homeScore, homePlayers, (p, idx) => getScoringWeight(p, idx, homeMinutes[idx]));
  const awayPoints = distributeStats(awayScore, awayPlayers, (p, idx) => getScoringWeight(p, idx, awayMinutes[idx]));

  const homeRebounds = distributeStats(totalHomeRebounds, homePlayers, (p, idx) => getReboundWeight(p, idx, homeMinutes[idx]));
  const awayRebounds = distributeStats(totalAwayRebounds, awayPlayers, (p, idx) => getReboundWeight(p, idx, awayMinutes[idx]));

  const homeAssists = distributeStats(totalHomeAssists, homePlayers, (p, idx) => getAssistWeight(p, idx, homeMinutes[idx]));
  const awayAssists = distributeStats(totalAwayAssists, awayPlayers, (p, idx) => getAssistWeight(p, idx, awayMinutes[idx]));

  const homeSteals = distributeStats(totalHomeSteals, homePlayers, (p, idx) => getStealWeight(p, idx, homeMinutes[idx]));
  const awaySteals = distributeStats(totalAwaySteals, awayPlayers, (p, idx) => getStealWeight(p, idx, awayMinutes[idx]));

  const homeBlocks = distributeStats(totalHomeBlocks, homePlayers, (p, idx) => getBlockWeight(p, idx, homeMinutes[idx]));
  const awayBlocks = distributeStats(totalAwayBlocks, awayPlayers, (p, idx) => getBlockWeight(p, idx, awayMinutes[idx]));

  const homeTurnovers = distributeStats(totalHomeTurnovers, homePlayers, (p, idx) => getTurnoverWeight(p, idx, homeMinutes[idx]));
  const awayTurnovers = distributeStats(totalAwayTurnovers, awayPlayers, (p, idx) => getTurnoverWeight(p, idx, awayMinutes[idx]));

  const playerStatsToInsert: Array<typeof playerGameStats.$inferInsert> = [];

  const addPlayerStats = (
    roster: DBPlayer[],
    ptsArr: number[],
    rebArr: number[],
    astArr: number[],
    stlArr: number[],
    blkArr: number[],
    toArr: number[],
    minutesArr: number[]
  ) => {
    for (let i = 0; i < roster.length; i++) {
      const p = roster[i];
      const pts = ptsArr[i];
      const rebs = rebArr[i];
      const asts = astArr[i];
      const steals = stlArr[i];
      const blocks = blkArr[i];
      const turnovers = toArr[i];
      const minutes = minutesArr[i];

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

  addPlayerStats(homePlayers, homePoints, homeRebounds, homeAssists, homeSteals, homeBlocks, homeTurnovers, homeMinutes);
  addPlayerStats(awayPlayers, awayPoints, awayRebounds, awayAssists, awaySteals, awayBlocks, awayTurnovers, awayMinutes);

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

    // Filter out injured players, ensuring at least 5 healthy players remain
    const healthyHomeList = homePlayersList.filter((p) => !p.injuryDaysRemaining || p.injuryDaysRemaining <= 0);
    const healthyAwayList = awayPlayersList.filter((p) => !p.injuryDaysRemaining || p.injuryDaysRemaining <= 0);

    const finalHomeRoster = healthyHomeList.length >= 5 ? healthyHomeList : [...homePlayersList].sort((a, b) => b.overall - a.overall).slice(0, 5);
    const finalAwayRoster = healthyAwayList.length >= 5 ? healthyAwayList : [...awayPlayersList].sort((a, b) => b.overall - a.overall).slice(0, 5);

    const res = await simulateGameLogic(
      game,
      finalHomeRoster as unknown as DBPlayer[],
      finalAwayRoster as unknown as DBPlayer[]
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

    // Check if the regular season is now complete
    if (game.stage === "Regular") {
      const remainingGames = await db
        .select({ count: sql<number>`count(*)` })
        .from(games)
        .where(and(eq(games.stage, "Regular"), eq(games.status, "Scheduled")));

      if (Number(remainingGames[0]?.count ?? 0) === 0) {
        console.log(`[League Engine] Regular season complete via single game simulation. Triggering Season ${game.seasonYear} awards calculation...`);
        await calculateRegularSeasonAwardsAction(game.seasonYear).catch((err) =>
          console.error("[League Engine] Awards calculation in simulateGameAction failed silently:", err)
        );
        await enforceLeagueRosterLimitsAction();
        return {
          success: true,
          game: updatedGame[0],
          overtimes: res.overtimes,
          status: "REGULAR_SEASON_COMPLETE",
        };
      }
    }

    return {
      success: true,
      game: updatedGame[0],
      overtimes: res.overtimes,
      status: "SUCCESS",
    };
  } catch (error: any) {
    console.error("Simulation failed:", error);
    throw error;
  }
}

export async function simulateRemainingDayGames(day: number, userTeamId?: string | null) {
  try {
    const scheduledGames = await db
      .select()
      .from(games)
      .where(and(eq(games.gameNumber, day), eq(games.status, "Scheduled")));

    if (scheduledGames.length === 0) {
      return {
        success: true,
        count: 0,
        status: "SUCCESS"
      };
    }

    const seasonYear = scheduledGames[0].seasonYear;

    const results = [];
    let isComplete = false;
    for (const game of scheduledGames) {
      const res = await simulateGameAction(game.id);
      results.push(res);
      if (res.status === "REGULAR_SEASON_COMPLETE") {
        isComplete = true;
      }
    }

    // Trigger trade proposal generation during single-day simulation
    if (userTeamId) {
      await generateTradeProposalsAction(seasonYear, userTeamId);
    }

    return {
      success: true,
      count: results.length,
      status: isComplete ? "REGULAR_SEASON_COMPLETE" : "SUCCESS",
    };
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
      .where(and(eq(games.status, "Completed"), eq(games.stage, "Regular")));

    return { success: true, teams: allTeams, completedGames };
  } catch (error: any) {
    console.error("Failed to fetch standings data:", error);
    return { success: false, error: error.message || "Failed to fetch standings data." };
  }
}

export async function simulateBatchDaysAction(
  daysToSimulate: number,
  bypassDeadline: boolean = false,
  userTeamId?: string | null
) {
  try {
    // Enforce strict roster limits (12-18) at the start of the batch run
    await enforceLeagueRosterLimitsAction();

    let localTeams = await db.select().from(teams);
    let localPlayers = await db
      .select()
      .from(players)
      .where(eq(players.status, "Active"));

    const nextGame = await db
      .select({ day: games.gameNumber, seasonYear: games.seasonYear })
      .from(games)
      .where(and(eq(games.status, "Scheduled"), eq(games.stage, "Regular")))
      .orderBy(games.gameNumber)
      .limit(1);

    if (nextGame.length === 0) {
      return { status: "REGULAR_SEASON_COMPLETE", daysSimulated: 0, currentDay: 82 };
    }

    const startDay = nextGame[0].day;
    const seasonYear = nextGame[0].seasonYear;
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
      const injuryTransactionsToInsert: Array<typeof transactions.$inferInsert> = [];

      for (const day of daysToSimulateList) {
        // Run daily CPU-CPU trade & signing AI logic in local memory arrays
        const aiResult = await runCpuDailyAiEngineAction(localPlayers, localTeams, day, seasonYear, userTeamId);
        localPlayers = aiResult.updatedPlayers;
        localTeams = aiResult.updatedTeams;

        if (userTeamId) {
          await generateTradeProposalsAction(seasonYear, userTeamId);
        }

        // Refresh rosters mapping from local memory state
        const rostersByTeam = new Map<string, typeof players.$inferSelect[]>();
        for (const player of localPlayers) {
          if (player.teamId) {
            if (!rostersByTeam.has(player.teamId)) {
              rostersByTeam.set(player.teamId, []);
            }
            rostersByTeam.get(player.teamId)!.push(player);
          }
        }

        const dayGames = gamesByDay.get(day) || [];
        for (const game of dayGames) {
          const homeRoster = rostersByTeam.get(game.homeTeamId) || [];
          const awayRoster = rostersByTeam.get(game.awayTeamId) || [];

          if (homeRoster.length === 0 || awayRoster.length === 0) {
            continue;
          }

          // Filter out injured players, ensuring at least 5 players remain
          const activeHome = homeRoster.filter((p) => !p.injuryDaysRemaining || p.injuryDaysRemaining <= 0);
          const activeAway = awayRoster.filter((p) => !p.injuryDaysRemaining || p.injuryDaysRemaining <= 0);

          const finalHome = activeHome.length >= 5 ? activeHome : [...homeRoster].sort((a, b) => b.overall - a.overall).slice(0, 5);
          const finalAway = activeAway.length >= 5 ? activeAway : [...awayRoster].sort((a, b) => b.overall - a.overall).slice(0, 5);

          const res = await simulateGameLogic(
            game,
            finalHome as unknown as DBPlayer[],
            finalAway as unknown as DBPlayer[]
          );
          gamesToUpdate.push(res.updatedGame);
          statsToInsert.push(...res.playerStatsToInsert);

          // Injury Logic: 1.5% chance per game played
          if (Math.random() < 0.015) {
            const INJURY_TYPES = [
              "Sprained Ankle",
              "Hamstring Strain",
              "Knee Hyperextension",
              "Groin Pull",
              "Wrist Sprain",
              "Bruised Ribs",
              "Lower Back Spasm",
              "Shin Splints",
              "Calf Strain",
              "Thumb Sprain"
            ];
            const chosenRoster = Math.random() < 0.5 ? finalHome : finalAway;
            if (chosenRoster.length > 0) {
              const injuredPlayer = chosenRoster[Math.floor(Math.random() * chosenRoster.length)];
              const injuryDays = Math.floor(Math.random() * 12) + 3; // 3 to 14 days
              const injuryType = INJURY_TYPES[Math.floor(Math.random() * INJURY_TYPES.length)];

              injuredPlayer.injuryDaysRemaining = injuryDays;
              injuredPlayer.injuryType = injuryType;

              const teamObj = localTeams.find((t) => t.id === injuredPlayer.teamId);
              const teamName = teamObj ? `${teamObj.city} ${teamObj.name}` : "Unknown Team";

              injuryTransactionsToInsert.push({
                type: "Injury",
                description: `🤕 INJURY: ${injuredPlayer.firstName} ${injuredPlayer.lastName} (${injuredPlayer.position}, ${teamName}) has suffered a ${injuryType} and is expected to miss ${injuryDays} days.`,
                seasonYear,
                gameDay: day,
              });
            }
          }
        }
        daysSimulated++;

        // Decrement injury days remaining for all players in local memory state at the end of day
        for (const player of localPlayers) {
          if (player.injuryDaysRemaining && player.injuryDaysRemaining > 0) {
            player.injuryDaysRemaining--;
            if (player.injuryDaysRemaining === 0) {
              player.injuryType = null;
            }
          }
        }
      }

      // Bulk persist game completions and stats
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

      // Persist injury transactions to database
      if (injuryTransactionsToInsert.length > 0) {
        const txChunkSize = 100;
        for (let i = 0; i < injuryTransactionsToInsert.length; i += txChunkSize) {
          await db.insert(transactions).values(injuryTransactionsToInsert.slice(i, i + txChunkSize));
        }
      }

      // Bulk write all updated player records (including trade, signing, and injury mutations) back to database
      if (localPlayers.length > 0) {
        const playerUpdateQueries = localPlayers.map((p) =>
          db.update(players)
            .set({
              teamId: p.teamId,
              contractYearsRemaining: p.contractYearsRemaining,
              injuryDaysRemaining: p.injuryDaysRemaining ?? 0,
              injuryType: p.injuryType ?? null,
              status: p.status,
              salary: p.salary,
            })
            .where(eq(players.id, p.id))
        );
        const playerChunkSize = 100;
        for (let i = 0; i < playerUpdateQueries.length; i += playerChunkSize) {
          await db.batch(playerUpdateQueries.slice(i, i + playerChunkSize) as any);
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

    // If no more scheduled regular season games, auto-calculate season awards
    if (nextGameAfter.length === 0) {
      console.log(`[League Engine] Regular season complete. Triggering Season ${seasonYear} awards calculation...`);
      await calculateRegularSeasonAwardsAction(seasonYear).catch((err) =>
        console.error("[League Engine] Awards calculation failed silently:", err)
      );
      // Heartbeat Hook: Enforce roster limits at the conclusion of Day 82
      await enforceLeagueRosterLimitsAction();
      return { status: "REGULAR_SEASON_COMPLETE", daysSimulated, currentDay: 82 };
    }

    return { status: "SUCCESS", daysSimulated, currentDay: finalDay };
  } catch (error: any) {
    console.error("Batch simulation failed:", error);
    return { status: "ERROR", error: error.message || "Failed to run batch simulation.", currentDay: 1 };
  }
}

export async function simulateUntilPlayoffsAction(
  bypassDeadline: boolean = false,
  userTeamId?: string | null
) {
  try {
    const nextGame = await db
      .select({ day: games.gameNumber, seasonYear: games.seasonYear })
      .from(games)
      .where(and(eq(games.status, "Scheduled"), eq(games.stage, "Regular")))
      .orderBy(games.gameNumber)
      .limit(1);

    if (nextGame.length === 0) {
      return { status: "REGULAR_SEASON_COMPLETE", daysSimulated: 0, currentDay: 82 };
    }

    const startDay = nextGame[0].day;
    const seasonYear = nextGame[0].seasonYear;
    const daysToSimulate = 82 - startDay + 1;
    const res = await simulateBatchDaysAction(daysToSimulate, bypassDeadline, userTeamId);

    // If regular season concludes, execute awards calculation
    const remainingGames = await db
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .where(and(eq(games.stage, "Regular"), eq(games.status, "Scheduled")));

    if (Number(remainingGames[0]?.count ?? 0) === 0 || res.status === "REGULAR_SEASON_COMPLETE") {
      console.log(`[League Engine] Regular season complete (simulateUntilPlayoffsAction). Triggering Season ${seasonYear} awards calculation...`);
      await calculateRegularSeasonAwardsAction(seasonYear).catch((err) =>
        console.error("[League Engine] Awards calculation in simulateUntilPlayoffsAction failed silently:", err)
      );
      // Heartbeat Hook: Enforce roster limits at the conclusion of Day 82
      await enforceLeagueRosterLimitsAction();
      return { status: "REGULAR_SEASON_COMPLETE", daysSimulated: res.daysSimulated, currentDay: 82 };
    }

    return res;
  } catch (error: any) {
    console.error("Simulate until playoffs failed:", error);
    return { status: "ERROR", error: error.message || "Failed to simulate until playoffs.", currentDay: 1 };
  }
}

export async function simulateWeekChunkAction(
  startDay: number,
  seasonYear: number,
  bypassDeadline: boolean = false,
  userTeamId?: string | null
) {
  try {
    console.log(`[League Engine] Simulating week chunk starting from Day ${startDay}, Season ${seasonYear}...`);

    if (startDay > 82) {
      console.log(`[League Engine] Regular season complete (startDay > 82). Triggering awards calculation...`);
      await calculateRegularSeasonAwardsAction(seasonYear).catch((err) =>
        console.error("[League Engine] Awards calculation failed silently:", err)
      );
      await enforceLeagueRosterLimitsAction();
      return { status: "REGULAR_SEASON_COMPLETE", nextDay: 82 };
    }

    const endDay = Math.min(82, startDay + 6);
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
      return { status: "DEADLINE_REACHED", nextDay: 50 };
    }

    // Enforce roster limits (12-18) once at start of chunk
    await enforceLeagueRosterLimitsAction();

    let localTeams = await db.select().from(teams);
    let localPlayers = await db
      .select()
      .from(players)
      .where(eq(players.status, "Active"));

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
    const injuryTransactionsToInsert: Array<typeof transactions.$inferInsert> = [];

    for (const day of daysToSimulateList) {
      // Run daily CPU front-office simulation using in-memory state arrays
      const aiResult = await runCpuDailyAiEngineAction(localPlayers, localTeams, day, seasonYear, userTeamId);
      localPlayers = aiResult.updatedPlayers;
      localTeams = aiResult.updatedTeams;

      if (userTeamId) {
        await generateTradeProposalsAction(seasonYear, userTeamId);
      }

      // Populate rosters from local memory array
      const rostersByTeam = new Map<string, typeof players.$inferSelect[]>();
      for (const player of localPlayers) {
        if (player.teamId) {
          if (!rostersByTeam.has(player.teamId)) {
            rostersByTeam.set(player.teamId, []);
          }
          rostersByTeam.get(player.teamId)!.push(player);
        }
      }

      const dayGames = gamesByDay.get(day) || [];
      for (const game of dayGames) {
        const homeRoster = rostersByTeam.get(game.homeTeamId) || [];
        const awayRoster = rostersByTeam.get(game.awayTeamId) || [];

        if (homeRoster.length === 0 || awayRoster.length === 0) continue;

        const activeHome = homeRoster.filter((p) => !p.injuryDaysRemaining || p.injuryDaysRemaining <= 0);
        const activeAway = awayRoster.filter((p) => !p.injuryDaysRemaining || p.injuryDaysRemaining <= 0);

        const finalHome = activeHome.length >= 5 ? activeHome : [...homeRoster].sort((a, b) => b.overall - a.overall).slice(0, 5);
        const finalAway = activeAway.length >= 5 ? activeAway : [...awayRoster].sort((a, b) => b.overall - a.overall).slice(0, 5);

        const res = await simulateGameLogic(
          game,
          finalHome as unknown as DBPlayer[],
          finalAway as unknown as DBPlayer[]
        );
        gamesToUpdate.push(res.updatedGame);
        statsToInsert.push(...res.playerStatsToInsert);

        // Injury Logic
        if (Math.random() < 0.015) {
          const INJURY_TYPES = [
            "Sprained Ankle",
            "Hamstring Strain",
            "Knee Hyperextension",
            "Groin Pull",
            "Wrist Sprain",
            "Bruised Ribs",
            "Lower Back Spasm",
            "Shin Splints",
            "Calf Strain",
            "Thumb Sprain"
          ];
          const chosenRoster = Math.random() < 0.5 ? finalHome : finalAway;
          if (chosenRoster.length > 0) {
            const injuredPlayer = chosenRoster[Math.floor(Math.random() * chosenRoster.length)];
            const injuryDays = Math.floor(Math.random() * 12) + 3;
            const injuryType = INJURY_TYPES[Math.floor(Math.random() * INJURY_TYPES.length)];

            injuredPlayer.injuryDaysRemaining = injuryDays;
            injuredPlayer.injuryType = injuryType;

            const teamObj = localTeams.find((t) => t.id === injuredPlayer.teamId);
            const teamName = teamObj ? `${teamObj.city} ${teamObj.name}` : "Unknown Team";

            injuryTransactionsToInsert.push({
              type: "Injury",
              description: `🤕 INJURY: ${injuredPlayer.firstName} ${injuredPlayer.lastName} (${injuredPlayer.position}, ${teamName}) has suffered a ${injuryType} and is expected to miss ${injuryDays} days.`,
              seasonYear,
              gameDay: day,
            });
          }
        }
      }

      // Decrement injury days in local state
      for (const player of localPlayers) {
        if (player.injuryDaysRemaining && player.injuryDaysRemaining > 0) {
          player.injuryDaysRemaining--;
          if (player.injuryDaysRemaining === 0) {
            player.injuryType = null;
          }
        }
      }
    }

    // Bulk writes to database
    if (gamesToUpdate.length > 0) {
      const batchQueries: any[] = [];
      const statChunkSize = 1000;
      for (let i = 0; i < statsToInsert.length; i += statChunkSize) {
        batchQueries.push(db.insert(playerGameStats).values(statsToInsert.slice(i, i + statChunkSize)));
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
        await db.batch(batchQueries.slice(i, i + queryChunkSize) as any);
      }
    }

    if (injuryTransactionsToInsert.length > 0) {
      const txChunkSize = 100;
      for (let i = 0; i < injuryTransactionsToInsert.length; i += txChunkSize) {
        await db.insert(transactions).values(injuryTransactionsToInsert.slice(i, i + txChunkSize));
      }
    }

    // Bulk write all updated player records (including trade, signing, and injury mutations) back to database
    if (localPlayers.length > 0) {
      const playerUpdateQueries = localPlayers.map((p) =>
        db.update(players)
          .set({
            teamId: p.teamId,
            contractYearsRemaining: p.contractYearsRemaining,
            injuryDaysRemaining: p.injuryDaysRemaining ?? 0,
            injuryType: p.injuryType ?? null,
            status: p.status,
            salary: p.salary,
          })
          .where(eq(players.id, p.id))
      );
      const playerChunkSize = 100;
      for (let i = 0; i < playerUpdateQueries.length; i += playerChunkSize) {
        await db.batch(playerUpdateQueries.slice(i, i + playerChunkSize) as any);
      }
    }

    if (hitDeadline) {
      return { status: "DEADLINE_REACHED", nextDay: 50 };
    }

    const nextGameAfter = await db
      .select({ day: games.gameNumber })
      .from(games)
      .where(and(eq(games.status, "Scheduled"), eq(games.stage, "Regular")))
      .orderBy(games.gameNumber)
      .limit(1);

    const finalDay = nextGameAfter[0]?.day ?? 82;

    if (nextGameAfter.length === 0 || finalDay > 82) {
      console.log(`[League Engine] Regular season complete. Triggering Season ${seasonYear} awards calculation...`);
      await calculateRegularSeasonAwardsAction(seasonYear).catch((err) =>
        console.error("[League Engine] Awards calculation failed silently:", err)
      );
      await enforceLeagueRosterLimitsAction();
      return { status: "REGULAR_SEASON_COMPLETE", nextDay: 82 };
    }

    return { status: "CHUNK_COMPLETE", nextDay: finalDay };
  } catch (error: any) {
    console.error("simulateWeekChunkAction failed:", error);
    return { status: "ERROR", error: error.message || "Failed to simulate week chunk." };
  }
}


