"use server";

import { db } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { players, teams, transactions, games } from "@/db/schema";
import { MIN_ROSTER_SIZE, MAX_ROSTER_SIZE } from "@/lib/constants";

// Position Group helper
function getPositionGroup(pos: string): "G" | "F" | "C" {
  const p = pos.toUpperCase();
  if (p === "PG" || p === "SG" || p === "G") return "G";
  if (p === "SF" || p === "PF" || p === "F") return "F";
  return "C";
}

/**
 * Toggles a player's trade block status.
 */
export async function togglePlayerTradeBlockAction(playerId: string, isOnBlock: boolean) {
  try {
    await db
      .update(players)
      .set({ isOnTradeBlock: isOnBlock })
      .where(eq(players.id, playerId));
    return { success: true };
  } catch (error: any) {
    console.error("Error toggling trade block:", error);
    return { success: false, error: error.message || "Failed to toggle trade block status." };
  }
}

/**
 * Scans the league's CPU teams to generate up to 3 distinct trade offers for a user player.
 */
export async function getTradeOffersAction(userPlayerId: string) {
  try {
    // 1. Fetch user player
    const [userPlayer] = await db
      .select()
      .from(players)
      .where(eq(players.id, userPlayerId))
      .limit(1);

    if (!userPlayer || !userPlayer.teamId) {
      return [];
    }

    const userTeamId = userPlayer.teamId;

    // 2. Fetch all teams and active players to build rosters in memory
    const allTeams = await db.select().from(teams);
    const activePlayers = await db
      .select()
      .from(players)
      .where(eq(players.status, "Active"));

    // Map players to their teams
    const rostersByTeam = new Map<string, typeof players.$inferSelect[]>();
    for (const p of activePlayers) {
      if (p.teamId) {
        if (!rostersByTeam.has(p.teamId)) {
          rostersByTeam.set(p.teamId, []);
        }
        rostersByTeam.get(p.teamId)!.push(p);
      }
    }

    const userRoster = rostersByTeam.get(userTeamId) || [];
    const userTeamSalary = userRoster.reduce((sum, p) => sum + p.salary, 0);

    // Filter CPU teams (29 teams total)
    const cpuTeams = allTeams.filter((t) => t.id !== userTeamId);

    // Fisher-Yates shuffle CPU teams
    const shuffledCpuTeams = [...cpuTeams];
    for (let i = shuffledCpuTeams.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffledCpuTeams[i];
      shuffledCpuTeams[i] = shuffledCpuTeams[j];
      shuffledCpuTeams[j] = temp;
    }

    const offers: Array<{
      cpuPlayer: typeof players.$inferSelect;
      cpuTeamName: string;
      cpuTeamCity: string;
    }> = [];

    const SALARY_CAP = 50000000;

    // Iterate through shuffled CPU teams to find up to 3 counter-offers
    for (const cpuTeam of shuffledCpuTeams) {
      if (offers.length >= 3) break;

      const cpuRoster = rostersByTeam.get(cpuTeam.id) || [];
      const cpuTeamSalary = cpuRoster.reduce((sum, p) => sum + p.salary, 0);

      // Condition C: Both teams must stay within MIN_ROSTER_SIZE-MAX_ROSTER_SIZE player active limits post-swap
      if (userRoster.length < MIN_ROSTER_SIZE || userRoster.length > MAX_ROSTER_SIZE) continue;
      if (cpuRoster.length < MIN_ROSTER_SIZE || cpuRoster.length > MAX_ROSTER_SIZE) continue;

      for (const cpuPlayer of cpuRoster) {
        // Condition A: Position Group Match
        if (getPositionGroup(cpuPlayer.position) !== getPositionGroup(userPlayer.position)) {
          continue;
        }

        // Condition B: Financial & Talent Motivation (Asset Optimization Rules)
        const isHigherSalary = cpuPlayer.salary > userPlayer.salary;
        let isMotivationMet = false;

        if (isHigherSalary) {
          // CPU wants to clear cap space: they trade cpuPlayer (higher salary) for userPlayer (lower salary)
          // provided target player (userPlayer) is younger or within 5 OVR points
          const isYounger = userPlayer.age < cpuPlayer.age;
          const isWithinOvrLimit = (cpuPlayer.overall - userPlayer.overall) <= 5;
          if (isYounger || isWithinOvrLimit) {
            isMotivationMet = true;
          }
        } else {
          // CPU wants to upgrade: they trade cpuPlayer (lower OVR, lower salary) for userPlayer (higher OVR)
          // provided userPlayer (incoming) is +3 or greater OVR rating
          const isUpgrade = userPlayer.overall >= cpuPlayer.overall + 3;
          if (isUpgrade) {
            isMotivationMet = true;
          }
        }

        if (!isMotivationMet) continue;

        // Condition C: Both teams must stay underneath the ₱50,000,000 cap limit post-swap
        const newUserSalary = userTeamSalary - userPlayer.salary + cpuPlayer.salary;
        const newCpuSalary = cpuTeamSalary - cpuPlayer.salary + userPlayer.salary;

        if (newUserSalary <= SALARY_CAP && newCpuSalary <= SALARY_CAP) {
          offers.push({
            cpuPlayer,
            cpuTeamName: cpuTeam.name,
            cpuTeamCity: cpuTeam.city,
          });
          // Max 1 offer per CPU team to ensure diversity
          break;
        }
      }
    }

    return offers;
  } catch (error: any) {
    console.error("Error generating trade offers:", error);
    return [];
  }
}

/**
 * Executes a 1-for-1 player trade between the user and a CPU team.
 */
export async function executeUserTradeAction(userPlayerId: string, cpuPlayerId: string) {
  try {
    // 1. Fetch user player and CPU player
    const [userPlayer] = await db.select().from(players).where(eq(players.id, userPlayerId)).limit(1);
    const [cpuPlayer] = await db.select().from(players).where(eq(players.id, cpuPlayerId)).limit(1);

    if (!userPlayer || !cpuPlayer) {
      return { success: false, error: "One or both players could not be found." };
    }

    if (!userPlayer.teamId || !cpuPlayer.teamId) {
      return { success: false, error: "One or both players are currently free agents." };
    }

    const userTeamId = userPlayer.teamId;
    const cpuTeamId = cpuPlayer.teamId;

    const [userTeam] = await db.select().from(teams).where(eq(teams.id, userTeamId)).limit(1);
    const [cpuTeam] = await db.select().from(teams).where(eq(teams.id, cpuTeamId)).limit(1);

    if (!userTeam || !cpuTeam) {
      return { success: false, error: "Team information could not be resolved." };
    }

    // 2. Fetch current season and game day from games table
    const lastGame = await db
      .select({ year: games.seasonYear, day: games.gameNumber })
      .from(games)
      .orderBy(desc(games.seasonYear), desc(games.gameNumber))
      .limit(1);
    const currentSeasonYear = lastGame[0]?.year ?? 2026;
    const currentDay = lastGame[0]?.day ?? 1;

    // 3. Swap the teamId values of both players and reset isOnTradeBlock flags to false
    await db
      .update(players)
      .set({ teamId: cpuTeamId, isOnTradeBlock: false })
      .where(eq(players.id, userPlayerId));

    await db
      .update(players)
      .set({ teamId: userTeamId, isOnTradeBlock: false })
      .where(eq(players.id, cpuPlayerId));

    // 4. Insert an official entry into the transactions table
    const descStr = `🔄 TRADE: The ${userTeam.city} ${userTeam.name} traded ${userPlayer.firstName} ${userPlayer.lastName} (${userPlayer.position}, OVR ${userPlayer.overall}) to the ${cpuTeam.city} ${cpuTeam.name} in exchange for ${cpuPlayer.firstName} ${cpuPlayer.lastName} (${cpuPlayer.position}, OVR ${cpuPlayer.overall}).`;

    await db.insert(transactions).values({
      type: "Trade",
      description: descStr,
      seasonYear: currentSeasonYear,
      gameDay: currentDay,
    });

    console.log(`[Trade Action] Mid-season trade executed successfully: ${descStr}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error executing trade:", error);
    return { success: false, error: error.message || "Failed to execute trade." };
  }
}
