"use server";

import { db } from "@/db";
import { eq, and, desc, sql, inArray, isNull, isNotNull } from "drizzle-orm";
import { players, teams, games, transactions, draftPicks, draftSessions, playerSalaryHistory } from "@/db/schema";
import { generateScheduleAction } from "@/app/actions/leagueEngine";
import { generateRookiePoolAction, replenishLeagueRostersAction, getOrCreateActiveDraftSessionBySeason, initializeDraftSessionAction } from "@/app/actions/offseasonEngine";
import { enforceLeagueRosterLimitsAction } from "@/app/actions/cpuAiEngine";

// Dynamic team budget cap replaces SALARY_CAP

// Phase 1: Expiring Players
export async function getExpiringPlayersAction(teamId: string) {
  try {
    const expiring = await db
      .select()
      .from(players)
      .where(
        and(
          eq(players.teamId, teamId),
          eq(players.contractYearsRemaining, 1),
          eq(players.status, "Active")
        )
      )
      .orderBy(desc(players.overall));
    return { success: true, players: expiring };
  } catch (error: any) {
    console.error("Failed to fetch expiring players:", error);
    return { success: false, error: error.message || "Failed to fetch expiring players." };
  }
}

// Phase 1: Re-Sign Player
export async function reSignPlayerAction(playerId: string, years: number, salary: number) {
  try {
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) return { success: false, error: "Player not found." };
    if (!player.teamId) return { success: false, error: "Player does not belong to a team." };

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, player.teamId))
      .limit(1);
    if (!team) return { success: false, error: "Team not found." };

    const teamPlayers = await db.select().from(players).where(eq(players.teamId, player.teamId));
    const totalSalaries = teamPlayers.reduce((sum, p) => sum + p.salary, 0);
    const newTotal = totalSalaries - player.salary + salary;

    if (newTotal > team.budget) {
      const excess = newTotal - team.budget;
      return {
        success: false,
        error: `Re-signing exceeds salary cap by ₱${excess.toLocaleString("en-PH")}. Offer rejected.`
      };
    }

    await db
      .update(players)
      .set({
        contractYearsRemaining: years,
        salary: salary
      })
      .where(eq(players.id, playerId));

    const lastGame = await db
      .select({ year: games.seasonYear })
      .from(games)
      .orderBy(desc(games.seasonYear))
      .limit(1);
    const currentYear = lastGame[0]?.year ?? 2026;
    const upcomingYear = currentYear + 1;

    // Record upcoming salary history
    const existingHistory = await db
      .select({ id: playerSalaryHistory.id })
      .from(playerSalaryHistory)
      .where(and(eq(playerSalaryHistory.playerId, playerId), eq(playerSalaryHistory.seasonYear, upcomingYear)))
      .limit(1);

    if (existingHistory.length > 0) {
      await db
        .update(playerSalaryHistory)
        .set({ salary: salary, teamId: player.teamId })
        .where(eq(playerSalaryHistory.id, existingHistory[0].id));
    } else {
      await db.insert(playerSalaryHistory).values({
        playerId,
        seasonYear: upcomingYear,
        teamId: player.teamId,
        salary: salary,
      });
    }

    await db.insert(transactions).values({
      type: "Signing",
      description: `✍️ ${team.city} ${team.name} re-signed ${player.firstName} ${player.lastName} to a ${years}-year extension worth ₱${salary.toLocaleString("en-PH")}/yr.`,
      seasonYear: currentYear,
      gameDay: 82,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Failed to re-sign player:", error);
    return { success: false, error: error.message || "Failed to re-sign player." };
  }
}

// Phase 1: CPU Re-Signings auto-run
export async function runCpuReSigningsAction() {
  try {
    const allTeams = await db.select().from(teams);
    const expiringCpuPlayers = await db
      .select()
      .from(players)
      .where(
        and(
          eq(players.contractYearsRemaining, 1),
          eq(players.status, "Active")
        )
      );

    const logs: string[] = [];
    const updates: any[] = [];
    const transactionInserts: any[] = [];

    const lastGame = await db
      .select({ year: games.seasonYear })
      .from(games)
      .orderBy(desc(games.seasonYear))
      .limit(1);
    const currentYear = lastGame[0]?.year ?? 2026;

    // Group expiring players by team
    const playersByTeam: Record<string, typeof expiringCpuPlayers> = {};
    for (const player of expiringCpuPlayers) {
      if (player.teamId) {
        if (!playersByTeam[player.teamId]) {
          playersByTeam[player.teamId] = [];
        }
        playersByTeam[player.teamId].push(player);
      }
    }

    for (const team of allTeams) {
      const teamPlayers = await db.select().from(players).where(eq(players.teamId, team.id));
      let currentSalaries = teamPlayers.reduce((sum, p) => sum + p.salary, 0);

      const expiring = playersByTeam[team.id] || [];
      for (const p of expiring) {
        if (p.overall >= 80) {
          const newSalary = p.overall * 40000;
          const salaryDiff = newSalary - p.salary;
          if (currentSalaries + salaryDiff <= team.budget) {
            updates.push({
              id: p.id,
              contractYearsRemaining: 3,
              salary: newSalary
            });
            currentSalaries += salaryDiff;
            const logMsg = `✍️ [${team.city} ${team.name}] re-signed star ${p.firstName} ${p.lastName} (OVR ${p.overall}) to a 3-year extension worth ₱${newSalary.toLocaleString("en-PH")}/yr.`;
            logs.push(logMsg);
            transactionInserts.push({
              type: "Signing",
              description: logMsg,
              seasonYear: currentYear,
              gameDay: 82,
            });
          } else {
            const logMsg = `💔 [${team.city} ${team.name}] let star ${p.firstName} ${p.lastName} (OVR ${p.overall}) walk due to salary cap constraints.`;
            logs.push(logMsg);
            transactionInserts.push({
              type: "Release",
              description: logMsg,
              seasonYear: currentYear,
              gameDay: 82,
            });
          }
        } else {
          logs.push(`🚪 [${team.city} ${team.name}] declined to extend ${p.firstName} ${p.lastName} (OVR ${p.overall}).`);
        }
      }
    }

    // Execute updates
    if (updates.length > 0) {
      const batchQueries = updates.map((up) =>
        db.update(players)
          .set({ contractYearsRemaining: up.contractYearsRemaining, salary: up.salary })
          .where(eq(players.id, up.id))
      );

      // Run batch update
      const chunkSize = 50;
      for (let i = 0; i < batchQueries.length; i += chunkSize) {
        await db.batch(batchQueries.slice(i, i + chunkSize) as any);
      }

      // Record upcoming salary history for CPU re-signings
      const upcomingYear = currentYear + 1;
      const playerTeamIds = new Map(expiringCpuPlayers.map((p) => [p.id, p.teamId]));
      const historyInserts = updates.map((up) => ({
        playerId: up.id,
        seasonYear: upcomingYear,
        teamId: playerTeamIds.get(up.id) ?? null,
        salary: up.salary,
      }));

      const playerIds = updates.map((up) => up.id);
      await db
        .delete(playerSalaryHistory)
        .where(
          and(
            inArray(playerSalaryHistory.playerId, playerIds),
            eq(playerSalaryHistory.seasonYear, upcomingYear)
          )
        );

      for (let i = 0; i < historyInserts.length; i += chunkSize) {
        await db.insert(playerSalaryHistory).values(historyInserts.slice(i, i + chunkSize));
      }
    }

    if (transactionInserts.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < transactionInserts.length; i += chunkSize) {
        await db.insert(transactions).values(transactionInserts.slice(i, i + chunkSize));
      }
    }

    return { success: true, logs };
  } catch (error: any) {
    console.error("Failed CPU re-signings:", error);
    return { success: false, error: error.message || "Failed CPU re-signings." };
  }
}

// Phase 3: Draft Lottery Drawing Logic
export async function getDraftLotteryPicksAction() {
  try {
    const allTeams = await db.select().from(teams);
    const regularGames = await db
      .select()
      .from(games)
      .where(and(eq(games.status, "Completed"), eq(games.stage, "Regular")));

    const teamRecords = allTeams.map((team) => {
      const teamGames = regularGames.filter((g) => g.homeTeamId === team.id || g.awayTeamId === team.id);
      let wins = 0;
      let losses = 0;
      for (const g of teamGames) {
        const isHome = g.homeTeamId === team.id;
        const teamScore = isHome ? g.homeScore : g.awayScore;
        const oppScore = isHome ? g.awayScore : g.homeScore;
        if (teamScore > oppScore) wins++; else losses++;
      }
      const total = wins + losses;
      const pct = total > 0 ? wins / total : 0;
      return { team, wins, losses, pct };
    });

    const luzonRecords = teamRecords
      .filter((r) => r.team.conference === "Luzon")
      .sort((a, b) => b.pct !== a.pct ? b.pct - a.pct : b.wins - a.wins);
    const visminRecords = teamRecords
      .filter((r) => r.team.conference === "VisMin")
      .sort((a, b) => b.pct !== a.pct ? b.pct - a.pct : b.wins - a.wins);

    const playoffTeamIds = new Set<string>([
      ...luzonRecords.slice(0, 8).map((r) => r.team.id),
      ...visminRecords.slice(0, 8).map((r) => r.team.id)
    ]);

    // Playoff teams list sorted by record ascending (worst playoff team first) -> picks 15-30
    const playoffTeams = teamRecords
      .filter((r) => playoffTeamIds.has(r.team.id))
      .sort((a, b) => a.pct !== b.pct ? a.pct - b.pct : a.wins - b.wins)
      .map((r) => r.team);

    // Lottery teams list sorted by record ascending (worst lottery team first) -> picks 1-14
    const lotteryTeams = teamRecords
      .filter((r) => !playoffTeamIds.has(r.team.id))
      .sort((a, b) => a.pct !== b.pct ? a.pct - b.pct : a.wins - b.wins)
      .map((r) => r.team);

    // NBA-style lottery odds for the 14 lottery teams (worst to best)
    const LOTTERY_ODDS = [14.0, 14.0, 14.0, 12.5, 10.5, 9.0, 7.5, 6.0, 4.5, 3.0, 2.0, 1.5, 1.0, 0.5];

    const drawnPicks: typeof teams.$inferSelect[] = [];
    const remainingLottery = [...lotteryTeams];

    // Draw picks 1 to 4
    for (let draw = 0; draw < 4; draw++) {
      if (remainingLottery.length === 0) break;
      const currentWeights = remainingLottery.map((team) => {
        const origIndex = lotteryTeams.findIndex((t) => t.id === team.id);
        return origIndex !== -1 ? LOTTERY_ODDS[origIndex] : 0;
      });

      const totalWeight = currentWeights.reduce((sum, w) => sum + w, 0);
      let rand = Math.random() * totalWeight;
      let winnerIndex = 0;

      for (let i = 0; i < currentWeights.length; i++) {
        rand -= currentWeights[i];
        if (rand <= 0) {
          winnerIndex = i;
          break;
        }
      }

      const winner = remainingLottery[winnerIndex];
      drawnPicks.push(winner);
      remainingLottery.splice(winnerIndex, 1);
    }

    // Remaining lottery teams get picks 5-14 (in record order, worst first)
    const draftOrder = [...drawnPicks, ...remainingLottery, ...playoffTeams];

    // Return the lottery draws and draft order, plus the teams and records for UI rendering
    return {
      success: true,
      draftOrder,
      lotteryDraws: drawnPicks,
      lotteryOddsList: lotteryTeams.map((t, idx) => ({
        team: t,
        odds: LOTTERY_ODDS[idx],
        rank: idx + 1,
        record: `${teamRecords.find((r) => r.team.id === t.id)?.wins}-${teamRecords.find((r) => r.team.id === t.id)?.losses}`
      }))
    };
  } catch (error: any) {
    console.error("Failed to generate draft lottery picks:", error);
    return { success: false, error: error.message || "Failed to generate draft lottery picks." };
  }
}

// Phase 5: Finalize Offseason Action
export async function finalizeOffseasonAction() {
  try {
    // 1. Move unselected prospects (status = 'DraftPool') to Free Agency pool (status = 'Active', teamId = null)
    await db
      .update(players)
      .set({
        status: "Active",
        teamId: null,
        contractYearsRemaining: 3
      })
      .where(eq(players.status, "DraftPool"));

    // 2. Fetch current year
    const lastGame = await db
      .select({ year: games.seasonYear })
      .from(games)
      .orderBy(desc(games.seasonYear))
      .limit(1);
    const currentYear = lastGame[0]?.year ?? 2026;
    const nextYear = currentYear + 1;

    // Reset dead cap for all teams at start of the new season
    await db.update(teams).set({ deadCap: 0 });

    // Safety net: enforce strict roster limits (12-18)
    await enforceLeagueRosterLimitsAction();

    // Snapshot all active players' contracts for the new season, avoiding duplicates
    const existingHistory = await db
      .select({ playerId: playerSalaryHistory.playerId })
      .from(playerSalaryHistory)
      .where(eq(playerSalaryHistory.seasonYear, nextYear));
    const existingIds = new Set(existingHistory.map((h) => h.playerId));

    const activePlayers = await db.select().from(players).where(eq(players.status, "Active"));
    const historyInserts = activePlayers
      .filter((p) => !existingIds.has(p.id))
      .map((p) => ({
        playerId: p.id,
        seasonYear: nextYear,
        teamId: p.teamId,
        salary: p.salary,
      }));

    if (historyInserts.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < historyInserts.length; i += chunkSize) {
        await db.insert(playerSalaryHistory).values(historyInserts.slice(i, i + chunkSize));
      }
    }

    // 3. Clear schedule games and stats (will cascade delete playerGameStats)
    await db.delete(games);

    // Clear old transactions (league news feed) for the new season
    await db.delete(transactions);

    // 4. Generate new schedule for the next year
    const scheduleRes = await generateScheduleAction(nextYear);
    if (!scheduleRes.success) {
      throw new Error(scheduleRes.error || "Failed to generate schedule.");
    }

    // 5. Add season start transaction
    await db.insert(transactions).values({
      type: "Signing",
      description: `📣 Season ${nextYear} has officially initialized! Rookie recruits have entered free agency, schedules are generated, and trades are open.`,
      seasonYear: nextYear,
      gameDay: 1,
    });

    // 6. Generate draft picks for the next season (Round 1 & Round 2)
    const allTeams = await db.select().from(teams);
    const draftPicksToInsert: Array<typeof draftPicks.$inferInsert> = [];
    for (const team of allTeams) {
      draftPicksToInsert.push({
        ownerTeamId: team.id,
        originalTeamId: team.id,
        season: nextYear,
        round: 1,
        pickNumber: null,
        isUsed: false,
      });
      draftPicksToInsert.push({
        ownerTeamId: team.id,
        originalTeamId: team.id,
        season: nextYear,
        round: 2,
        pickNumber: null,
        isUsed: false,
      });
    }
    await db.insert(draftPicks).values(draftPicksToInsert);

    // Generate fresh rookie class for the upcoming draft pool (so they can be scouted during the season)
    await generateRookiePoolAction(nextYear, true);

    return { success: true, nextYear };
  } catch (error: any) {
    console.error("Failed to finalize offseason:", error);
    return { success: false, error: error.message || "Failed to finalize offseason." };
  }
}

// Assign pick numbers based on lottery draft order
export async function finalizeLotteryAction(draftOrderIds: string[], season: number) {
  try {
    console.log(`[Offseason] Advancing to Phase 4 for season ${season}`);
    const session = await getOrCreateActiveDraftSessionBySeason(season);
    if (!session) {
      throw new Error("Failed to initialize draft session.");
    }

    // Also update offseasonPhase to 4 in database
    await db
      .update(draftSessions)
      .set({ offseasonPhase: 4, updatedAt: new Date() })
      .where(eq(draftSessions.seasonYear, season));

    for (let i = 0; i < draftOrderIds.length; i++) {
      const teamId = draftOrderIds[i];

      // Round 1
      await db
        .update(draftPicks)
        .set({ pickNumber: i + 1 })
        .where(
          and(
            eq(draftPicks.originalTeamId, teamId),
            eq(draftPicks.round, 1),
            eq(draftPicks.season, season)
          )
        );

      // Round 2
      await db
        .update(draftPicks)
        .set({ pickNumber: 30 + i + 1 })
        .where(
          and(
            eq(draftPicks.originalTeamId, teamId),
            eq(draftPicks.round, 2),
            eq(draftPicks.season, season)
          )
        );
    }
    return { success: true };
  } catch (error: any) {
    console.error("Failed to finalize lottery:", error);
    return { success: false, error: error.message || "Failed to finalize lottery." };
  }
}

async function adjustTeamBudgetsForSeason(upcomingYear: number) {
  const completedYear = upcomingYear - 1;
  console.log(`[Offseason Budget] Adjusting team budgets for completed season ${completedYear}...`);

  // 1. Fetch all teams
  const allTeams = await db.select().from(teams);
  if (allTeams.length === 0) return;

  // 2. Fetch all playoff games for completedYear
  const playoffGames = await db
    .select()
    .from(games)
    .where(
      and(
        eq(games.stage, "Playoffs"),
        eq(games.seasonYear, completedYear)
      )
    );

  if (playoffGames.length === 0) {
    console.log("[Offseason Budget] No playoff games found. Skipping budget adjustments.");
    return;
  }

  // 3. Determine Champion and Runner-up from Grand Finals
  let championId: string | null = null;
  let runnerUpId: string | null = null;

  const gfGames = playoffGames.filter((g) => g.seriesId === "GF_GrandFinals");
  if (gfGames.length > 0) {
    const team1Id = gfGames[0].homeTeamId;
    const team2Id = gfGames[0].awayTeamId;
    let w1 = 0;
    let w2 = 0;
    for (const g of gfGames) {
      if (g.status === "Completed") {
        const isHome = g.homeTeamId === team1Id;
        const wonHome = g.homeScore > g.awayScore;
        if (isHome ? wonHome : !wonHome) {
          w1++;
        } else {
          w2++;
        }
      }
    }
    if (w1 >= 4) {
      championId = team1Id;
      runnerUpId = team2Id;
    } else if (w2 >= 4) {
      championId = team2Id;
      runnerUpId = team1Id;
    }
  }

  // 4. Determine Conference Finals losers
  const cfLosers = new Set<string>();
  const cfLuzonGames = playoffGames.filter((g) => g.seriesId === "CF_Luzon");
  if (cfLuzonGames.length > 0) {
    const team1Id = cfLuzonGames[0].homeTeamId;
    const team2Id = cfLuzonGames[0].awayTeamId;
    let w1 = 0;
    let w2 = 0;
    for (const g of cfLuzonGames) {
      if (g.status === "Completed") {
        const isHome = g.homeTeamId === team1Id;
        const wonHome = g.homeScore > g.awayScore;
        if (isHome ? wonHome : !wonHome) w1++; else w2++;
      }
    }
    if (w1 >= 3) {
      cfLosers.add(team2Id);
    } else if (w2 >= 3) {
      cfLosers.add(team1Id);
    }
  }

  const cfVisMinGames = playoffGames.filter((g) => g.seriesId === "CF_VisMin");
  if (cfVisMinGames.length > 0) {
    const team1Id = cfVisMinGames[0].homeTeamId;
    const team2Id = cfVisMinGames[0].awayTeamId;
    let w1 = 0;
    let w2 = 0;
    for (const g of cfVisMinGames) {
      if (g.status === "Completed") {
        const isHome = g.homeTeamId === team1Id;
        const wonHome = g.homeScore > g.awayScore;
        if (isHome ? wonHome : !wonHome) w1++; else w2++;
      }
    }
    if (w1 >= 3) {
      cfLosers.add(team2Id);
    } else if (w2 >= 3) {
      cfLosers.add(team1Id);
    }
  }

  // 5. Determine which teams missed the playoffs
  const teamsWithPlayoffGames = new Set<string>(
    playoffGames.map((g) => g.homeTeamId).concat(playoffGames.map((g) => g.awayTeamId))
  );

  // 6. Adjust budgets and write logs
  const transactionInserts: any[] = [];
  for (const team of allTeams) {
    let adjustment = 0;
    let reason = "reaching the playoffs";

    if (team.id === championId) {
      adjustment = 5000000;
      reason = "winning the championship";
    } else if (team.id === runnerUpId) {
      adjustment = 2500000;
      reason = "reaching the Grand Finals";
    } else if (cfLosers.has(team.id)) {
      adjustment = 1000000;
      reason = "reaching the Conference Finals";
    } else if (!teamsWithPlayoffGames.has(team.id)) {
      adjustment = -2000000;
      reason = "missing the playoffs";
    } else {
      adjustment = 0;
      reason = "reaching the playoffs";
    }

    const newBudget = Math.max(40000000, Math.min(65000000, team.budget + adjustment));
    const finalAdjustment = newBudget - team.budget;

    // Update in database
    await db
      .update(teams)
      .set({ budget: newBudget })
      .where(eq(teams.id, team.id));

    // Prepare log description
    let adjSign = finalAdjustment >= 0 ? "+" : "-";
    const logDescription = `💼 Budget Update: ${team.city} ${team.name} budget adjusted to ₱${newBudget.toLocaleString("en-PH")} (${adjSign}₱${Math.abs(finalAdjustment).toLocaleString("en-PH")} change) due to ${reason}.`;
    
    transactionInserts.push({
      type: "Signing",
      description: logDescription,
      seasonYear: completedYear,
      gameDay: 82,
    });
  }

  if (transactionInserts.length > 0) {
    await db.insert(transactions).values(transactionInserts);
  }
}

export async function getCurrentOffseasonStateAction(seasonYear: number, userTeamId?: string | null) {
  try {
    // 1. Check if draft pool has players
    const draftPoolCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(players)
      .where(eq(players.status, "DraftPool"));
    let hasDraftPool = Number(draftPoolCount[0]?.count ?? 0) > 0;

    if (!hasDraftPool) {
      console.log(`[Offseason Wizard] Empty draft pool. Auto-generating 75 rookies for ${seasonYear}...`);
      await generateRookiePoolAction(seasonYear, true, 75);
      hasDraftPool = true;
    }

    // 2. Query draft session
    let [session] = await db
      .select()
      .from(draftSessions)
      .where(eq(draftSessions.seasonYear, seasonYear))
      .limit(1);

    if (!session) {
      console.log(`[Offseason Wizard] Creating new draft session for season ${seasonYear}`);
      
      // Compute and apply budget adjustments for the new season
      await adjustTeamBudgetsForSeason(seasonYear);

      const [inserted] = await db
        .insert(draftSessions)
        .values({
          seasonYear,
          status: "pending",
          currentPickNumber: 1,
          currentRound: 1,
          offseasonPhase: 1,
        })
        .returning();
      session = inserted;
    }

    // 3. Check if draft picks have pick numbers assigned (lottery run)
    const picks = await db
      .select({ count: sql<number>`count(*)` })
      .from(draftPicks)
      .where(and(eq(draftPicks.season, seasonYear), isNotNull(draftPicks.pickNumber)));
    const lotteryFinalized = Number(picks[0]?.count ?? 0) > 0;

    // Auto-initialize draft session if missing but lottery is finalized
    if (lotteryFinalized && session.status === "pending") {
      console.log(`[Offseason Wizard] Draft session is pending but lottery is finalized. Auto-initializing draft session for ${seasonYear}...`);
      await initializeDraftSessionAction(seasonYear);
      [session] = await db
        .select()
        .from(draftSessions)
        .where(eq(draftSessions.seasonYear, seasonYear))
        .limit(1);
    }

    const draftSessionStatus = session.status as 'pending' | 'active' | 'completed';
    const draftSessionId = session.id;
    const hasActiveDraftSession = draftSessionStatus === 'active' || draftSessionStatus === 'pending';

    return {
      success: true,
      seasonYear,
      offseasonPhase: session.offseasonPhase as 1 | 2 | 3 | 4 | 5 | 6,
      hasDraftPool,
      hasActiveDraftSession,
      draftSessionId,
      draftSessionStatus
    };
  } catch (error: any) {
    console.error("Failed to get current offseason state:", error);
    return {
      success: false,
      seasonYear,
      offseasonPhase: 1 as const,
      hasDraftPool: false,
      hasActiveDraftSession: false,
      draftSessionId: null,
      draftSessionStatus: null,
      error: error.message || "Failed to get offseason state"
    };
  }
}

export async function updateOffseasonPhaseAction(seasonYear: number, phase: number) {
  try {
    await db
      .update(draftSessions)
      .set({ offseasonPhase: phase, updatedAt: new Date() })
      .where(eq(draftSessions.seasonYear, seasonYear));
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update offseason phase:", error);
    return { success: false, error: error.message || "Failed to update offseason phase." };
  }
}
