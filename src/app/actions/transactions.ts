"use server";

import { db } from "@/db";
import { eq, inArray, isNull, desc } from "drizzle-orm";
import { teams, players } from "@/db/schema";

const SALARY_CAP = 50000000; // 50,000,000 PHP

export async function getFreeAgents() {
  try {
    return await db
      .select()
      .from(players)
      .where(isNull(players.teamId))
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

    const totalSalaries = activeRoster.reduce((sum, p) => sum + p.salary, 0);
    const space = SALARY_CAP - totalSalaries;

    return {
      success: true,
      totalSalaries,
      space,
      rosterCount: activeRoster.length,
      roster: activeRoster,
    };
  } catch (error: any) {
    console.error("Failed to calculate salary cap details:", error);
    return { success: false, error: error.message || "Failed to load cap details." };
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

    if (currentTeamPlayers.length >= 15) {
      return { success: false, error: "Roster size limit reached. A team can have a maximum of 15 players." };
    }

    const totalSalaries = currentTeamPlayers.reduce((sum, p) => sum + p.salary, 0);

    if (totalSalaries + player.salary > SALARY_CAP) {
      const excess = totalSalaries + player.salary - SALARY_CAP;
      return {
        success: false,
        error: `Cannot sign player. Signing exceeds team salary cap by ${new Intl.NumberFormat(
          "en-PH",
          { style: "currency", currency: "PHP", maximumFractionDigits: 0 }
        ).format(excess)}.`,
      };
    }

    await db
      .update(players)
      .set({ teamId })
      .where(eq(players.id, playerId));

    return { success: true };
  } catch (error: any) {
    console.error("Free agent signing failed:", error);
    return { success: false, error: error.message || "Failed to sign player." };
  }
}

export async function releasePlayerAction(playerId: string) {
  try {
    await db
      .update(players)
      .set({ teamId: null })
      .where(eq(players.id, playerId));

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
  playerBIds: string[]
) {
  if (playerAIds.length === 0 || playerBIds.length === 0) {
    return { success: false, error: "Trade must involve at least one player from each team." };
  }

  try {
    const [teamA] = await db.select().from(teams).where(eq(teams.id, teamAId)).limit(1);
    const [teamB] = await db.select().from(teams).where(eq(teams.id, teamBId)).limit(1);

    if (!teamA || !teamB) {
      return { success: false, error: "One or both teams not found." };
    }

    const rosterA = await db
      .select()
      .from(players)
      .where(inArray(players.id, playerAIds));

    const rosterB = await db
      .select()
      .from(players)
      .where(inArray(players.id, playerBIds));

    if (rosterA.length !== playerAIds.length || rosterB.length !== playerBIds.length) {
      return { success: false, error: "Some players involved in the trade proposal were not found." };
    }

    const invalidA = rosterA.some((p) => p.teamId !== teamAId);
    const invalidB = rosterB.some((p) => p.teamId !== teamBId);

    if (invalidA || invalidB) {
      return { success: false, error: "Roster discrepancy: some players do not belong to their specified team." };
    }

    // Check point deficit (fair trade evaluation)
    const ovrA = rosterA.reduce((sum, p) => sum + p.overall, 0);
    const ovrB = rosterB.reduce((sum, p) => sum + p.overall, 0);

    const ovrDiff = Math.abs(ovrA - ovrB);
    const maxAllowedDiff = Math.max(ovrA, ovrB) * 0.15; // 15% variance

    if (ovrDiff > maxAllowedDiff) {
      return {
        success: false,
        error: `Trade rejected: Unfair deal. The difference in overall player packages (${ovrDiff} points) exceeds the 15% league variance limit (max allowed: ${Math.round(
          maxAllowedDiff
        )} points).`,
      };
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

    if (newRosterCountA > 15) {
      return { success: false, error: `Trade rejected: ${teamA.city} ${teamA.name} cannot have more than 15 players (would have ${newRosterCountA} after trade).` };
    }
    if (newRosterCountB > 15) {
      return { success: false, error: `Trade rejected: ${teamB.city} ${teamB.name} cannot have more than 15 players (would have ${newRosterCountB} after trade).` };
    }

    if (newSalariesA > SALARY_CAP) {
      const excess = newSalariesA - SALARY_CAP;
      return {
        success: false,
        error: `Trade rejected: ${teamA.city} ${teamA.name} will exceed the salary cap by ${new Intl.NumberFormat(
          "en-PH",
          { style: "currency", currency: "PHP", maximumFractionDigits: 0 }
        ).format(excess)} after this trade.`,
      };
    }

    if (newSalariesB > SALARY_CAP) {
      const excess = newSalariesB - SALARY_CAP;
      return {
        success: false,
        error: `Trade rejected: ${teamB.city} ${teamB.name} will exceed the salary cap by ${new Intl.NumberFormat(
          "en-PH",
          { style: "currency", currency: "PHP", maximumFractionDigits: 0 }
        ).format(excess)} after this trade.`,
      };
    }

    // Execute updates sequentially
    await db
      .update(players)
      .set({ teamId: teamBId })
      .where(inArray(players.id, playerAIds));

    await db
      .update(players)
      .set({ teamId: teamAId })
      .where(inArray(players.id, playerBIds));

    return { success: true };
  } catch (error: any) {
    console.error("Trade transaction execution failed:", error);
    return { success: false, error: error.message || "Failed to execute trade." };
  }
}
