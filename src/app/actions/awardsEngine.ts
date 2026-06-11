"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { eq, and, inArray, sql, aliasedTable } from "drizzle-orm";
import {
  players,
  games,
  playerGameStats,
  teams,
  playerAwards,
  allLeagueTeams,
  seasonChampions,
} from "@/db/schema";

// ─── Score Formulae ───────────────────────────────────────────────────────────
function productionScore(
  ppg: number, rpg: number, apg: number, spg: number, bpg: number, topg: number
): number {
  return ppg + rpg * 1.2 + apg * 1.5 + spg * 2.0 + bpg * 2.0 - topg * 1.5;
}

function defensiveScore(
  spg: number, bpg: number, perimDef: number, interiorDef: number
): number {
  return spg * 2.5 + bpg * 2.5 + (perimDef + interiorDef) / 10;
}

// ─── Position helpers ─────────────────────────────────────────────────────────
type PositionClass = "G" | "F" | "C";
function positionClass(position: string): PositionClass {
  if (["PG", "SG"].includes(position)) return "G";
  if (["SF", "PF"].includes(position)) return "F";
  return "C";
}

// ─── Main Awards Action ───────────────────────────────────────────────────────
export async function calculateRegularSeasonAwardsAction(seasonYear: number, tx?: any) {
  try {
    console.log(`[Awards Engine] Calculating Season ${seasonYear} awards...`);
    const client = (tx || db) as typeof db;

    // 1. Fetch all regular-season game logs for this year
    const regularGameIds = await client
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.stage, "Regular"), eq(games.seasonYear, seasonYear)));

    if (regularGameIds.length === 0) {
      console.warn("[Awards Engine] No regular season games found — aborting.");
      return { success: false, error: "No regular season games for this year." };
    }

    const gameIdList = regularGameIds.map((g) => g.id);

    const allLogs = await client
      .select({
        playerId: playerGameStats.playerId,
        points: playerGameStats.points,
        rebounds: playerGameStats.rebounds,
        assists: playerGameStats.assists,
        steals: playerGameStats.steals,
        blocks: playerGameStats.blocks,
        turnovers: playerGameStats.turnovers,
        minutes: playerGameStats.minutes,
      })
      .from(playerGameStats)
      .where(inArray(playerGameStats.gameId, gameIdList));

    // 2. Aggregate per player
    const statsMap = new Map<
      string,
      {
        gp: number;
        totalPoints: number;
        totalRebounds: number;
        totalAssists: number;
        totalSteals: number;
        totalBlocks: number;
        totalTurnovers: number;
        totalMinutes: number;
        gamesWithHighMinutes: number; // proxy for "starting" — minutes >= 25
      }
    >();

    for (const log of allLogs) {
      const prev = statsMap.get(log.playerId) ?? {
        gp: 0, totalPoints: 0, totalRebounds: 0, totalAssists: 0,
        totalSteals: 0, totalBlocks: 0, totalTurnovers: 0,
        totalMinutes: 0, gamesWithHighMinutes: 0,
      };
      statsMap.set(log.playerId, {
        gp: prev.gp + 1,
        totalPoints: prev.totalPoints + log.points,
        totalRebounds: prev.totalRebounds + log.rebounds,
        totalAssists: prev.totalAssists + log.assists,
        totalSteals: prev.totalSteals + log.steals,
        totalBlocks: prev.totalBlocks + log.blocks,
        totalTurnovers: prev.totalTurnovers + log.turnovers,
        totalMinutes: prev.totalMinutes + log.minutes,
        gamesWithHighMinutes: prev.gamesWithHighMinutes + (log.minutes >= 25 ? 1 : 0),
      });
    }

    if (statsMap.size === 0) {
      return { success: false, error: "No player stats found for this season." };
    }

    // 3. Load all active players (includes isRookie, teamId, position, perimeterDefense, interiorDefense)
    const allPlayersList = await client
      .select()
      .from(players)
      .where(inArray(players.status, ["Active", "Retired"])); // include just-retired too

    const playerMap = new Map(allPlayersList.map((p) => [p.id, p]));

    // 4. Determine playoff team IDs (top 8 of each conference by regular season record)
    const allTeams = await client.select().from(teams);
    const allCompletedRegular = await client
      .select({
        homeTeamId: games.homeTeamId,
        awayTeamId: games.awayTeamId,
        homeScore: games.homeScore,
        awayScore: games.awayScore,
      })
      .from(games)
      .where(and(eq(games.stage, "Regular"), eq(games.status, "Completed"), eq(games.seasonYear, seasonYear)));

    const winsMap = new Map<string, number>();
    for (const t of allTeams) winsMap.set(t.id, 0);
    for (const g of allCompletedRegular) {
      if (g.homeScore > g.awayScore) {
        winsMap.set(g.homeTeamId, (winsMap.get(g.homeTeamId) ?? 0) + 1);
      } else {
        winsMap.set(g.awayTeamId, (winsMap.get(g.awayTeamId) ?? 0) + 1);
      }
    }

    const sorted = (conf: "Luzon" | "VisMin") =>
      allTeams
        .filter((t) => t.conference === conf)
        .sort((a, b) => (winsMap.get(b.id) ?? 0) - (winsMap.get(a.id) ?? 0));

    const playoffTeamIds = new Set<string>([
      ...sorted("Luzon").slice(0, 8).map((t) => t.id),
      ...sorted("VisMin").slice(0, 8).map((t) => t.id),
    ]);

    // 5. Build candidate list with scores (min 20 games played)
    type Candidate = {
      playerId: string;
      teamId: string;
      position: string;
      posClass: PositionClass;
      gp: number;
      ppg: number; rpg: number; apg: number; spg: number; bpg: number; topg: number;
      ps: number; // production score
      ds: number; // defensive score
      isRookie: boolean;
      starterRatio: number; // gamesWithHighMinutes / gp
    };

    const candidates: Candidate[] = [];

    for (const [playerId, stat] of statsMap.entries()) {
      if (stat.gp < 20) continue; // minimum games threshold

      const player = playerMap.get(playerId);
      if (!player || !player.teamId) continue;

      const gp = stat.gp;
      const ppg = stat.totalPoints / gp;
      const rpg = stat.totalRebounds / gp;
      const apg = stat.totalAssists / gp;
      const spg = stat.totalSteals / gp;
      const bpg = stat.totalBlocks / gp;
      const topg = stat.totalTurnovers / gp;

      const ps = productionScore(ppg, rpg, apg, spg, bpg, topg);
      const ds = defensiveScore(spg, bpg, player.perimeterDefense, player.interiorDefense);

      candidates.push({
        playerId,
        teamId: player.teamId,
        position: player.position,
        posClass: positionClass(player.position),
        gp,
        ppg, rpg, apg, spg, bpg, topg,
        ps, ds,
        isRookie: player.isRookie,
        starterRatio: stat.gamesWithHighMinutes / gp,
      });
    }

    if (candidates.length === 0) {
      return { success: false, error: "Not enough candidate players." };
    }

    // ── 6. Calculate Awards ──────────────────────────────────────────────────

    // MVP: highest PS on a playoff-bound team
    const mvpCandidate = [...candidates]
      .filter((c) => playoffTeamIds.has(c.teamId))
      .sort((a, b) => b.ps - a.ps)[0];

    // ROY: highest PS among rookies
    const royCandidate = [...candidates]
      .filter((c) => c.isRookie)
      .sort((a, b) => b.ps - a.ps)[0];

    // DPOY: highest defensive score
    const dpoyCandidate = [...candidates].sort((a, b) => b.ds - a.ds)[0];

    // 6MOTY: highest PS among bench players (started < 15% of games = starterRatio < 0.15)
    const sixmCandidate = [...candidates]
      .filter((c) => c.starterRatio < 0.15)
      .sort((a, b) => b.ps - a.ps)[0];

    // ── 7. All-League Teams ──────────────────────────────────────────────────
    const sortedByPS = [...candidates].sort((a, b) => b.ps - a.ps);

    function selectAllLeagueSlots(
      pool: Candidate[],
      excludeIds: Set<string>
    ): { G: Candidate[]; F: Candidate[]; C: Candidate[] } {
      const guards: Candidate[] = [];
      const forwards: Candidate[] = [];
      const centers: Candidate[] = [];

      for (const c of pool) {
        if (excludeIds.has(c.playerId)) continue;
        if (c.posClass === "G" && guards.length < 2) guards.push(c);
        else if (c.posClass === "F" && forwards.length < 2) forwards.push(c);
        else if (c.posClass === "C" && centers.length < 1) centers.push(c);
        if (guards.length === 2 && forwards.length === 2 && centers.length === 1) break;
      }

      return { G: guards, F: forwards, C: centers };
    }

    const usedIds = new Set<string>();
    const firstTeamSlots = selectAllLeagueSlots(sortedByPS, usedIds);
    [...firstTeamSlots.G, ...firstTeamSlots.F, ...firstTeamSlots.C].forEach((c) => usedIds.add(c.playerId));

    const secondTeamSlots = selectAllLeagueSlots(sortedByPS, usedIds);
    [...secondTeamSlots.G, ...secondTeamSlots.F, ...secondTeamSlots.C].forEach((c) => usedIds.add(c.playerId));

    const thirdTeamSlots = selectAllLeagueSlots(sortedByPS, usedIds);
    [...thirdTeamSlots.G, ...thirdTeamSlots.F, ...thirdTeamSlots.C].forEach((c) => usedIds.add(c.playerId));

    // ── 8. All-Defensive Team ────────────────────────────────────────────────
    const sortedByDS = [...candidates].sort((a, b) => b.ds - a.ds);
    const defTeamIds = new Set<string>();
    const defTeamSlots = selectAllLeagueSlots(sortedByDS, defTeamIds);

    // ── 9. Persist to DB ─────────────────────────────────────────────────────
    const persistLogic = async (txClient: any) => {
      // Clear any existing awards for this year (idempotent)
      await txClient.delete(playerAwards).where(eq(playerAwards.seasonYear, seasonYear));
      await txClient.delete(allLeagueTeams).where(eq(allLeagueTeams.seasonYear, seasonYear));

      // Insert individual awards
      const awardsToInsert: (typeof playerAwards.$inferInsert)[] = [];

      if (mvpCandidate) {
        awardsToInsert.push({ seasonYear, awardType: "MVP", playerId: mvpCandidate.playerId, teamId: mvpCandidate.teamId });
        console.log(`[Awards] MVP: ${mvpCandidate.playerId} (PS: ${mvpCandidate.ps.toFixed(1)})`);
      }
      if (royCandidate) {
        awardsToInsert.push({ seasonYear, awardType: "ROY", playerId: royCandidate.playerId, teamId: royCandidate.teamId });
      }
      if (dpoyCandidate) {
        awardsToInsert.push({ seasonYear, awardType: "DPOY", playerId: dpoyCandidate.playerId, teamId: dpoyCandidate.teamId });
      }
      if (sixmCandidate) {
        awardsToInsert.push({ seasonYear, awardType: "6MOTY", playerId: sixmCandidate.playerId, teamId: sixmCandidate.teamId });
      }

      if (awardsToInsert.length > 0) {
        await txClient.insert(playerAwards).values(awardsToInsert);
      }

      // Insert All-League teams
      const allLeagueToInsert: (typeof allLeagueTeams.$inferInsert)[] = [];

      const addSlots = (
        slots: { G: Candidate[]; F: Candidate[]; C: Candidate[] },
        type: string
      ) => {
        for (const c of slots.G) allLeagueToInsert.push({ seasonYear, type, position: "G", playerId: c.playerId });
        for (const c of slots.F) allLeagueToInsert.push({ seasonYear, type, position: "F", playerId: c.playerId });
        for (const c of slots.C) allLeagueToInsert.push({ seasonYear, type, position: "C", playerId: c.playerId });
      };

      addSlots(firstTeamSlots, "All-League 1st");
      addSlots(secondTeamSlots, "All-League 2nd");
      addSlots(thirdTeamSlots, "All-League 3rd");
      addSlots(defTeamSlots, "All-Defensive");

      if (allLeagueToInsert.length > 0) {
        await txClient.insert(allLeagueTeams).values(allLeagueToInsert);
      }
    };

    await persistLogic(tx || db);

    console.log(`[Awards Engine] Season ${seasonYear} regular-season awards calculated and saved.`);

    try {
      revalidatePath("/dashboard/awards");
      revalidatePath("/dashboard/history");
      revalidatePath("/dashboard/schedule");
    } catch (revalErr) {
      console.warn("[Awards Engine] Failed to revalidate paths:", revalErr);
    }

    return {
      success: true,
      mvpPlayerId: mvpCandidate?.playerId ?? null,
      royPlayerId: royCandidate?.playerId ?? null,
      dpoyPlayerId: dpoyCandidate?.playerId ?? null,
      sixmPlayerId: sixmCandidate?.playerId ?? null,
    };
  } catch (error: any) {
    console.error("[Awards Engine] Failed to calculate regular season awards:", error);
    return { success: false, error: error.message || "Failed to calculate awards." };
  }
}

// ─── Finals MVP & Champion Record ────────────────────────────────────────────
export async function calculateFinalsMvpAction(
  seasonYear: number,
  winningTeamId: string,
  losingTeamId: string,
  seriesScore: string,
  tx?: any
) {
  try {
    console.log(`[Awards Engine] Calculating Finals MVP for Season ${seasonYear}...`);
    const client = (tx || db) as typeof db;

    // Fetch all Grand Finals game IDs
    const gfGames = await client
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.seriesId, "GF_GrandFinals"), eq(games.status, "Completed")));

    if (gfGames.length === 0) {
      return { success: false, error: "No completed Grand Finals games found." };
    }

    const gfGameIds = gfGames.map((g) => g.id);

    // Fetch stats from winning team players only in those games
    const gfLogs = await client
      .select({
        playerId: playerGameStats.playerId,
        points: playerGameStats.points,
        rebounds: playerGameStats.rebounds,
        assists: playerGameStats.assists,
        steals: playerGameStats.steals,
        blocks: playerGameStats.blocks,
        turnovers: playerGameStats.turnovers,
      })
      .from(playerGameStats)
      .where(inArray(playerGameStats.gameId, gfGameIds));

    // Filter to winning team players
    const winningRoster = await client
      .select({ id: players.id })
      .from(players)
      .where(eq(players.teamId, winningTeamId));

    const winnerIds = new Set(winningRoster.map((p) => p.id));
    const winnerLogs = gfLogs.filter((l) => winnerIds.has(l.playerId));

    // Aggregate and score
    const aggregated = new Map<string, { gp: number; totalPS: number }>();
    for (const log of winnerLogs) {
      const ps = productionScore(log.points, log.rebounds, log.assists, log.steals, log.blocks, log.turnovers);
      const prev = aggregated.get(log.playerId) ?? { gp: 0, totalPS: 0 };
      aggregated.set(log.playerId, { gp: prev.gp + 1, totalPS: prev.totalPS + ps });
    }

    let bestPlayerId: string | null = null;
    let bestAvgPS = -Infinity;
    for (const [pid, stat] of aggregated.entries()) {
      const avgPS = stat.totalPS / stat.gp;
      if (avgPS > bestAvgPS) {
        bestAvgPS = avgPS;
        bestPlayerId = pid;
      }
    }

    if (!bestPlayerId) {
      return { success: false, error: "Could not determine Finals MVP." };
    }

    // Get the Finals MVP's team (should be winning team)
    const [fmvpPlayer] = await client.select({ teamId: players.teamId }).from(players).where(eq(players.id, bestPlayerId)).limit(1);

    // Insert season champion record (idempotent clear first)
    await client.delete(seasonChampions).where(eq(seasonChampions.seasonYear, seasonYear));
    await client.insert(seasonChampions).values({
      seasonYear,
      championTeamId: winningTeamId,
      runnerUpTeamId: losingTeamId,
      finalsMvpPlayerId: bestPlayerId,
      seriesScore,
    });

    // Log the Finals MVP award row (idempotent clear first if any FMVP exists for this year)
    await client.delete(playerAwards).where(and(eq(playerAwards.seasonYear, seasonYear), eq(playerAwards.awardType, "FMVP")));
    await client.insert(playerAwards).values({
      seasonYear,
      awardType: "FMVP",
      playerId: bestPlayerId,
      teamId: winningTeamId,
    });

    console.log(`[Awards Engine] Finals MVP: ${bestPlayerId} (avg PS: ${bestAvgPS.toFixed(1)}). Champion: ${winningTeamId}`);
    return { success: true, finalsMvpPlayerId: bestPlayerId };
  } catch (error: any) {
    console.error("[Awards Engine] Failed to calculate Finals MVP:", error);
    return { success: false, error: error.message || "Failed to calculate Finals MVP." };
  }
}

// ─── History Fetch Action ─────────────────────────────────────────────────────
export async function getLeagueHistoryAction() {
  try {
    const teamsHome = aliasedTable(teams, "teams_home");
    const teamsAway = aliasedTable(teams, "teams_away");
    const playersMVP = aliasedTable(players, "players_mvp");
    const teamsMVP = aliasedTable(teams, "teams_mvp");

    const [champions, awards, allLeague] = await Promise.all([
      db
        .select({
          id: seasonChampions.id,
          seasonYear: seasonChampions.seasonYear,
          championTeamId: seasonChampions.championTeamId,
          championTeam: sql<string>`coalesce(concat(${teamsHome.city}, ' ', ${teamsHome.name}), 'Unknown Team')`,
          runnerUpTeamId: seasonChampions.runnerUpTeamId,
          runnerUpTeam: sql<string>`coalesce(concat(${teamsAway.city}, ' ', ${teamsAway.name}), 'Unknown Team')`,
          finalsMvpPlayerId: seasonChampions.finalsMvpPlayerId,
          finalsMvp: sql<string>`coalesce(concat(${playersMVP.firstName}, ' ', ${playersMVP.lastName}), 'Unknown Player')`,
          finalsMvpTeam: sql<string>`coalesce(concat(${teamsMVP.city}, ' ', ${teamsMVP.name}), '')`,
          seriesScore: seasonChampions.seriesScore,
        })
        .from(seasonChampions)
        .leftJoin(teamsHome, eq(seasonChampions.championTeamId, teamsHome.id))
        .leftJoin(teamsAway, eq(seasonChampions.runnerUpTeamId, teamsAway.id))
        .leftJoin(playersMVP, eq(seasonChampions.finalsMvpPlayerId, playersMVP.id))
        .leftJoin(teamsMVP, eq(playersMVP.teamId, teamsMVP.id))
        .orderBy(seasonChampions.seasonYear),

      db
        .select({
          id: playerAwards.id,
          seasonYear: playerAwards.seasonYear,
          type: playerAwards.awardType,
          playerId: playerAwards.playerId,
          playerName: sql<string>`coalesce(concat(${players.firstName}, ' ', ${players.lastName}), 'Unknown Player')`,
          teamId: playerAwards.teamId,
          teamName: sql<string>`coalesce(concat(${teams.city}, ' ', ${teams.name}), 'Unknown Team')`,
          position: players.position,
        })
        .from(playerAwards)
        .leftJoin(players, eq(playerAwards.playerId, players.id))
        .leftJoin(teams, eq(playerAwards.teamId, teams.id))
        .orderBy(playerAwards.seasonYear),

      db
        .select({
          id: allLeagueTeams.id,
          seasonYear: allLeagueTeams.seasonYear,
          type: allLeagueTeams.type,
          position: allLeagueTeams.position,
          playerId: allLeagueTeams.playerId,
          playerName: sql<string>`coalesce(concat(${players.firstName}, ' ', ${players.lastName}), 'Unknown Player')`,
        })
        .from(allLeagueTeams)
        .leftJoin(players, eq(allLeagueTeams.playerId, players.id))
        .orderBy(allLeagueTeams.seasonYear),
    ]);

    // All unique season years — newest first
    const allYears = Array.from(
      new Set([
        ...champions.map((c) => c.seasonYear),
        ...awards.map((a) => a.seasonYear),
        ...allLeague.map((a) => a.seasonYear),
      ])
    ).sort((a, b) => b - a);

    const seasons = allYears.map((year) => {
      const champion = champions.find((c) => c.seasonYear === year);
      const seasonAwards = awards.filter((a) => a.seasonYear === year);
      const seasonAllLeague = allLeague.filter((a) => a.seasonYear === year);

      // Award order for display
      const awardOrder = ["MVP", "ROY", "DPOY", "6MOTY"];
      const sortedAwards = [...seasonAwards].sort(
        (a, b) => awardOrder.indexOf(a.type) - awardOrder.indexOf(b.type)
      );

      return {
        year,
        champion: champion
          ? {
              championTeam: champion.championTeam,
              runnerUpTeam: champion.runnerUpTeam,
              finalsMvp: champion.finalsMvp,
              finalsMvpTeam: champion.finalsMvpTeam,
              seriesScore: champion.seriesScore,
            }
          : null,
        awards: sortedAwards.map((a) => ({
          type: a.type,
          playerName: a.playerName,
          teamName: a.teamName,
          position: a.position ?? "",
        })),
        allLeagueTeams: (["All-League 1st", "All-League 2nd", "All-League 3rd", "All-Defensive"] as const)
          .map((teamType) => ({
            type: teamType as string,
            members: seasonAllLeague
              .filter((m) => m.type === teamType)
              .map((m) => ({
                position: m.position,
                playerName: m.playerName,
              }))
              .sort((a, b) => {
                const order: Record<string, number> = { G: 0, F: 1, C: 2 };
                return (order[a.position] ?? 9) - (order[b.position] ?? 9);
              }),
          }))
          .filter((t) => t.members.length > 0),
      };
    });

    return { success: true, seasons };
  } catch (error: any) {
    console.error("[Awards Engine] Failed to fetch league history:", error);
    return { success: false, seasons: [], error: error.message || "Failed to fetch league history." };
  }
}

export async function getSeasonAwardsAction(seasonYear?: number) {
  try {
    let targetYear = seasonYear;
    if (!targetYear) {
      const maxAward = await db
        .select({ year: sql<number>`max(${playerAwards.seasonYear})` })
        .from(playerAwards);
      targetYear = maxAward[0]?.year ?? 2026;
    }

    const awards = await db
      .select({
        id: playerAwards.id,
        seasonYear: playerAwards.seasonYear,
        type: playerAwards.awardType,
        playerId: playerAwards.playerId,
        playerName: sql<string>`coalesce(concat(${players.firstName}, ' ', ${players.lastName}), 'Unknown Player')`,
        teamName: sql<string>`coalesce(concat(${teams.city}, ' ', ${teams.name}), 'Unknown Team')`,
        position: players.position,
        overall: players.overall,
      })
      .from(playerAwards)
      .leftJoin(players, eq(playerAwards.playerId, players.id))
      .leftJoin(teams, eq(playerAwards.teamId, teams.id))
      .where(eq(playerAwards.seasonYear, targetYear));

    const allLeague = await db
      .select({
        id: allLeagueTeams.id,
        seasonYear: allLeagueTeams.seasonYear,
        type: allLeagueTeams.type,
        position: allLeagueTeams.position,
        playerId: allLeagueTeams.playerId,
        playerName: sql<string>`coalesce(concat(${players.firstName}, ' ', ${players.lastName}), 'Unknown Player')`,
        teamName: sql<string>`coalesce(concat(${teams.city}, ' ', ${teams.name}), 'Unknown Team')`,
        playerOverall: players.overall,
        playerPosition: players.position,
      })
      .from(allLeagueTeams)
      .leftJoin(players, eq(allLeagueTeams.playerId, players.id))
      .leftJoin(teams, eq(players.teamId, teams.id))
      .where(eq(allLeagueTeams.seasonYear, targetYear));

    return { success: true, awards, allLeague };
  } catch (error: any) {
    console.error("Failed to fetch season awards:", error);
    return { success: false, error: error.message || "Failed to fetch awards." };
  }
}
