"use server";

import { db } from "@/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { players, teams, games, transactions } from "@/db/schema";
import { generateScheduleAction } from "@/app/actions/leagueEngine";
import { generateRookiePoolAction, replenishLeagueRostersAction } from "@/app/actions/offseasonEngine";
import { enforceLeagueRosterLimitsAction } from "@/app/actions/cpuAiEngine";

const SALARY_CAP = 50000000; // 50,000,000 PHP

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

    if (newTotal > SALARY_CAP) {
      const excess = newTotal - SALARY_CAP;
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

    // Record transaction
    const lastGame = await db
      .select({ year: games.seasonYear })
      .from(games)
      .orderBy(desc(games.seasonYear))
      .limit(1);
    const currentYear = lastGame[0]?.year ?? 2026;

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
          if (currentSalaries + salaryDiff <= SALARY_CAP) {
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

    // Safety net: enforce strict roster limits (12-18)
    await enforceLeagueRosterLimitsAction();

    // 3. Clear schedule games and stats (will cascade delete playerGameStats)
    await db.delete(games);

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

    // Generate fresh rookie class for the upcoming draft pool (so they can be scouted during the season)
    await generateRookiePoolAction(nextYear, true);

    return { success: true, nextYear };
  } catch (error: any) {
    console.error("Failed to finalize offseason:", error);
    return { success: false, error: error.message || "Failed to finalize offseason." };
  }
}
