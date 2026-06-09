"use server";

import { db } from "@/db";
import { eq, and, sql, or, inArray, desc } from "drizzle-orm";
import { teams, players, games, playerGameStats } from "@/db/schema";
import { simulateGameAction } from "@/app/actions/leagueEngine";

interface Team {
  id: string;
  name: string;
  city: string;
  conference: "Luzon" | "VisMin";
  budget: number;
}

// 1. Helper to calculate final standings for seeding
async function getFinalStandings() {
  const allTeams = await db.select().from(teams);
  const completedRegularGames = await db
    .select()
    .from(games)
    .where(and(eq(games.status, "Completed"), eq(games.stage, "Regular")));

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
  conference: "Luzon" | "VisMin" | "Cross"
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
      seasonYear: 2026,
      gameNumber,
      status: "Scheduled",
      stage: "Playoffs",
      playoffRound: round,
      seriesId,
    });
  }

  await db.insert(games).values(gamesToInsert);
}

// 4. Server Action: Verify regular season is complete
export async function checkRegularSeasonCompleteAction() {
  try {
    const regularGames = await db
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .where(and(eq(games.stage, "Regular"), eq(games.status, "Scheduled")));
    
    const totalRegular = await db
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .where(eq(games.stage, "Regular"));

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
    const completeCheck = await checkRegularSeasonCompleteAction();
    if (!completeCheck.success) {
      return { success: false, error: completeCheck.error };
    }
    if (!completeCheck.complete) {
      return { success: false, error: "Regular season must be completed first." };
    }

    const existingPlayoffGames = await db
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .where(eq(games.stage, "Playoffs"))
      .limit(1);

    if (Number(existingPlayoffGames[0]?.count ?? 0) > 0) {
      return { success: false, error: "Playoffs are already initialized." };
    }

    const { north, south } = await getFinalStandings();
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
      await schedulePlayoffSeries(seriesId, teamA, teamB, startDay, 5, "Quarterfinals", "Luzon");
    }

    // Schedule VisMin Quarterfinals
    for (const pair of matchPairs) {
      const teamA = topSouth[pair.seedA - 1];
      const teamB = topSouth[pair.seedB - 1];
      const seriesId = `Q_VisMin_${pair.seedA}v${pair.seedB}`;
      await schedulePlayoffSeries(seriesId, teamA, teamB, startDay, 5, "Quarterfinals", "VisMin");
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error initializing playoffs:", error);
    return { success: false, error: error.message || "Failed to initialize playoffs." };
  }
}

// 6. Server Action: Fetch visual bracket structure
export async function getPlayoffBracketAction() {
  try {
    const playoffGames = await db
      .select()
      .from(games)
      .where(eq(games.stage, "Playoffs"));

    if (playoffGames.length === 0) {
      return { success: true, bracket: [] };
    }

    const allTeams = await db.select().from(teams);
    const teamMap = new Map(allTeams.map((t) => [t.id, t]));

    const { north, south } = await getFinalStandings();
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
    // Find next active scheduled playoff day
    const nextPlayoffGame = await db
      .select({ day: games.gameNumber })
      .from(games)
      .where(and(eq(games.stage, "Playoffs"), eq(games.status, "Scheduled")))
      .orderBy(games.gameNumber)
      .limit(1);

    if (nextPlayoffGame.length === 0) {
      // Check if Grand Finals is clinched
      const gfGames = await db
        .select()
        .from(games)
        .where(eq(games.seriesId, "GF_GrandFinals"));

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
      .where(and(
        eq(games.stage, "Playoffs"),
        eq(games.gameNumber, currentPlayoffDay),
        eq(games.status, "Scheduled")
      ));

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
        .where(eq(games.seriesId, seriesId));

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
          .where(and(eq(games.seriesId, seriesId), eq(games.status, "Scheduled")));
      }
    }

    // Check if the current round is fully complete
    const currentRound = dayGames[0].playoffRound as "Quarterfinals" | "Semifinals" | "ConferenceFinals" | "GrandFinals";
    
    const remainingRoundGames = await db
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .where(and(
        eq(games.playoffRound, currentRound),
        eq(games.status, "Scheduled")
      ));

    const scheduledRemaining = Number(remainingRoundGames[0]?.count ?? 0);

    if (scheduledRemaining === 0) {
      // Current round is completed. Generate matchups for the next round.
      const allRoundGames = await db
        .select()
        .from(games)
        .where(eq(games.playoffRound, currentRound));

      const startDay = Math.max(...allRoundGames.map((g) => g.gameNumber)) + 1;
      const allTeams = await db.select().from(teams);
      const { north, south } = await getFinalStandings();
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
          await schedulePlayoffSeries("S_Luzon_1v8_vs_4v5", lSemis1A, lSemis1B, startDay, 5, "Semifinals", "Luzon");

          // Luzon Bracket Semis 2 (Winner 2v7 vs Winner 3v6)
          const lSemis2A = wLuzon2v7.seed < wLuzon3v6.seed ? wLuzon2v7 : wLuzon3v6;
          const lSemis2B = wLuzon2v7.seed < wLuzon3v6.seed ? wLuzon3v6 : wLuzon2v7;
          await schedulePlayoffSeries("S_Luzon_2v7_vs_3v6", lSemis2A, lSemis2B, startDay, 5, "Semifinals", "Luzon");

          // VisMin Bracket Semis 1 (Winner 1v8 vs Winner 4v5)
          const vSemis1A = wVisMin1v8.seed < wVisMin4v5.seed ? wVisMin1v8 : wVisMin4v5;
          const vSemis1B = wVisMin1v8.seed < wVisMin4v5.seed ? wVisMin4v5 : wVisMin1v8;
          await schedulePlayoffSeries("S_VisMin_1v8_vs_4v5", vSemis1A, vSemis1B, startDay, 5, "Semifinals", "VisMin");

          // VisMin Bracket Semis 2 (Winner 2v7 vs Winner 3v6)
          const vSemis2A = wVisMin2v7.seed < wVisMin3v6.seed ? wVisMin2v7 : wVisMin3v6;
          const vSemis2B = wVisMin2v7.seed < wVisMin3v6.seed ? wVisMin3v6 : wVisMin2v7;
          await schedulePlayoffSeries("S_VisMin_2v7_vs_3v6", vSemis2A, vSemis2B, startDay, 5, "Semifinals", "VisMin");
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
          await schedulePlayoffSeries("CF_Luzon", lCfA, lCfB, startDay, 5, "ConferenceFinals", "Luzon");

          const vCfA = wVisMin1.seed < wVisMin2.seed ? wVisMin1 : wVisMin2;
          const vCfB = wVisMin1.seed < wVisMin2.seed ? wVisMin2 : wVisMin1;
          await schedulePlayoffSeries("CF_VisMin", vCfA, vCfB, startDay, 5, "ConferenceFinals", "VisMin");
        }
      } else if (currentRound === "ConferenceFinals") {
        // Match Grand Finals (Best of 7)
        const lChamp = getWinnerOfSeries("CF_Luzon", allRoundGames, allTeams, seedMap);
        const vChamp = getWinnerOfSeries("CF_VisMin", allRoundGames, allTeams, seedMap);

        if (lChamp && vChamp) {
          await schedulePlayoffSeries("GF_GrandFinals", lChamp, vChamp, startDay, 7, "GrandFinals", "Cross");
        }
      }
      return { success: true, advancedRound: true, simulatedCount };
    }

    return { success: true, simulatedCount };
  } catch (error: any) {
    console.error("Error simulating playoff day:", error);
    return { success: false, error: error.message || "Failed to simulate playoff day." };
  }
}
