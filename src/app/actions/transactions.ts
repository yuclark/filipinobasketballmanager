"use server";

import { db } from "@/db";
import { eq, inArray, isNull, isNotNull, desc, and } from "drizzle-orm";
import { teams, players, transactions, games, draftPicks, playerSalaryHistory } from "@/db/schema";
import { MIN_ROSTER_SIZE, MAX_ROSTER_SIZE } from "@/lib/constants";
import { ensureTeamStarters } from "@/app/actions/cpuAiEngine";



export async function getFreeAgents() {
  try {
    return await db
      .select()
      .from(players)
      .where(and(isNull(players.teamId), eq(players.status, "Active")))
      .orderBy(desc(players.overall));
  } catch (error) {
    console.error("Failed to fetch free agents:", error);
    return [];
  }
}

export async function getOtherTeams(userTeamId: string) {
  try {
    const allTeams = await db.select().from(teams);
    return allTeams.filter((t) => t.id !== userTeamId);
  } catch (error) {
    console.error("Failed to fetch opposing teams:", error);
    return [];
  }
}

export async function getTeamSalarySpace(teamId: string) {
  try {
    const activeRoster = await db
      .select()
      .from(players)
      .where(eq(players.teamId, teamId))
      .orderBy(desc(players.overall));

    const [team] = await db
      .select({ budget: teams.budget, deadCap: teams.deadCap })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return { success: false, error: "Team not found." };
    }

    const totalSalaries = activeRoster.reduce((sum, p) => sum + p.salary, 0);
    const space = team.budget - (totalSalaries + (team.deadCap ?? 0));

    return {
      success: true,
      totalSalaries,
      deadCap: team.deadCap ?? 0,
      budget: team.budget,
      space,
      rosterCount: activeRoster.length,
      roster: activeRoster,
    };
  } catch (error: any) {
    console.error("Failed to calculate salary cap details:", error);
    return { success: false, error: error.message || "Failed to load cap details." };
  }
}

async function getCurrentLeagueDayAndYear() {
  try {
    const nextGame = await db
      .select({ day: games.gameNumber, year: games.seasonYear })
      .from(games)
      .where(eq(games.status, "Scheduled"))
      .orderBy(games.gameNumber)
      .limit(1);

    if (nextGame.length > 0) {
      return { day: nextGame[0].day, year: nextGame[0].year };
    }

    const lastCompletedGame = await db
      .select({ day: games.gameNumber, year: games.seasonYear })
      .from(games)
      .where(eq(games.status, "Completed"))
      .orderBy(desc(games.gameNumber))
      .limit(1);

    if (lastCompletedGame.length > 0) {
      return { day: lastCompletedGame[0].day, year: lastCompletedGame[0].year };
    }

    return { day: 1, year: 2026 };
  } catch (error) {
    console.error("Failed to query league day/year:", error);
    return { day: 1, year: 2026 };
  }
}

export async function getTransactionsAction() {
  try {
    return await db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(50);
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return [];
  }
}

export async function signFreeAgentAction(playerId: string, teamId: string) {
  try {
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      return { success: false, error: "Player not found." };
    }

    if (player.status !== "Active") {
      return { success: false, error: "Player is not active (retired or in draft pool)." };
    }

    if (player.teamId !== null) {
      return { success: false, error: "Player is not a free agent." };
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return { success: false, error: "Team not found." };
    }

    const currentTeamPlayers = await db
      .select()
      .from(players)
      .where(eq(players.teamId, teamId));

    if (currentTeamPlayers.length >= MAX_ROSTER_SIZE) {
      return { success: false, error: "Cannot sign — team is already at the maximum roster size of 18 players." };
    }

    const totalSalaries = currentTeamPlayers.reduce((sum, p) => sum + p.salary, 0);
    const totalPayroll = totalSalaries + (team.deadCap ?? 0);

    if (totalPayroll + player.salary > team.budget) {
      const excess = totalPayroll + player.salary - team.budget;
      return {
        success: false,
        error: `Cannot sign player. Signing exceeds team salary cap by ${new Intl.NumberFormat(
          "en-PH",
          { style: "currency", currency: "PHP", maximumFractionDigits: 0 }
        ).format(excess)}.`,
      };
    }

    const { day, year } = await getCurrentLeagueDayAndYear();

    await db
      .update(players)
      .set({ teamId, contractYearsRemaining: 3 })
      .where(eq(players.id, playerId));

    // Update playerSalaryHistory record for the current season
    await db
      .update(playerSalaryHistory)
      .set({ teamId })
      .where(
        and(
          eq(playerSalaryHistory.playerId, playerId),
          eq(playerSalaryHistory.seasonYear, year)
        )
      );

    const isBlockbuster = player.overall >= 80;
    const prefix = isBlockbuster ? "BLOCKBUSTER: " : "";
    const description = `${prefix}${team.city} ${team.name} signed free agent ${player.firstName} ${player.lastName} for ${new Intl.NumberFormat(
      "en-PH",
      { style: "currency", currency: "PHP", maximumFractionDigits: 0 }
    ).format(player.salary)}.`;

    await db.insert(transactions).values({
      type: "Signing",
      description,
      seasonYear: year,
      gameDay: day,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Free agent signing failed:", error);
    return { success: false, error: error.message || "Failed to sign player." };
  }
}

export async function getTeamOverall(teamId: string): Promise<number> {
  try {
    const roster = await db
      .select({ overall: players.overall })
      .from(players)
      .where(and(eq(players.teamId, teamId), eq(players.status, "Active")))
      .orderBy(desc(players.overall));

    if (roster.length === 0) return 60; // baseline if empty

    const top5 = roster.slice(0, 5);
    const next5 = roster.slice(5, 10);

    const avgTop5 = top5.reduce((sum, p) => sum + p.overall, 0) / Math.max(1, top5.length);
    const avgNext5 = next5.length > 0 
      ? next5.reduce((sum, p) => sum + p.overall, 0) / next5.length 
      : avgTop5 - 10; // penalty if roster is small

    const teamOvr = Math.round(avgTop5 * 0.75 + avgNext5 * 0.25);
    return Math.max(50, Math.min(99, teamOvr));
  } catch (error) {
    console.error("Failed to calculate team overall:", error);
    return 70;
  }
}

export async function sendOfferAction(
  playerId: string,
  teamId: string,
  offerAmount?: number
): Promise<{
  success: boolean;
  status: "accepted" | "rejected";
  accepted?: boolean;
  playerName?: string;
  reason?: string;
  finalOffer?: number;
  playerDemand?: number;
  acceptanceChance?: number;
}> {
  try {
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      return { success: false, status: "rejected", reason: "Player not found." };
    }
    if (player.status !== "Active") {
      return { success: false, status: "rejected", reason: "Player is no longer available." };
    }
    if (player.teamId !== null) {
      return { success: false, status: "rejected", reason: "Player has already signed with another team." };
    }

    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) return { success: false, status: "rejected", reason: "Team not found." };

    const actualOffer = offerAmount ?? player.salary;

    if (actualOffer < 500000) {
      return { success: false, status: "rejected", reason: "Offer is below the league minimum salary of ₱500,000." };
    }

    // Roster size check
    const currentRoster = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.teamId, teamId), isNotNull(players.teamId)));

    if (currentRoster.length >= MAX_ROSTER_SIZE) {
      return { success: false, status: "rejected", reason: `Roster is full (${MAX_ROSTER_SIZE} players max).` };
    }

    // Cap check
    const rosterSalaries = await db
      .select({ salary: players.salary })
      .from(players)
      .where(eq(players.teamId, teamId));
    const currentPayroll = rosterSalaries.reduce((s, p) => s + (p.salary ?? 0), 0);
    const totalPayroll = currentPayroll + (team.deadCap ?? 0);
    const remaining = team.budget - totalPayroll;

    if (actualOffer > remaining) {
      return {
        success: false,
        status: "rejected",
        reason: `Insufficient cap space. You offered ₱${actualOffer.toLocaleString("en-PH")}, but only have ₱${remaining.toLocaleString("en-PH")} remaining.`,
      };
    }

    const playerDemand = player.salary;
    const offerRatio = actualOffer / playerDemand;

    // Team Overall Attractiveness
    const teamOvr = await getTeamOverall(teamId);
    const ovrFactor = (teamOvr - 72) / 150; // High OVR -> bonus, Low OVR -> penalty

    // Age factor (older vets are more easily bought)
    const ageFactor = player.age >= 31 ? Math.min(0.15, (player.age - 30) * 0.02) : 0;

    // OVR-tiered base acceptance probability - higher OVR has higher base chance of signing when met
    const baseChance =
      player.overall >= 85 ? 0.88
      : player.overall >= 75 ? 0.82
      : player.overall >= 65 ? 0.75
      : 0.65;

    // Offer ratio bonus/penalty
    const ratioFactor = offerRatio >= 1 
      ? (offerRatio - 1) * 1.5 
      : -((1 - offerRatio) * 4.0);

    let chance = baseChance + ovrFactor + ageFactor + ratioFactor;
    // Auto reject if offer is way below demand
    if (offerRatio < 0.7) {
      chance = 0.02;
    }
    chance = Math.max(0.10, Math.min(0.97, chance));

    const accepted = Math.random() < chance;
    const playerName = `${player.firstName} ${player.lastName}`;

    if (accepted) {
      const { day, year } = await getCurrentLeagueDayAndYear();

      await db
        .update(players)
        .set({ teamId, contractYearsRemaining: 3, salary: actualOffer })
        .where(eq(players.id, playerId));

      await ensureTeamStarters(teamId);

      // Update playerSalaryHistory record for current season
      await db
        .update(playerSalaryHistory)
        .set({ teamId })
        .where(
          and(
            eq(playerSalaryHistory.playerId, playerId),
            eq(playerSalaryHistory.seasonYear, year)
          )
        );
      const isBlockbuster = player.overall >= 80;
      const prefix = isBlockbuster ? "BLOCKBUSTER: " : "";
      await db.insert(transactions).values({
        type: "Signing",
        description: `${prefix}${team.city} ${team.name} signed free agent ${playerName} for ₱${actualOffer.toLocaleString("en-PH")}/yr (OVR ${player.overall}).`,
        seasonYear: year,
        gameDay: day,
      });

      return {
        success: true,
        status: "accepted",
        accepted: true,
        playerName,
        finalOffer: actualOffer,
        playerDemand,
        acceptanceChance: Math.round(chance * 100),
      };
    } else {
      return {
        success: false,
        status: "rejected",
        accepted: false,
        reason: `${playerName} declined your offer of ₱${actualOffer.toLocaleString("en-PH")}/yr (Chance: ${Math.round(chance * 100)}%).`,
        finalOffer: actualOffer,
        playerDemand,
        acceptanceChance: Math.round(chance * 100),
      };
    }
  } catch (error: any) {
    console.error("sendOfferAction failed:", error);
    return { success: false, status: "rejected", reason: error.message || "Offer failed." };
  }
}

export async function releasePlayerAction(playerId: string) {
  try {
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      return { success: false, error: "Player not found." };
    }

    if (player.status !== "Active") {
      return { success: false, error: "Player is not active." };
    }

    if (!player.teamId) {
      return { success: false, error: "Player is not assigned to a team." };
    }

    const currentTeamPlayers = await db
      .select()
      .from(players)
      .where(and(eq(players.teamId, player.teamId), eq(players.status, "Active")));

    if (currentTeamPlayers.length <= MIN_ROSTER_SIZE) {
      return { success: false, error: `Roster size cannot fall below the league minimum of ${MIN_ROSTER_SIZE} players.` };
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, player.teamId))
      .limit(1);

    const penalty = Math.round(player.salary * 0.5);

    await db
      .update(players)
      .set({ teamId: null, isStarter: false })
      .where(eq(players.id, playerId));

    await ensureTeamStarters(player.teamId);

    const { day, year } = await getCurrentLeagueDayAndYear();

    // Add penalty to team's dead cap
    await db
      .update(teams)
      .set({ deadCap: (team.deadCap ?? 0) + penalty })
      .where(eq(teams.id, player.teamId));

    // Update playerSalaryHistory
    await db
      .update(playerSalaryHistory)
      .set({ teamId: null })
      .where(
        and(
          eq(playerSalaryHistory.playerId, playerId),
          eq(playerSalaryHistory.seasonYear, year)
        )
      );

    const teamNameStr = team ? `${team.city} ${team.name}` : "their team";
    const description = `${player.firstName} ${player.lastName} was waived by ${teamNameStr} into free agency (waive penalty: ₱${penalty.toLocaleString("en-PH")} dead cap).`;

    await db.insert(transactions).values({
      type: "Release",
      description,
      seasonYear: year,
      gameDay: day,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Releasing player failed:", error);
    return { success: false, error: error.message || "Failed to release player." };
  }
}

export async function executeTradeAction(
  teamAId: string,
  playerAIds: string[],
  teamBId: string,
  playerBIds: string[],
  pickAIds?: string[],
  pickBIds?: string[]
) {
  const hasAAssets = playerAIds.length > 0 || (pickAIds && pickAIds.length > 0);
  const hasBAssets = playerBIds.length > 0 || (pickBIds && pickBIds.length > 0);

  if (!hasAAssets || !hasBAssets) {
    return { success: false, error: "Trade must involve at least one asset (player or draft pick) from each team." };
  }

  try {
    const { day, year } = await getCurrentLeagueDayAndYear();
    if (day > 50) {
      throw new Error("The trade deadline has passed. Roster adjustments are locked until the offseason.");
    }

    const [teamA] = await db.select().from(teams).where(eq(teams.id, teamAId)).limit(1);
    const [teamB] = await db.select().from(teams).where(eq(teams.id, teamBId)).limit(1);

    if (!teamA || !teamB) {
      return { success: false, error: "One or both teams not found." };
    }

    const rosterA = playerAIds.length > 0
      ? await db.select().from(players).where(inArray(players.id, playerAIds))
      : [];

    const rosterB = playerBIds.length > 0
      ? await db.select().from(players).where(inArray(players.id, playerBIds))
      : [];

    if (rosterA.length !== playerAIds.length || rosterB.length !== playerBIds.length) {
      return { success: false, error: "Some players involved in the trade proposal were not found." };
    }

    const invalidA = rosterA.some((p) => p.teamId !== teamAId || p.status !== "Active");
    const invalidB = rosterB.some((p) => p.teamId !== teamBId || p.status !== "Active");

    if (invalidA || invalidB) {
      return { success: false, error: "Roster discrepancy: some players do not belong to their specified team or are not active." };
    }

    // Check if the trade includes CPU team B's cornerstone (who is untouchable)
    const activeCpuRoster = await db
      .select()
      .from(players)
      .where(and(eq(players.teamId, teamBId), eq(players.status, "Active")));

    const cornerstone = [...activeCpuRoster].sort((a, b) => {
      if (b.overall !== a.overall) return b.overall - a.overall;
      return a.age - b.age;
    })[0];

    if (cornerstone && playerBIds.includes(cornerstone.id)) {
      return {
        success: false,
        error: `Trade rejected: ${cornerstone.firstName} ${cornerstone.lastName} is the franchise cornerstone of the ${teamB.city} ${teamB.name} and is untouchable.`,
      };
    }

    // Load and validate draft picks
    const picksA = pickAIds && pickAIds.length > 0
      ? await db.select().from(draftPicks).where(inArray(draftPicks.id, pickAIds))
      : [];
    const picksB = pickBIds && pickBIds.length > 0
      ? await db.select().from(draftPicks).where(inArray(draftPicks.id, pickBIds))
      : [];

    const invalidPicksA = picksA.some((p) => p.ownerTeamId !== teamAId || p.isUsed);
    const invalidPicksB = picksB.some((p) => p.ownerTeamId !== teamBId || p.isUsed);

    if (invalidPicksA || invalidPicksB) {
      return { success: false, error: "One or more draft picks are not owned by the proposing team or have already been used." };
    }

    // Check point deficit (fair trade evaluation using exponential valuation and star protection)
    const getVal = (overall: number) => Math.pow(1.10, overall);
    const getPickVal = (round: number) => Math.pow(1.10, round === 1 ? 77 : 64);

    const valA = rosterA.reduce((sum, p) => sum + getVal(p.overall), 0) + picksA.reduce((sum, p) => sum + getPickVal(p.round), 0);
    const valB = rosterB.reduce((sum, p) => sum + getVal(p.overall), 0) + picksB.reduce((sum, p) => sum + getPickVal(p.round), 0);

    const valRatio = valA / valB;

    const maxCpuOvr = rosterB.length > 0 ? Math.max(...rosterB.map(p => p.overall)) : 0;
    let requiredRatio = 1.0; // CPU demands equal or higher value
    if (maxCpuOvr >= 88) {
      requiredRatio = 1.10; // 10% premium for superstars
    } else if (maxCpuOvr >= 80) {
      requiredRatio = 1.05; // 5% premium for stars
    }

    if (valRatio < requiredRatio) {
      return {
        success: false,
        error: `Trade rejected: Opposing front office feels the asset value offered is insufficient${requiredRatio > 1.0 ? " (requires talent premium for star player)" : ""}.`,
      };
    }

    if (valRatio > 1.4) {
      return {
        success: false,
        error: `Trade rejected: League office blocks this trade as it is excessively lopsided in favor of the opposing team.`,
      };
    }

    // Star player protection check
    const maxUserOvr = rosterA.length > 0 ? Math.max(...rosterA.map(p => p.overall)) : 0;
    const hasUserFirstRoundPick = picksA.some(p => p.round === 1);

    if (maxCpuOvr >= 80) {
      if (maxCpuOvr >= 88) {
        const hasProperPlayer = maxUserOvr >= 82;
        const hasFallback = maxUserOvr >= 78 && hasUserFirstRoundPick;
        if (!hasProperPlayer && !hasFallback) {
          return {
            success: false,
            error: `Trade rejected: CPU refuses to trade superstar player (OVR ${maxCpuOvr}) without receiving a high-quality starter (OVR 82+) or a solid starter (OVR 78+) and a first-round draft pick.`,
          };
        }
      } else {
        const hasProperPlayer = maxUserOvr >= 75;
        if (!hasProperPlayer && !hasUserFirstRoundPick) {
          return {
            success: false,
            error: `Trade rejected: CPU refuses to trade star player (OVR ${maxCpuOvr}) without receiving at least a solid rotation player (OVR 75+) or a first-round draft pick.`,
          };
        }
      }
    }

    // Check salary cap limits
    const fullRosterA = await db.select().from(players).where(eq(players.teamId, teamAId));
    const fullRosterB = await db.select().from(players).where(eq(players.teamId, teamBId));

    const currentSalariesA = fullRosterA.reduce((sum, p) => sum + p.salary, 0);
    const currentSalariesB = fullRosterB.reduce((sum, p) => sum + p.salary, 0);

    const salaryOutA = rosterA.reduce((sum, p) => sum + p.salary, 0);
    const salaryOutB = rosterB.reduce((sum, p) => sum + p.salary, 0);

    const newSalariesA = currentSalariesA - salaryOutA + salaryOutB;
    const newSalariesB = currentSalariesB - salaryOutB + salaryOutA;

    // Check roster size limits after trade
    const newRosterCountA = fullRosterA.length - rosterA.length + rosterB.length;
    const newRosterCountB = fullRosterB.length - rosterB.length + rosterA.length;

    if (newRosterCountA > MAX_ROSTER_SIZE) {
      return { success: false, error: "Trade rejected — a team would exceed the 18-player roster maximum." };
    }
    if (newRosterCountA < MIN_ROSTER_SIZE) {
      return { success: false, error: `Trade rejected: ${teamA.city} ${teamA.name} cannot have fewer than ${MIN_ROSTER_SIZE} players (would have ${newRosterCountA} after trade).` };
    }
    if (newRosterCountB > MAX_ROSTER_SIZE) {
      return { success: false, error: "Trade rejected — a team would exceed the 18-player roster maximum." };
    }
    if (newRosterCountB < MIN_ROSTER_SIZE) {
      return { success: false, error: `Trade rejected: ${teamB.city} ${teamB.name} cannot have fewer than ${MIN_ROSTER_SIZE} players (would have ${newRosterCountB} after trade).` };
    }

    const totalPayrollA = newSalariesA + (teamA.deadCap ?? 0);
    const totalPayrollB = newSalariesB + (teamB.deadCap ?? 0);

    if (totalPayrollA > teamA.budget) {
      const excess = totalPayrollA - teamA.budget;
      return {
        success: false,
        error: `Trade rejected: ${teamA.city} ${teamA.name} will exceed the salary cap by ${new Intl.NumberFormat(
          "en-PH",
          { style: "currency", currency: "PHP", maximumFractionDigits: 0 }
        ).format(excess)} after this trade.`,
      };
    }

    if (totalPayrollB > teamB.budget) {
      const excess = totalPayrollB - teamB.budget;
      return {
        success: false,
        error: `Trade rejected: ${teamB.city} ${teamB.name} will exceed the salary cap by ${new Intl.NumberFormat(
          "en-PH",
          { style: "currency", currency: "PHP", maximumFractionDigits: 0 }
        ).format(excess)} after this trade.`,
      };
    }

    // Execute updates sequentially
    if (playerAIds.length > 0) {
      await db
        .update(players)
        .set({ teamId: teamBId, isStarter: false })
        .where(inArray(players.id, playerAIds));

      await db
        .update(playerSalaryHistory)
        .set({ teamId: teamBId })
        .where(
          and(
            inArray(playerSalaryHistory.playerId, playerAIds),
            eq(playerSalaryHistory.seasonYear, year)
          )
        );
    }

    if (playerBIds.length > 0) {
      await db
        .update(players)
        .set({ teamId: teamAId, isStarter: false })
        .where(inArray(players.id, playerBIds));

      await db
        .update(playerSalaryHistory)
        .set({ teamId: teamAId })
        .where(
          and(
            inArray(playerSalaryHistory.playerId, playerBIds),
            eq(playerSalaryHistory.seasonYear, year)
          )
        );
    }

    if (pickAIds && pickAIds.length > 0) {
      await db
        .update(draftPicks)
        .set({ ownerTeamId: teamBId })
        .where(inArray(draftPicks.id, pickAIds));
    }

    if (pickBIds && pickBIds.length > 0) {
      await db
        .update(draftPicks)
        .set({ ownerTeamId: teamAId })
        .where(inArray(draftPicks.id, pickBIds));
    }

    await ensureTeamStarters(teamAId);
    await ensureTeamStarters(teamBId);

    const namesA = [
      ...rosterA.map((p) => `${p.firstName} ${p.lastName}`),
      ...picksA.map((p) => `${p.season} ${p.round === 1 ? "1st" : "2nd"} Round Pick`)
    ].join(", ");

    const namesB = [
      ...rosterB.map((p) => `${p.firstName} ${p.lastName}`),
      ...picksB.map((p) => `${p.season} ${p.round === 1 ? "1st" : "2nd"} Round Pick`)
    ].join(", ");

    const isBlockbuster = rosterA.some((p) => p.overall >= 80) || rosterB.some((p) => p.overall >= 80);
    const prefix = isBlockbuster ? "BLOCKBUSTER: " : "";
    const tradeDesc = `${prefix}TRADE: ${teamA.city} ${teamA.name} sent ${namesA} to ${teamB.city} ${teamB.name} in exchange for ${namesB}.`;

    await db.insert(transactions).values({
      type: "Trade",
      description: tradeDesc,
      seasonYear: year,
      gameDay: day,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Trade transaction execution failed:", error);
    return { success: false, error: error.message || "Failed to execute trade." };
  }
}

export async function getLeagueHistoryContextAction() {
  try {
    const allTeams = await db
      .select({ id: teams.id, name: teams.name, city: teams.city })
      .from(teams);
    const allPlayers = await db
      .select({ id: players.id, firstName: players.firstName, lastName: players.lastName })
      .from(players);
    return { success: true, teams: allTeams, players: allPlayers };
  } catch (error: any) {
    console.error("Failed to fetch league history context:", error);
    return { success: false, error: error.message || "Failed to load context." };
  }
}
