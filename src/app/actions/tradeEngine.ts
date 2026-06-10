"use server";

import { db } from "@/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { players, teams, transactions, games, draftPicks } from "@/db/schema";
import { MIN_ROSTER_SIZE, MAX_ROSTER_SIZE } from "@/lib/constants";

export type TradeAsset =
  | { type: "PLAYER"; playerId: string }
  | { type: "PICK"; pickId: string };

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
 * Toggles a draft pick's trade block status.
 */
export async function togglePickTradeBlockAction(pickId: string, isAvailable: boolean) {
  try {
    await db
      .update(draftPicks)
      .set({ isAvailable })
      .where(eq(draftPicks.id, pickId));
    return { success: true };
  } catch (error: any) {
    console.error("Error toggling pick trade block:", error);
    return { success: false, error: error.message || "Failed to toggle pick trade block status." };
  }
}

/**
 * Scans the league's CPU teams to generate up to 3 distinct trade offers for a user asset.
 */
export async function getTradeOffersAction(userAssetId: string, assetType: "PLAYER" | "PICK") {
  try {
    const lastGame = await db
      .select({ year: games.seasonYear, day: games.gameNumber })
      .from(games)
      .orderBy(desc(games.seasonYear), desc(games.gameNumber))
      .limit(1);
    const currentSeasonYear = lastGame[0]?.year ?? 2026;

    let userTeamId = "";
    let userAssetValue = 0;
    let userPlayer: any = null;
    let userPick: any = null;

    if (assetType === "PLAYER") {
      const [p] = await db.select().from(players).where(eq(players.id, userAssetId)).limit(1);
      if (!p || !p.teamId) return [];
      userPlayer = p;
      userTeamId = p.teamId;
      userAssetValue = p.overall;
    } else {
      const [pick] = await db
        .select({
          id: draftPicks.id,
          ownerTeamId: draftPicks.ownerTeamId,
          season: draftPicks.season,
          round: draftPicks.round,
        })
        .from(draftPicks)
        .where(eq(draftPicks.id, userAssetId))
        .limit(1);
      if (!pick || !pick.ownerTeamId) return [];
      userPick = pick;
      userTeamId = pick.ownerTeamId;
      userAssetValue = pick.round === 1 ? 78 : 65;
      const yearsOut = Math.max(0, pick.season - currentSeasonYear);
      userAssetValue -= yearsOut * 2;
    }

    // Load CPU Teams
    const allTeams = await db.select().from(teams);
    const cpuTeams = allTeams.filter((t) => t.id !== userTeamId);

    // Shuffle CPU teams for diversity
    const shuffledCpuTeams = [...cpuTeams].sort(() => Math.random() - 0.5);

    // Load all active players
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

    // Load all unused draft picks
    const unusedPicks = await db
      .select()
      .from(draftPicks)
      .where(eq(draftPicks.isUsed, false));

    const picksByTeam = new Map<string, typeof draftPicks.$inferSelect[]>();
    for (const pick of unusedPicks) {
      if (pick.ownerTeamId) {
        if (!picksByTeam.has(pick.ownerTeamId)) {
          picksByTeam.set(pick.ownerTeamId, []);
        }
        picksByTeam.get(pick.ownerTeamId)!.push(pick);
      }
    }

    const userRoster = rostersByTeam.get(userTeamId) || [];
    const userTeamSalary = userRoster.reduce((sum, p) => sum + p.salary, 0);

    const offers: Array<{
      id: string;
      cpuTeamId: string;
      cpuTeamName: string;
      cpuTeamCity: string;
      cpuPlayers: typeof players.$inferSelect[];
      cpuPicks: typeof draftPicks.$inferSelect[];
      userAssetId: string;
      userAssetType: "PLAYER" | "PICK";
    }> = [];

    const SALARY_CAP = 50000000;

    for (const cpuTeam of shuffledCpuTeams) {
      if (offers.length >= 3) break;

      const cpuRoster = rostersByTeam.get(cpuTeam.id) || [];
      const cpuTeamSalary = cpuRoster.reduce((sum, p) => sum + p.salary, 0);
      const cpuOwnedPicks = picksByTeam.get(cpuTeam.id) || [];

      const potentialPackages: Array<{
        players: typeof players.$inferSelect[];
        picks: typeof draftPicks.$inferSelect[];
        value: number;
      }> = [];

      // 1. Evaluate single players
      for (const p of cpuRoster) {
        if (assetType === "PLAYER" && userPlayer) {
          if (getPositionGroup(p.position) !== getPositionGroup(userPlayer.position)) continue;
        }
        const val = p.overall;
        potentialPackages.push({ players: [p], picks: [], value: val });
      }

      // 2. Evaluate single picks
      for (const pick of cpuOwnedPicks) {
        let val = pick.round === 1 ? 78 : 65;
        const yearsOut = Math.max(0, pick.season - currentSeasonYear);
        val -= yearsOut * 2;
        potentialPackages.push({ players: [], picks: [pick], value: val });
      }

      // 3. Evaluate player + pick packages
      for (const p of cpuRoster) {
        if (assetType === "PLAYER" && userPlayer) {
          if (getPositionGroup(p.position) !== getPositionGroup(userPlayer.position)) continue;
        }
        for (const pick of cpuOwnedPicks.slice(0, 2)) {
          let pVal = p.overall;
          let pickVal = pick.round === 1 ? 78 : 65;
          const yearsOut = Math.max(0, pick.season - currentSeasonYear);
          pickVal -= yearsOut * 2;
          potentialPackages.push({ players: [p], picks: [pick], value: pVal + pickVal });
        }
      }

      // Filter packages close to userAssetValue
      const validPackages = potentialPackages.filter((pkg) => {
        const diff = Math.abs(pkg.value - userAssetValue);
        const maxDiff = userAssetValue * 0.15;
        return diff <= maxDiff;
      });

      if (validPackages.length === 0) continue;

      // Sort valid packages by value proximity to userAssetValue
      validPackages.sort((a, b) => Math.abs(a.value - userAssetValue) - Math.abs(b.value - userAssetValue));

      for (const pkg of validPackages) {
        // Check roster size limits
        const userPlayersCount = userRoster.length;
        const cpuPlayersCount = cpuRoster.length;

        const playersSentByUser = assetType === "PLAYER" ? 1 : 0;
        const playersReceivedByUser = pkg.players.length;

        const newUserRosterCount = userPlayersCount - playersSentByUser + playersReceivedByUser;
        const newCpuRosterCount = cpuPlayersCount - playersReceivedByUser + playersSentByUser;

        if (newUserRosterCount < MIN_ROSTER_SIZE || newUserRosterCount > MAX_ROSTER_SIZE) continue;
        if (newCpuRosterCount < MIN_ROSTER_SIZE || newCpuRosterCount > MAX_ROSTER_SIZE) continue;

        // Check salary cap limits
        const salarySentByUser = assetType === "PLAYER" && userPlayer ? userPlayer.salary : 0;
        const salaryReceivedByUser = pkg.players.reduce((sum, pl) => sum + pl.salary, 0);

        const newUserSalary = userTeamSalary - salarySentByUser + salaryReceivedByUser;
        const newCpuSalary = cpuTeamSalary - salaryReceivedByUser + salarySentByUser;

        if (newUserSalary <= SALARY_CAP && newCpuSalary <= SALARY_CAP) {
          offers.push({
            id: cpuTeam.id,
            cpuTeamId: cpuTeam.id,
            cpuTeamName: cpuTeam.name,
            cpuTeamCity: cpuTeam.city,
            cpuPlayers: pkg.players,
            cpuPicks: pkg.picks,
            userAssetId,
            userAssetType: assetType,
          });
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
 * Executes a trade from the user's trade block.
 */
export async function executeUserTradeAction(
  userAssetId: string,
  userAssetType: "PLAYER" | "PICK",
  cpuTeamId: string,
  cpuPlayerIds: string[],
  cpuPickIds: string[]
) {
  try {
    return await db.transaction(async (tx) => {
      // 1. Fetch current season and game day from games table
      const lastGame = await tx
        .select({ year: games.seasonYear, day: games.gameNumber })
        .from(games)
        .orderBy(desc(games.seasonYear), desc(games.gameNumber))
        .limit(1);
      const currentSeasonYear = lastGame[0]?.year ?? 2026;
      const currentDay = lastGame[0]?.day ?? 1;

      if (currentDay > 50) {
        throw new Error("The trade deadline has passed. Roster adjustments are locked until the offseason.");
      }

      // Fetch CPU Team
      const [cpuTeam] = await tx.select().from(teams).where(eq(teams.id, cpuTeamId)).limit(1);
      if (!cpuTeam) return { success: false, error: "CPU Team not found." };

      let userTeamId = "";
      let userPlayer: any = null;
      let userPick: any = null;

      if (userAssetType === "PLAYER") {
        const [p] = await tx.select().from(players).where(eq(players.id, userAssetId)).limit(1);
        if (!p || !p.teamId) return { success: false, error: "User player not found." };
        userPlayer = p;
        userTeamId = p.teamId;
      } else {
        const [pick] = await tx.select().from(draftPicks).where(eq(draftPicks.id, userAssetId)).limit(1);
        if (!pick || !pick.ownerTeamId) return { success: false, error: "User draft pick not found." };
        userPick = pick;
        userTeamId = pick.ownerTeamId;
      }

      const [userTeam] = await tx.select().from(teams).where(eq(teams.id, userTeamId)).limit(1);
      if (!userTeam) return { success: false, error: "User team not found." };

      // Load CPU players and picks
      const cpuPlayersList = cpuPlayerIds.length > 0
        ? await tx.select().from(players).where(and(eq(players.teamId, cpuTeamId), eq(players.status, "Active")))
        : [];
      const cpuPicksList = cpuPickIds.length > 0
        ? await tx.select().from(draftPicks).where(and(eq(draftPicks.ownerTeamId, cpuTeamId), eq(draftPicks.isUsed, false)))
        : [];

      // Verify that all IDs matched
      const matchedCpuPlayers = cpuPlayersList.filter((p) => cpuPlayerIds.includes(p.id));
      const matchedCpuPicks = cpuPicksList.filter((p) => cpuPickIds.includes(p.id));

      if (matchedCpuPlayers.length !== cpuPlayerIds.length || matchedCpuPicks.length !== cpuPickIds.length) {
        return { success: false, error: "One or more CPU assets were not found or are no longer valid." };
      }

      // Validation check roster sizes
      const fullRosterA = await tx.select().from(players).where(and(eq(players.teamId, userTeamId), eq(players.status, "Active")));
      const fullRosterB = await tx.select().from(players).where(and(eq(players.teamId, cpuTeamId), eq(players.status, "Active")));

      const playersSentByUser = userAssetType === "PLAYER" ? 1 : 0;
      const playersReceivedByUser = matchedCpuPlayers.length;

      const newRosterCountA = fullRosterA.length - playersSentByUser + playersReceivedByUser;
      const newRosterCountB = fullRosterB.length - playersReceivedByUser + playersSentByUser;

      if (newRosterCountA > 18) {
        return { success: false, error: `Trade blocked: Your team exceeds the 18-player maximum (would have ${newRosterCountA}).` };
      }
      if (newRosterCountA < 12) {
        return { success: false, error: `Trade blocked: Your team falls below the 12-player minimum (would have ${newRosterCountA}).` };
      }
      if (newRosterCountB > 18) {
        return { success: false, error: `Trade blocked: Opposing team exceeds the 18-player maximum (would have ${newRosterCountB}).` };
      }
      if (newRosterCountB < 12) {
        return { success: false, error: `Trade blocked: Opposing team falls below the 12-player minimum (would have ${newRosterCountB}).` };
      }

      // Check salary cap limits
      const currentSalariesA = fullRosterA.reduce((sum, p) => sum + p.salary, 0);
      const currentSalariesB = fullRosterB.reduce((sum, p) => sum + p.salary, 0);

      const salarySentByUser = userAssetType === "PLAYER" && userPlayer ? userPlayer.salary : 0;
      const salaryReceivedByUser = matchedCpuPlayers.reduce((sum, p) => sum + p.salary, 0);

      const newSalariesA = currentSalariesA - salarySentByUser + salaryReceivedByUser;
      const newSalariesB = currentSalariesB - salaryReceivedByUser + salarySentByUser;

      if (newSalariesA > 50000000) {
        return { success: false, error: "Trade blocked: Your team exceeds the ₱50,000,000 salary cap." };
      }
      if (newSalariesB > 50000000) {
        return { success: false, error: "Trade blocked: Opposing team exceeds the ₱50,000,000 salary cap." };
      }

      // SWAP ASSETS
      // 1. User Asset
      if (userAssetType === "PLAYER") {
        await tx
          .update(players)
          .set({ teamId: cpuTeamId, isOnTradeBlock: false })
          .where(eq(players.id, userAssetId));
      } else {
        await tx
          .update(draftPicks)
          .set({ ownerTeamId: cpuTeamId, isAvailable: false })
          .where(eq(draftPicks.id, userAssetId));
      }

      // 2. CPU Players
      for (const cp of matchedCpuPlayers) {
        await tx
          .update(players)
          .set({ teamId: userTeamId, isOnTradeBlock: false })
          .where(eq(players.id, cp.id));
      }

      // 3. CPU Picks
      for (const cp of matchedCpuPicks) {
        await tx
          .update(draftPicks)
          .set({ ownerTeamId: userTeamId, isAvailable: false })
          .where(eq(draftPicks.id, cp.id));
      }

      // Generate Description
      let userAssetDesc = "";
      if (userAssetType === "PLAYER" && userPlayer) {
        userAssetDesc = `${userPlayer.firstName} ${userPlayer.lastName} (${userPlayer.position}, OVR ${userPlayer.overall})`;
      } else if (userPick) {
        userAssetDesc = `a ${userPick.season} Round ${userPick.round} pick`;
      }

      const receivedDescs: string[] = [];
      for (const cp of matchedCpuPlayers) {
        receivedDescs.push(`${cp.firstName} ${cp.lastName} (${cp.position}, OVR ${cp.overall})`);
      }
      for (const cp of matchedCpuPicks) {
        receivedDescs.push(`a ${cp.season} Round ${cp.round} pick`);
      }

      const descStr = `🔄 TRADE: The ${userTeam.city} ${userTeam.name} traded ${userAssetDesc} to the ${cpuTeam.city} ${cpuTeam.name} in exchange for ${receivedDescs.join(" and ")}.`;

      await tx.insert(transactions).values({
        type: "Trade",
        description: descStr,
        seasonYear: currentSeasonYear,
        gameDay: currentDay,
      });

      console.log(`[Trade Block Action] User trade block offer accepted: ${descStr}`);
      return { success: true };
    });
  } catch (error: any) {
    console.error("Error executing trade from trade block:", error);
    return { success: false, error: error.message || "Failed to execute trade." };
  }
}
