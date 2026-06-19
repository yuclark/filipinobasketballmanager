"use server";

import { db } from "@/db";
import { eq, and, sql, or, inArray, desc } from "drizzle-orm";
import { teams, players, games, playerGameStats } from "@/db/schema";
import { simulateGameAction, simulateGameLogic, DBPlayer, calculateFanChange } from "@/app/actions/leagueEngine";
import { calculateFinalsMvpAction, calculateRegularSeasonAwardsAction } from "@/app/actions/awardsEngine";
import crypto from "crypto";

interface Team {
  id: string;
  name: string;
  city: string;
  conference: "Luzon" | "VisMin";
  budget: number;
}

// getCurrentSeasonYear retrieves the latest season year from the games table.
async function getCurrentSeasonYear(): Promise<number> {
  const lastGame = await db
    .select({ year: games.seasonYear })
    .from(games)
    .orderBy(desc(games.seasonYear))
    .limit(1);
  return lastGame[0]?.year ?? 2026;
}

// 1. Helper to calculate final standings for seeding
async function getFinalStandings(seasonYear: number) {
  const allTeams = await db.select().from(teams);
  const completedRegularGames = await db
    .select()
    .from(games)
    .where(
      and(
        eq(games.status, "Completed"),
        eq(games.stage, "Regular"),
        eq(games.seasonYear, seasonYear)
      )
    );

  const calculatedRecords = allTeams.map((team) => {
    const teamGames = completedRegularGames.filter(
      (g) => g.homeTeamId === team.id || g.awayTeamId === team.id
    );

    let wins = 0;
    let losses = 0;

    for (const g of teamGames) {
      const isHome = g.homeTeamId === team.id;
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;

      if (teamScore > oppScore) {
        wins++;
      } else {
        losses++;
      }
    }

    const totalGames = wins + losses;
    const pct = totalGames > 0 ? wins / totalGames : 0;

    return {
      ...team,
      wins,
      losses,
      pct,
    };
  });

  const sortConference = (records: typeof calculatedRecords) => {
    return [...records].sort((a, b) => {
      if (b.pct !== a.pct) return b.pct - a.pct;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.city.localeCompare(b.city);
    });
  };

  const north = sortConference(calculatedRecords.filter((r) => r.conference === "Luzon"));
  const south = sortConference(calculatedRecords.filter((r) => r.conference === "VisMin"));

  return { north, south };
}

// 2. Helper to get the winner of a specific series
function getWinnerOfSeries(
  seriesId: string,
  completedGames: any[],
  teamsList: Team[],
  seedMap: Map<string, number>
) {
  const seriesGames = completedGames.filter((g) => g.seriesId === seriesId);
  if (seriesGames.length === 0) return null;

  const team1Id = seriesGames[0].homeTeamId;
  const team2Id = seriesGames[0].awayTeamId;

  let team1Wins = 0;
  let team2Wins = 0;

  for (const g of seriesGames) {
    if (g.status !== "Completed") continue;
    const isHome = g.homeTeamId === team1Id;
    const teamScore = isHome ? g.homeScore : g.awayScore;
    const oppScore = isHome ? g.awayScore : g.homeScore;

    if (teamScore > oppScore) {
      team1Wins++;
    } else {
      team2Wins++;
    }
  }

  const round = seriesGames[0].playoffRound;
  const targetWins = round === "GrandFinals" ? 4 : 3;

  if (team1Wins >= targetWins) {
    const t = teamsList.find((x) => x.id === team1Id)!;
    return { ...t, seed: seedMap.get(team1Id) ?? 1 };
  }
  if (team2Wins >= targetWins) {
    const t = teamsList.find((x) => x.id === team2Id)!;
    return { ...t, seed: seedMap.get(team2Id) ?? 8 };
  }
  return null;
}

// 3. Helper to schedule games for a best-of-X series
async function schedulePlayoffSeries(
  seriesId: string,
  teamA: Team, // Higher seed
  teamB: Team, // Lower seed
  startDay: number,
  totalGames: number,
  round: "Quarterfinals" | "Semifinals" | "ConferenceFinals" | "GrandFinals",
  conference: "Luzon" | "VisMin" | "Cross",
  seasonYear: number
) {
  const gamesToInsert = [];
  for (let i = 0; i < totalGames; i++) {
    const gameNumber = startDay + i;
    
    // Best of 5 (2-2-1): Game 1, 2, 5 (i=0, 1, 4) at Team A Home; Game 3, 4 (i=2, 3) at Team B Home
    // Best of 7 (2-2-1-1-1): Game 1, 2, 5, 7 (i=0, 1, 4, 6) at Team A Home; Game 3, 4, 6 (i=2, 3, 5) at Team B Home
    let homeTeamId = teamA.id;
    let awayTeamId = teamB.id;

    if (totalGames === 5) {
      if (i === 2 || i === 3) {
        homeTeamId = teamB.id;
        awayTeamId = teamA.id;
      }
    } else if (totalGames === 7) {
      if (i === 2 || i === 3 || i === 5) {
        homeTeamId = teamB.id;
        awayTeamId = teamA.id;
      }
    }

    gamesToInsert.push({
      homeTeamId,
      awayTeamId,
      seasonYear,
      gameNumber,
      status: "Scheduled",
      stage: "Playoffs",
      playoffRound: round,
      seriesId,
    });
  }

  await db.insert(games).values(gamesToInsert);
}

// checkPlayoffsInitializedAction checks if playoffs have already been seeded for the current season.
export async function checkPlayoffsInitializedAction(): Promise<boolean> {
  try {
    const currentYear = await getCurrentSeasonYear();
    const playoffGame = await db
      .select({ id: games.id })
      .from(games)
      .where(
        and(
          eq(games.stage, "Playoffs"),
          eq(games.seasonYear, currentYear)
        )
      )
      .limit(1);

    return playoffGame.length > 0;
  } catch (err) {
    console.error("Error in checkPlayoffsInitializedAction:", err);
    return false;
  }
}

// 4. Server Action: Verify regular season is complete
export async function checkRegularSeasonCompleteAction(seasonYear?: number) {
  try {
    const targetYear = seasonYear ?? (await getCurrentSeasonYear());
    const regularGames = await db
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .where(
        and(
          eq(games.stage, "Regular"),
          eq(games.status, "Scheduled"),
          eq(games.seasonYear, targetYear)
        )
      );
    
    const totalRegular = await db
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .where(
        and(
          eq(games.stage, "Regular"),
          eq(games.seasonYear, targetYear)
        )
      );

    const totalCount = Number(totalRegular[0]?.count ?? 0);
    const scheduledCount = Number(regularGames[0]?.count ?? 0);

    return {
      success: true,
      complete: totalCount > 0 && scheduledCount === 0,
      totalGames: totalCount,
      scheduledGames: scheduledCount,
    };
  } catch (error: any) {
    console.error("Error checking regular season completion:", error);
    return { success: false, complete: false, error: error.message || "Failed to check schedule status." };
  }
}

// 5. Server Action: Initialize playoffs
export async function initializePlayoffsAction() {
  try {
    const currentYear = await getCurrentSeasonYear();

    // Idempotency check: see if playoffs are already initialized for the current season
    const alreadyInitialized = await checkPlayoffsInitializedAction();
    if (alreadyInitialized) {
      return { success: true, alreadyExisted: true, message: "Playoffs already initialized. Proceeding." };
    }

    const completeCheck = await checkRegularSeasonCompleteAction(currentYear);
    if (!completeCheck.success) {
      return { success: false, error: completeCheck.error };
    }
    if (!completeCheck.complete) {
      return { success: false, error: "Regular season must be completed first." };
    }

    const { north, south } = await getFinalStandings(currentYear);
    const topNorth = north.slice(0, 8);
    const topSouth = south.slice(0, 8);

    if (topNorth.length < 8 || topSouth.length < 8) {
      return { success: false, error: "Not enough teams in standings to initialize playoffs." };
    }

    // Traditional matchup seeds: 1v8, 2v7, 3v6, 4v5
    const matchPairs = [
      { seedA: 1, seedB: 8 },
      { seedA: 2, seedB: 7 },
      { seedA: 3, seedB: 6 },
      { seedA: 4, seedB: 5 },
    ];

    const startDay = 83;

    // Schedule Luzon Quarterfinals
    for (const pair of matchPairs) {
      const teamA = topNorth[pair.seedA - 1];
      const teamB = topNorth[pair.seedB - 1];
      const seriesId = `Q_Luzon_${pair.seedA}v${pair.seedB}`;
      await schedulePlayoffSeries(seriesId, teamA, teamB, startDay, 5, "Quarterfinals", "Luzon", currentYear);
    }

    // Schedule VisMin Quarterfinals
    for (const pair of matchPairs) {
      const teamA = topSouth[pair.seedA - 1];
      const teamB = topSouth[pair.seedB - 1];
      const seriesId = `Q_VisMin_${pair.seedA}v${pair.seedB}`;
      await schedulePlayoffSeries(seriesId, teamA, teamB, startDay, 5, "Quarterfinals", "VisMin", currentYear);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error initializing playoffs:", error);
    return { success: false, error: error.message || "Failed to initialize playoffs." };
  }
}

// 6. Server Action: Fetch visual bracket structure
export async function getPlayoffBracketAction(seasonYear?: number) {
  try {
    const targetYear = seasonYear ?? (await getCurrentSeasonYear());
    const playoffGames = await db
      .select()
      .from(games)
      .where(
        and(
          eq(games.stage, "Playoffs"),
          eq(games.seasonYear, targetYear)
        )
      );

    if (playoffGames.length === 0) {
      return { success: true, bracket: [] };
    }

    const allTeams = await db.select().from(teams);
    const teamMap = new Map(allTeams.map((t) => [t.id, t]));

    const { north, south } = await getFinalStandings(targetYear);
    const seedMap = new Map<string, number>();
    north.forEach((t, i) => seedMap.set(t.id, i + 1));
    south.forEach((t, i) => seedMap.set(t.id, i + 1));

    // Group games by seriesId
    const gamesBySeries: Record<string, typeof playoffGames> = {};
    for (const g of playoffGames) {
      if (!g.seriesId) continue;
      if (!gamesBySeries[g.seriesId]) {
        gamesBySeries[g.seriesId] = [];
      }
      gamesBySeries[g.seriesId].push(g);
    }

    const bracket = Object.keys(gamesBySeries).map((seriesId) => {
      const sGames = gamesBySeries[seriesId];
      const round = sGames[0].playoffRound as "Quarterfinals" | "Semifinals" | "ConferenceFinals" | "GrandFinals";
      const homeTeamFirstGame = sGames[0].homeTeamId;
      const awayTeamFirstGame = sGames[0].awayTeamId;

      // Ensure Team A is the higher seed, except GrandFinals where we default to Luzon Champion as Team A
      const isCross = round === "GrandFinals";
      const seedHome = seedMap.get(homeTeamFirstGame) ?? 1;
      const seedAway = seedMap.get(awayTeamFirstGame) ?? 8;

      let teamAId = homeTeamFirstGame;
      let teamBId = awayTeamFirstGame;

      if (!isCross) {
        if (seedAway < seedHome) {
          teamAId = awayTeamFirstGame;
          teamBId = homeTeamFirstGame;
        }
      } else {
        const teamAObj = teamMap.get(homeTeamFirstGame);
        if (teamAObj?.conference === "VisMin") {
          teamAId = awayTeamFirstGame;
          teamBId = homeTeamFirstGame;
        }
      }

      let teamAWins = 0;
      let teamBWins = 0;

      for (const g of sGames) {
        if (g.status !== "Completed") continue;
        const wonHome = g.homeScore > g.awayScore;
        const isHomeTeamA = g.homeTeamId === teamAId;
        if (isHomeTeamA) {
          if (wonHome) teamAWins++; else teamBWins++;
        } else {
          if (wonHome) teamBWins++; else teamAWins++;
        }
      }

      const teamA = teamMap.get(teamAId)!;
      const teamB = teamMap.get(teamBId)!;
      const seedA = seedMap.get(teamAId) ?? 1;
      const seedB = seedMap.get(teamBId) ?? 8;

      const targetWins = round === "GrandFinals" ? 4 : 3;
      const isClinched = teamAWins >= targetWins || teamBWins >= targetWins;
      const winnerId = teamAWins >= targetWins ? teamAId : teamBWins >= targetWins ? teamBId : null;

      const status = isClinched ? "Completed" : (teamAWins > 0 || teamBWins > 0 ? "In Progress" : "Scheduled");

      return {
        seriesId,
        round,
        conference: isCross ? "Cross" : teamA.conference,
        teamA: {
          id: teamA.id,
          city: teamA.city,
          name: teamA.name,
          conference: teamA.conference,
          seed: seedA,
          wins: teamAWins,
        },
        teamB: {
          id: teamB.id,
          city: teamB.city,
          name: teamB.name,
          conference: teamB.conference,
          seed: seedB,
          wins: teamBWins,
        },
        status,
        winnerId,
      };
    });

    return { success: true, bracket };
  } catch (error: any) {
    console.error("Error fetching playoff bracket:", error);
    return { success: false, error: error.message || "Failed to fetch bracket details." };
  }
}



// 7. Server Action: Simulate all matches scheduled for the current playoff day
export async function simulatePlayoffDayAction() {
  try {
    const currentYear = await getCurrentSeasonYear();

    // Find next active scheduled playoff day for the current season
    const nextPlayoffGame = await db
      .select({ day: games.gameNumber })
      .from(games)
      .where(
        and(
          eq(games.stage, "Playoffs"),
          eq(games.status, "Scheduled"),
          eq(games.seasonYear, currentYear)
        )
      )
      .orderBy(games.gameNumber)
      .limit(1);

    if (nextPlayoffGame.length === 0) {
      // Check if Grand Finals is clinched for the current season
      const gfGames = await db
        .select()
        .from(games)
        .where(
          and(
            eq(games.seriesId, "GF_GrandFinals"),
            eq(games.seasonYear, currentYear)
          )
        );

      if (gfGames.length > 0) {
        const team1Id = gfGames[0].homeTeamId;
        let w1 = 0;
        let w2 = 0;
        for (const g of gfGames) {
          if (g.status === "Completed") {
            const isHome = g.homeTeamId === team1Id;
            if (isHome ? g.homeScore > g.awayScore : g.awayScore > g.homeScore) {
              w1++;
            } else {
              w2++;
            }
          }
        }
        if (w1 >= 4 || w2 >= 4) {
          return { success: true, message: "Playoffs are complete. Champion crowned!", complete: true };
        }
      }
      return { success: true, message: "No scheduled playoff games found." };
    }

    const currentPlayoffDay = nextPlayoffGame[0].day;

    // Fetch scheduled matches for this day
    const dayGames = await db
      .select()
      .from(games)
      .where(
        and(
          eq(games.stage, "Playoffs"),
          eq(games.gameNumber, currentPlayoffDay),
          eq(games.status, "Scheduled"),
          eq(games.seasonYear, currentYear)
        )
      );

    const simulatedCount = dayGames.length;
    for (const game of dayGames) {
      await simulateGameAction(game.id);
    }

    // Check series clinches and delete future scheduled games in clinched matchups
    const activeSeriesIds = Array.from(new Set(dayGames.map((g) => g.seriesId).filter(Boolean))) as string[];
    for (const seriesId of activeSeriesIds) {
      const seriesGames = await db
        .select()
        .from(games)
        .where(
          and(
            eq(games.seriesId, seriesId),
            eq(games.seasonYear, currentYear)
          )
        );

      if (seriesGames.length === 0) continue;

      const team1Id = seriesGames[0].homeTeamId;
      let w1 = 0;
      let w2 = 0;
      const round = seriesGames[0].playoffRound;
      const targetWins = round === "GrandFinals" ? 4 : 3;

      for (const sg of seriesGames) {
        if (sg.status !== "Completed") continue;
        const isHome = sg.homeTeamId === team1Id;
        const wonHome = sg.homeScore > sg.awayScore;
        if (isHome) {
          if (wonHome) w1++; else w2++;
        } else {
          if (wonHome) w2++; else w1++;
        }
      }

      if (w1 >= targetWins || w2 >= targetWins) {
        await db
          .delete(games)
          .where(
            and(
              eq(games.seriesId, seriesId),
              eq(games.status, "Scheduled"),
              eq(games.seasonYear, currentYear)
            )
          );
      }
    }

    // Check if the current round is fully complete
    const currentRound = dayGames[0].playoffRound as "Quarterfinals" | "Semifinals" | "ConferenceFinals" | "GrandFinals";
    
    const remainingRoundGames = await db
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .where(
        and(
          eq(games.playoffRound, currentRound),
          eq(games.status, "Scheduled"),
          eq(games.seasonYear, currentYear)
        )
      );

    const scheduledRemaining = Number(remainingRoundGames[0]?.count ?? 0);

    if (scheduledRemaining === 0) {
      // Current round is completed. Generate matchups for the next round.
      const allRoundGames = await db
        .select()
        .from(games)
        .where(
          and(
            eq(games.playoffRound, currentRound),
            eq(games.seasonYear, currentYear)
          )
        );

      const startDay = Math.max(...allRoundGames.map((g) => g.gameNumber)) + 1;
      const allTeams = await db.select().from(teams);
      const { north, south } = await getFinalStandings(currentYear);
      const seedMap = new Map<string, number>();
      north.forEach((t, i) => seedMap.set(t.id, i + 1));
      south.forEach((t, i) => seedMap.set(t.id, i + 1));

      if (currentRound === "Quarterfinals") {
        // Match Semifinals
        const wLuzon1v8 = getWinnerOfSeries("Q_Luzon_1v8", allRoundGames, allTeams, seedMap);
        const wLuzon4v5 = getWinnerOfSeries("Q_Luzon_4v5", allRoundGames, allTeams, seedMap);
        const wLuzon2v7 = getWinnerOfSeries("Q_Luzon_2v7", allRoundGames, allTeams, seedMap);
        const wLuzon3v6 = getWinnerOfSeries("Q_Luzon_3v6", allRoundGames, allTeams, seedMap);

        const wVisMin1v8 = getWinnerOfSeries("Q_VisMin_1v8", allRoundGames, allTeams, seedMap);
        const wVisMin4v5 = getWinnerOfSeries("Q_VisMin_4v5", allRoundGames, allTeams, seedMap);
        const wVisMin2v7 = getWinnerOfSeries("Q_VisMin_2v7", allRoundGames, allTeams, seedMap);
        const wVisMin3v6 = getWinnerOfSeries("Q_VisMin_3v6", allRoundGames, allTeams, seedMap);

        if (wLuzon1v8 && wLuzon4v5 && wLuzon2v7 && wLuzon3v6 && wVisMin1v8 && wVisMin4v5 && wVisMin2v7 && wVisMin3v6) {
          // Luzon Bracket Semis 1 (Winner 1v8 vs Winner 4v5)
          const lSemis1A = wLuzon1v8.seed < wLuzon4v5.seed ? wLuzon1v8 : wLuzon4v5;
          const lSemis1B = wLuzon1v8.seed < wLuzon4v5.seed ? wLuzon4v5 : wLuzon1v8;
          await schedulePlayoffSeries("S_Luzon_1v8_vs_4v5", lSemis1A, lSemis1B, startDay, 5, "Semifinals", "Luzon", currentYear);

          // Luzon Bracket Semis 2 (Winner 2v7 vs Winner 3v6)
          const lSemis2A = wLuzon2v7.seed < wLuzon3v6.seed ? wLuzon2v7 : wLuzon3v6;
          const lSemis2B = wLuzon2v7.seed < wLuzon3v6.seed ? wLuzon3v6 : wLuzon2v7;
          await schedulePlayoffSeries("S_Luzon_2v7_vs_3v6", lSemis2A, lSemis2B, startDay, 5, "Semifinals", "Luzon", currentYear);

          // VisMin Bracket Semis 1 (Winner 1v8 vs Winner 4v5)
          const vSemis1A = wVisMin1v8.seed < wVisMin4v5.seed ? wVisMin1v8 : wVisMin4v5;
          const vSemis1B = wVisMin1v8.seed < wVisMin4v5.seed ? wVisMin4v5 : wVisMin1v8;
          await schedulePlayoffSeries("S_VisMin_1v8_vs_4v5", vSemis1A, vSemis1B, startDay, 5, "Semifinals", "VisMin", currentYear);

          // VisMin Bracket Semis 2 (Winner 2v7 vs Winner 3v6)
          const vSemis2A = wVisMin2v7.seed < wVisMin3v6.seed ? wVisMin2v7 : wVisMin3v6;
          const vSemis2B = wVisMin2v7.seed < wVisMin3v6.seed ? wVisMin3v6 : wVisMin2v7;
          await schedulePlayoffSeries("S_VisMin_2v7_vs_3v6", vSemis2A, vSemis2B, startDay, 5, "Semifinals", "VisMin", currentYear);
        }
      } else if (currentRound === "Semifinals") {
        // Match Conference Finals
        const wLuzon1 = getWinnerOfSeries("S_Luzon_1v8_vs_4v5", allRoundGames, allTeams, seedMap);
        const wLuzon2 = getWinnerOfSeries("S_Luzon_2v7_vs_3v6", allRoundGames, allTeams, seedMap);
        const wVisMin1 = getWinnerOfSeries("S_VisMin_1v8_vs_4v5", allRoundGames, allTeams, seedMap);
        const wVisMin2 = getWinnerOfSeries("S_VisMin_2v7_vs_3v6", allRoundGames, allTeams, seedMap);

        if (wLuzon1 && wLuzon2 && wVisMin1 && wVisMin2) {
          const lCfA = wLuzon1.seed < wLuzon2.seed ? wLuzon1 : wLuzon2;
          const lCfB = wLuzon1.seed < wLuzon2.seed ? wLuzon2 : wLuzon1;
          await schedulePlayoffSeries("CF_Luzon", lCfA, lCfB, startDay, 5, "ConferenceFinals", "Luzon", currentYear);

          const vCfA = wVisMin1.seed < wVisMin2.seed ? wVisMin1 : wVisMin2;
          const vCfB = wVisMin1.seed < wVisMin2.seed ? wVisMin2 : wVisMin1;
          await schedulePlayoffSeries("CF_VisMin", vCfA, vCfB, startDay, 5, "ConferenceFinals", "VisMin", currentYear);
        }
      } else if (currentRound === "ConferenceFinals") {
        // Match Grand Finals (Best of 7)
        const lChamp = getWinnerOfSeries("CF_Luzon", allRoundGames, allTeams, seedMap);
        const vChamp = getWinnerOfSeries("CF_VisMin", allRoundGames, allTeams, seedMap);

        if (lChamp && vChamp) {
          await schedulePlayoffSeries("GF_GrandFinals", lChamp, vChamp, startDay, 7, "GrandFinals", "Cross", currentYear);
        }
      } else if (currentRound === "GrandFinals") {
        // Grand Finals concluded — determine champion and Finals MVP
        const gfGames = allRoundGames;
        const team1Id = gfGames[0]?.homeTeamId;
        const team2Id = gfGames[0]?.awayTeamId;
        let w1 = 0;
        let w2 = 0;
        for (const sg of gfGames) {
          if (sg.status !== "Completed") continue;
          const isHome = sg.homeTeamId === team1Id;
          const wonHome = sg.homeScore > sg.awayScore;
          if (isHome ? wonHome : !wonHome) w1++; else w2++;
        }
        const championTeamId = w1 >= 4 ? team1Id : team2Id;
        const runnerUpTeamId = w1 >= 4 ? team2Id : team1Id;
        const seriesScoreStr = `${Math.max(w1, w2)}-${Math.min(w1, w2)}`;

        console.log(`[Playoff Engine] Grand Finals complete! Champion: ${championTeamId}, Series: ${seriesScoreStr}, Season: ${currentYear}`);
        
        // Run Finals MVP calculation sequentially directly on flat db
        await calculateFinalsMvpAction(currentYear, championTeamId, runnerUpTeamId, seriesScoreStr).catch((err) => {
          console.error("[Playoff Engine] Finals MVP calculation failed:", err);
        });
      }
      return { success: true, advancedRound: true, simulatedCount };
    }

    return { success: true, simulatedCount };
  } catch (error: any) {
    console.error("Error simulating playoff day:", error);
    return { success: false, error: error.message || "Failed to simulate playoff day." };
  }
}

export async function getSeriesGamesAction(seriesId: string) {
  try {
    const currentYear = await getCurrentSeasonYear();
    const seriesGames = await db
      .select({
        id: games.id,
        homeTeamId: games.homeTeamId,
        awayTeamId: games.awayTeamId,
        homeScore: games.homeScore,
        awayScore: games.awayScore,
        status: games.status,
        gameNumber: games.gameNumber,
        seasonYear: games.seasonYear,
      })
      .from(games)
      .where(
        and(
          eq(games.seriesId, seriesId),
          eq(games.seasonYear, currentYear)
        )
      )
      .orderBy(games.gameNumber);

    const allTeams = await db.select().from(teams);
    const teamMap = new Map(allTeams.map((t) => [t.id, t]));

    return {
      success: true,
      games: seriesGames.map((g) => ({
        ...g,
        homeTeam: teamMap.get(g.homeTeamId),
        awayTeam: teamMap.get(g.awayTeamId),
      }))
    };
  } catch (error: any) {
    console.error("Failed to fetch series games:", error);
    return { success: false, error: error.message || "Failed to load series games." };
  }
}

interface InMemoryGame {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  seasonYear: number;
  gameNumber: number;
  status: string;
  stage: string;
  playoffRound: "Quarterfinals" | "Semifinals" | "ConferenceFinals" | "GrandFinals";
  seriesId: string;
  homeScore: number;
  awayScore: number;
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

function schedulePlayoffSeriesInMemory(
  seriesId: string,
  teamA: any,
  teamB: any,
  startDay: number,
  totalGames: number,
  round: "Quarterfinals" | "Semifinals" | "ConferenceFinals" | "GrandFinals",
  seasonYear: number
): InMemoryGame[] {
  const gamesToInsert: InMemoryGame[] = [];
  for (let i = 0; i < totalGames; i++) {
    const gameNumber = startDay + i;
    let homeTeamId = teamA.id;
    let awayTeamId = teamB.id;

    if (totalGames === 5) {
      if (i === 2 || i === 3) {
        homeTeamId = teamB.id;
        awayTeamId = teamA.id;
      }
    } else if (totalGames === 7) {
      if (i === 2 || i === 3 || i === 5) {
        homeTeamId = teamB.id;
        awayTeamId = teamA.id;
      }
    }

    gamesToInsert.push({
      id: crypto.randomUUID(),
      homeTeamId,
      awayTeamId,
      seasonYear,
      gameNumber,
      status: "Scheduled",
      stage: "Playoffs",
      playoffRound: round,
      seriesId,
      homeScore: 0,
      awayScore: 0,
      isNew: true,
    });
  }
  return gamesToInsert;
}

function getWinnerOfSeriesInMemory(
  seriesId: string,
  completedGames: InMemoryGame[],
  teamsList: any[],
  seedMap: Map<string, number>
) {
  const seriesGames = completedGames.filter((g) => g.seriesId === seriesId);
  if (seriesGames.length === 0) return null;

  const team1Id = seriesGames[0].homeTeamId;
  const team2Id = seriesGames[0].awayTeamId;

  let team1Wins = 0;
  let team2Wins = 0;

  for (const g of seriesGames) {
    if (g.status !== "Completed") continue;
    const isHome = g.homeTeamId === team1Id;
    const teamScore = isHome ? g.homeScore : g.awayScore;
    const oppScore = isHome ? g.awayScore : g.homeScore;

    if (teamScore > oppScore) {
      team1Wins++;
    } else {
      team2Wins++;
    }
  }

  const round = seriesGames[0].playoffRound;
  const targetWins = round === "GrandFinals" ? 4 : 3;

  if (team1Wins >= targetWins) {
    const t = teamsList.find((x) => x.id === team1Id)!;
    return { ...t, seed: seedMap.get(team1Id) ?? 1 };
  }
  if (team2Wins >= targetWins) {
    const t = teamsList.find((x) => x.id === team2Id)!;
    return { ...t, seed: seedMap.get(team2Id) ?? 8 };
  }
  return null;
}

export async function simulateUntilGrandFinalsAction() {
  try {
    console.log("[Playoff Engine] Starting fast-forward simulation until Grand Finals...");
    const currentYear = await getCurrentSeasonYear();

    // 1. Fetch active playoff games for the current season
    const dbPlayoffGames = await db
      .select()
      .from(games)
      .where(
        and(
          eq(games.stage, "Playoffs"),
          eq(games.seasonYear, currentYear)
        )
      );

    const inMemoryGames: InMemoryGame[] = dbPlayoffGames.map((g) => ({
      id: g.id,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      seasonYear: g.seasonYear,
      gameNumber: g.gameNumber,
      status: g.status,
      stage: g.stage,
      playoffRound: g.playoffRound as any,
      seriesId: g.seriesId || "",
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      isNew: false,
      isModified: false,
      isDeleted: false,
    }));

    const allTeams = await db.select().from(teams);
    const activePlayers = await db
      .select()
      .from(players)
      .where(eq(players.status, "Active"));

    // Pre-calculate final standings seeds
    const { north, south } = await getFinalStandings(currentYear);
    const seedMap = new Map<string, number>();
    north.forEach((t, i) => seedMap.set(t.id, i + 1));
    south.forEach((t, i) => seedMap.set(t.id, i + 1));

    // Group players into roster maps
    const rostersByTeam = new Map<string, typeof players.$inferSelect[]>();
    for (const p of activePlayers) {
      if (p.teamId) {
        if (!rostersByTeam.has(p.teamId)) {
          rostersByTeam.set(p.teamId, []);
        }
        rostersByTeam.get(p.teamId)!.push(p);
      }
    }

    const inMemoryStats: any[] = [];
    let safetyCounter = 0;
    const maxIterations = 200;

    while (safetyCounter < maxIterations) {
      // Find scheduled games in memory
      const scheduledGames = inMemoryGames.filter(
        (g) => g.status === "Scheduled" && !g.isDeleted
      );

      if (scheduledGames.length === 0) {
        // Round completion check & next round generation
        const completedGames = inMemoryGames.filter(
          (g) => g.status === "Completed" && !g.isDeleted
        );
        if (completedGames.length === 0) {
          break;
        }

        const roundsPresent = new Set(completedGames.map((g) => g.playoffRound));

        // QF Completed -> Semis
        if (
          roundsPresent.has("Quarterfinals") &&
          !roundsPresent.has("Semifinals") &&
          !inMemoryGames.some((g) => g.playoffRound === "Semifinals" && !g.isDeleted)
        ) {
          const qGames = completedGames.filter((g) => g.playoffRound === "Quarterfinals");
          const startDay = Math.max(...qGames.map((g) => g.gameNumber)) + 1;
          const seasonYear = qGames[0]?.seasonYear ?? 2026;

          const wLuzon1v8 = getWinnerOfSeriesInMemory("Q_Luzon_1v8", qGames, allTeams, seedMap);
          const wLuzon4v5 = getWinnerOfSeriesInMemory("Q_Luzon_4v5", qGames, allTeams, seedMap);
          const wLuzon2v7 = getWinnerOfSeriesInMemory("Q_Luzon_2v7", qGames, allTeams, seedMap);
          const wLuzon3v6 = getWinnerOfSeriesInMemory("Q_Luzon_3v6", qGames, allTeams, seedMap);

          const wVisMin1v8 = getWinnerOfSeriesInMemory("Q_VisMin_1v8", qGames, allTeams, seedMap);
          const wVisMin4v5 = getWinnerOfSeriesInMemory("Q_VisMin_4v5", qGames, allTeams, seedMap);
          const wVisMin2v7 = getWinnerOfSeriesInMemory("Q_VisMin_2v7", qGames, allTeams, seedMap);
          const wVisMin3v6 = getWinnerOfSeriesInMemory("Q_VisMin_3v6", qGames, allTeams, seedMap);

          if (
            wLuzon1v8 && wLuzon4v5 && wLuzon2v7 && wLuzon3v6 &&
            wVisMin1v8 && wVisMin4v5 && wVisMin2v7 && wVisMin3v6
          ) {
            const lSemis1A = wLuzon1v8.seed < wLuzon4v5.seed ? wLuzon1v8 : wLuzon4v5;
            const lSemis1B = wLuzon1v8.seed < wLuzon4v5.seed ? wLuzon4v5 : wLuzon1v8;
            const s1 = schedulePlayoffSeriesInMemory("S_Luzon_1v8_vs_4v5", lSemis1A, lSemis1B, startDay, 5, "Semifinals", seasonYear);

            const lSemis2A = wLuzon2v7.seed < wLuzon3v6.seed ? wLuzon2v7 : wLuzon3v6;
            const lSemis2B = wLuzon2v7.seed < wLuzon3v6.seed ? wLuzon3v6 : wLuzon2v7;
            const s2 = schedulePlayoffSeriesInMemory("S_Luzon_2v7_vs_3v6", lSemis2A, lSemis2B, startDay, 5, "Semifinals", seasonYear);

            const vSemis1A = wVisMin1v8.seed < wVisMin4v5.seed ? wVisMin1v8 : wVisMin4v5;
            const vSemis1B = wVisMin1v8.seed < wVisMin4v5.seed ? wVisMin4v5 : wVisMin1v8;
            const s3 = schedulePlayoffSeriesInMemory("S_VisMin_1v8_vs_4v5", vSemis1A, vSemis1B, startDay, 5, "Semifinals", seasonYear);

            const vSemis2A = wVisMin2v7.seed < wVisMin3v6.seed ? wVisMin2v7 : wVisMin3v6;
            const vSemis2B = wVisMin2v7.seed < wVisMin3v6.seed ? wVisMin3v6 : wVisMin2v7;
            const s4 = schedulePlayoffSeriesInMemory("S_VisMin_2v7_vs_3v6", vSemis2A, vSemis2B, startDay, 5, "Semifinals", seasonYear);

            inMemoryGames.push(...s1, ...s2, ...s3, ...s4);
            continue;
          } else {
            throw new Error("Quarterfinals complete in memory, but could not determine all winners.");
          }
        }

        // Semis Completed -> CF
        if (
          roundsPresent.has("Semifinals") &&
          !roundsPresent.has("ConferenceFinals") &&
          !inMemoryGames.some((g) => g.playoffRound === "ConferenceFinals" && !g.isDeleted)
        ) {
          const sGames = completedGames.filter((g) => g.playoffRound === "Semifinals" || g.playoffRound === "Quarterfinals");
          const startDay = Math.max(...completedGames.filter((g) => g.playoffRound === "Semifinals").map((g) => g.gameNumber)) + 1;
          const seasonYear = sGames[0]?.seasonYear ?? 2026;

          const wLuzon1 = getWinnerOfSeriesInMemory("S_Luzon_1v8_vs_4v5", sGames, allTeams, seedMap);
          const wLuzon2 = getWinnerOfSeriesInMemory("S_Luzon_2v7_vs_3v6", sGames, allTeams, seedMap);
          const wVisMin1 = getWinnerOfSeriesInMemory("S_VisMin_1v8_vs_4v5", sGames, allTeams, seedMap);
          const wVisMin2 = getWinnerOfSeriesInMemory("S_VisMin_2v7_vs_3v6", sGames, allTeams, seedMap);

          if (wLuzon1 && wLuzon2 && wVisMin1 && wVisMin2) {
            const lCfA = wLuzon1.seed < wLuzon2.seed ? wLuzon1 : wLuzon2;
            const lCfB = wLuzon1.seed < wLuzon2.seed ? wLuzon2 : wLuzon1;
            const cf1 = schedulePlayoffSeriesInMemory("CF_Luzon", lCfA, lCfB, startDay, 5, "ConferenceFinals", seasonYear);

            const vCfA = wVisMin1.seed < wVisMin2.seed ? wVisMin1 : wVisMin2;
            const vCfB = wVisMin1.seed < wVisMin2.seed ? wVisMin2 : wVisMin1;
            const cf2 = schedulePlayoffSeriesInMemory("CF_VisMin", vCfA, vCfB, startDay, 5, "ConferenceFinals", seasonYear);

            inMemoryGames.push(...cf1, ...cf2);
            continue;
          } else {
            throw new Error("Semifinals complete in memory, but could not determine all winners.");
          }
        }

        // CF Completed -> GF
        if (
          roundsPresent.has("ConferenceFinals") &&
          !roundsPresent.has("GrandFinals") &&
          !inMemoryGames.some((g) => g.playoffRound === "GrandFinals" && !g.isDeleted)
        ) {
          const cfGames = completedGames.filter((g) => g.playoffRound === "ConferenceFinals" || g.playoffRound === "Semifinals" || g.playoffRound === "Quarterfinals");
          const startDay = Math.max(...completedGames.filter((g) => g.playoffRound === "ConferenceFinals").map((g) => g.gameNumber)) + 1;
          const seasonYear = cfGames[0]?.seasonYear ?? 2026;

          const lChamp = getWinnerOfSeriesInMemory("CF_Luzon", cfGames, allTeams, seedMap);
          const vChamp = getWinnerOfSeriesInMemory("CF_VisMin", cfGames, allTeams, seedMap);

          if (lChamp && vChamp) {
            const gfGamesList = schedulePlayoffSeriesInMemory("GF_GrandFinals", lChamp, vChamp, startDay, 7, "GrandFinals", seasonYear);
            inMemoryGames.push(...gfGamesList);
            // Break loop immediately, because Grand Finals is now scheduled
            break;
          } else {
            throw new Error("Conference Finals complete in memory, but could not determine both champions.");
          }
        }

        break;
      }

      // Check if next games to simulate are Grand Finals
      const minDay = Math.min(...scheduledGames.map((g) => g.gameNumber));
      const dayGames = scheduledGames.filter((g) => g.gameNumber === minDay);
      const dayRound = dayGames[0].playoffRound;

      if (dayRound === "GrandFinals") {
        break; // Terminate loop the exact moment the bracket advances to 'GrandFinals'
      }

      // Simulate dayGames in memory
      for (const game of dayGames) {
        const homeRoster = rostersByTeam.get(game.homeTeamId) || [];
        const awayRoster = rostersByTeam.get(game.awayTeamId) || [];

        const healthyHome = homeRoster.filter((p) => !p.injuryDaysRemaining || p.injuryDaysRemaining <= 0);
        const healthyAway = awayRoster.filter((p) => !p.injuryDaysRemaining || p.injuryDaysRemaining <= 0);

        const finalHome = healthyHome.length >= 5 ? healthyHome : [...homeRoster].sort((a, b) => b.overall - a.overall).slice(0, 5);
        const finalAway = healthyAway.length >= 5 ? healthyAway : [...awayRoster].sort((a, b) => b.overall - a.overall).slice(0, 5);

        const res = await simulateGameLogic(
          game,
          finalHome as any,
          finalAway as any
        );

        game.status = "Completed";
        game.homeScore = res.updatedGame.homeScore;
        game.awayScore = res.updatedGame.awayScore;
        game.isModified = true;

        // Update fans inside in-memory allTeams list
        const homeTeamObj = allTeams.find((t) => t.id === game.homeTeamId);
        const awayTeamObj = allTeams.find((t) => t.id === game.awayTeamId);
        if (homeTeamObj && awayTeamObj) {
          const scoreDiff = Math.abs(res.updatedGame.homeScore - res.updatedGame.awayScore);
          const homeWon = res.updatedGame.homeScore > res.updatedGame.awayScore;

          const homeFanChange = calculateFanChange(homeWon, scoreDiff, true);
          const awayFanChange = calculateFanChange(!homeWon, scoreDiff, false);

          homeTeamObj.fans = Math.max(2000, (homeTeamObj.fans ?? 10000) + homeFanChange);
          awayTeamObj.fans = Math.max(2000, (awayTeamObj.fans ?? 10000) + awayFanChange);
        }

        res.playerStatsToInsert.forEach((stat) => {
          stat.gameId = game.id;
          inMemoryStats.push(stat);
        });
      }

      // Series clinches check
      const activeSeriesIds = Array.from(new Set(dayGames.map((g) => g.seriesId).filter(Boolean))) as string[];
      for (const seriesId of activeSeriesIds) {
        const seriesGames = inMemoryGames.filter((g) => g.seriesId === seriesId && !g.isDeleted);
        if (seriesGames.length === 0) continue;

        const team1Id = seriesGames[0].homeTeamId;
        let w1 = 0;
        let w2 = 0;
        const round = seriesGames[0].playoffRound;
        const targetWins = round === "GrandFinals" ? 4 : 3;

        for (const sg of seriesGames) {
          if (sg.status !== "Completed") continue;
          const isHome = sg.homeTeamId === team1Id;
          const wonHome = sg.homeScore > sg.awayScore;
          if (isHome) {
            if (wonHome) w1++; else w2++;
          } else {
            if (wonHome) w2++; else w1++;
          }
        }

        if (w1 >= targetWins || w2 >= targetWins) {
          for (const sg of inMemoryGames) {
            if (sg.seriesId === seriesId && sg.status === "Scheduled") {
              sg.isDeleted = true;
            }
          }
        }
      }

      safetyCounter++;
    }

    // Commit changes
    const batchQueries: any[] = [];

    // Push team fanbase updates
    if (allTeams.length > 0) {
      for (const t of allTeams) {
        batchQueries.push(
          db.update(teams)
            .set({ fans: t.fans })
            .where(eq(teams.id, t.id))
        );
      }
    }

    const gamesToDelete = inMemoryGames.filter((g) => !g.isNew && g.isDeleted).map((g) => g.id);
    if (gamesToDelete.length > 0) {
      batchQueries.push(db.delete(games).where(inArray(games.id, gamesToDelete)));
    }

    const gamesToUpdate = inMemoryGames.filter((g) => !g.isNew && g.isModified && !g.isDeleted);
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

    const gamesToInsert = inMemoryGames
      .filter((g) => g.isNew && !g.isDeleted)
      .map((g) => ({
        id: g.id,
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        seasonYear: g.seasonYear,
        gameNumber: g.gameNumber,
        status: g.status,
        stage: g.stage,
        playoffRound: g.playoffRound,
        seriesId: g.seriesId,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
      }));

    if (gamesToInsert.length > 0) {
      const gameChunkSize = 100;
      for (let i = 0; i < gamesToInsert.length; i += gameChunkSize) {
        batchQueries.push(
          db.insert(games).values(gamesToInsert.slice(i, i + gameChunkSize))
        );
      }
    }

    if (inMemoryStats.length > 0) {
      const statsChunkSize = 500;
      for (let i = 0; i < inMemoryStats.length; i += statsChunkSize) {
        batchQueries.push(
          db.insert(playerGameStats).values(inMemoryStats.slice(i, i + statsChunkSize))
        );
      }
    }

    if (batchQueries.length > 0) {
      const queryChunkSize = 50;
      for (let i = 0; i < batchQueries.length; i += queryChunkSize) {
        await db.batch(batchQueries.slice(i, i + queryChunkSize) as any);
      }
    }

    console.log(`[Playoff Engine] Fast-forward simulation complete. Committed ${gamesToUpdate.length} game updates, ${gamesToInsert.length} new games, and ${inMemoryStats.length} player stats.`);
    return { success: true, status: "GRAND_FINALS_READY" };
  } catch (error: any) {
    console.error("Fast-forward to Grand Finals failed:", error);
    return { success: false, error: error.message || "Failed to fast-forward to Grand Finals." };
  }
}
