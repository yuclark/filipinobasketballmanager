"use server";

import { db } from "@/db";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { players, teams, transactions, games, draftPicks, tradeProposals, playerSalaryHistory } from "@/db/schema";
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
    const maxSeasonGame = await db
      .select({ year: games.seasonYear })
      .from(games)
      .orderBy(desc(games.seasonYear))
      .limit(1);
    const currentSeasonYear = maxSeasonGame[0]?.year ?? 2026;

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

        const userTeam = allTeams.find((t) => t.id === userTeamId);
        if (userTeam && newUserSalary <= userTeam.budget && newCpuSalary <= cpuTeam.budget) {
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
): Promise<{ success: boolean; error?: string }> {
  try {
    return await db.transaction(async (tx) => {
      // 1. Fetch current season and game day from games table
      const maxSeasonGame = await tx
        .select({ year: games.seasonYear })
        .from(games)
        .orderBy(desc(games.seasonYear))
        .limit(1);
      const currentSeasonYear = maxSeasonGame[0]?.year ?? 2026;

      const nextScheduled = await tx
        .select({ day: games.gameNumber })
        .from(games)
        .where(and(
          eq(games.seasonYear, currentSeasonYear),
          eq(games.status, "Scheduled"),
          eq(games.stage, "Regular")
        ))
        .orderBy(games.gameNumber)
        .limit(1);
      const currentDay = nextScheduled[0]?.day ?? 82;

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

      if (newSalariesA > userTeam.budget) {
        return { success: false, error: `Trade blocked: Your team exceeds the ₱${userTeam.budget.toLocaleString("en-PH")} salary cap.` };
      }
      if (newSalariesB > cpuTeam.budget) {
        return { success: false, error: `Trade blocked: Opposing team exceeds the ₱${cpuTeam.budget.toLocaleString("en-PH")} salary cap.` };
      }

      // SWAP ASSETS
      // 1. User Asset
      if (userAssetType === "PLAYER") {
        await tx
          .update(players)
          .set({ teamId: cpuTeamId, isOnTradeBlock: false })
          .where(eq(players.id, userAssetId));

        await tx
          .update(playerSalaryHistory)
          .set({ teamId: cpuTeamId })
          .where(
            and(
              eq(playerSalaryHistory.playerId, userAssetId),
              eq(playerSalaryHistory.seasonYear, currentSeasonYear)
            )
          );
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

      if (matchedCpuPlayers.length > 0) {
        await tx
          .update(playerSalaryHistory)
          .set({ teamId: userTeamId })
          .where(
            and(
              inArray(
                playerSalaryHistory.playerId,
                matchedCpuPlayers.map((p) => p.id)
              ),
              eq(playerSalaryHistory.seasonYear, currentSeasonYear)
            )
          );
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

/**
 * Generates CPU-to-user trade proposals based on roster deficits and surpluses.
 */
function checkTradeViability(
  userPlayer: typeof players.$inferSelect,
  cpuPlayer: typeof players.$inferSelect,
  userSalaryTotal: number,
  cpuRoster: typeof players.$inferSelect[],
  userBudget: number,
  cpuBudget: number
): boolean {
  if (userPlayer.overall < 65 || cpuPlayer.overall < 65) return false;

  const ovrDiff = Math.abs(cpuPlayer.overall - userPlayer.overall);
  const maxOvr = Math.max(cpuPlayer.overall, userPlayer.overall);
  if (ovrDiff > maxOvr * 0.15) return false;

  const cpuSalaryTotal = cpuRoster.reduce((sum, p) => sum + p.salary, 0);
  const newUserSalary = userSalaryTotal - userPlayer.salary + cpuPlayer.salary;
  const newCpuSalary = cpuSalaryTotal - cpuPlayer.salary + userPlayer.salary;

  if (newUserSalary > userBudget || newCpuSalary > cpuBudget) return false;

  return true;
}

/**
 * Generates CPU-to-user trade proposals based on roster deficits and surpluses.
 */
export async function generateTradeProposalsAction(seasonYear: number, userTeamId: string) {
  try {
    const nextScheduled = await db
      .select({ day: games.gameNumber })
      .from(games)
      .where(and(
        eq(games.seasonYear, seasonYear),
        eq(games.status, "Scheduled"),
        eq(games.stage, "Regular")
      ))
      .orderBy(games.gameNumber)
      .limit(1);
    const currentDay = nextScheduled[0]?.day ?? 82;

    if (currentDay > 50) {
      // Trade deadline passed, expire all pending proposals
      await db
        .update(tradeProposals)
        .set({ status: "Expired" })
        .where(eq(tradeProposals.status, "Pending"));
      return { success: true, count: 0 };
    }

    // Auto-expire proposals whose real-world time expiresAt < now
    await db
      .update(tradeProposals)
      .set({ status: "Expired" })
      .where(
        and(
          eq(tradeProposals.status, "Pending"),
          sql`expires_at < ${new Date()}`
        )
      );

    // Limit active proposals to 3
    const activeProposals = await db
      .select()
      .from(tradeProposals)
      .where(
        and(
          eq(tradeProposals.receiverTeamId, userTeamId),
          eq(tradeProposals.status, "Pending")
        )
      );
    
    if (activeProposals.length >= 3) {
      return { success: true, count: 0 };
    }

    // Load active players on user team and CPU teams
    const activePlayers = await db
      .select()
      .from(players)
      .where(eq(players.status, "Active"));

    const userRoster = activePlayers.filter((p) => p.teamId === userTeamId);
    if (userRoster.length === 0) return { success: true, count: 0 };

    const [userTeam] = await db.select().from(teams).where(eq(teams.id, userTeamId)).limit(1);
    if (!userTeam) return { success: true, count: 0 };

    const cpuPlayers = activePlayers.filter((p) => p.teamId && p.teamId !== userTeamId);
    
    const rostersByCpuTeam = new Map<string, typeof players.$inferSelect[]>();
    for (const p of cpuPlayers) {
      if (p.teamId) {
        if (!rostersByCpuTeam.has(p.teamId)) rostersByCpuTeam.set(p.teamId, []);
        rostersByCpuTeam.get(p.teamId)!.push(p);
      }
    }

    const allCpuTeams = await db.select().from(teams).where(sql`id != ${userTeamId}`);
    const shuffledCpuTeams = [...allCpuTeams].sort(() => Math.random() - 0.5);

    const userPosCounts = { G: 0, F: 0, C: 0 };
    for (const p of userRoster) {
      userPosCounts[getPositionGroup(p.position)]++;
    }

    const userDeficits: string[] = [];
    const userSurpluses: string[] = [];
    if (userPosCounts.G < 3) userDeficits.push("G");
    if (userPosCounts.F < 3) userDeficits.push("F");
    if (userPosCounts.C < 2) userDeficits.push("C");
    if (userPosCounts.G > 5) userSurpluses.push("G");
    if (userPosCounts.F > 5) userSurpluses.push("F");
    if (userPosCounts.C > 3) userSurpluses.push("C");

    const userSalaryTotal = userRoster.reduce((sum, p) => sum + p.salary, 0);

    for (const cpuTeam of shuffledCpuTeams) {
      const cpuRoster = rostersByCpuTeam.get(cpuTeam.id) || [];
      if (cpuRoster.length === 0) continue;

      const cpuPosCounts = { G: 0, F: 0, C: 0 };
      for (const p of cpuRoster) {
        cpuPosCounts[getPositionGroup(p.position)]++;
      }

      const cpuDeficits: string[] = [];
      const cpuSurpluses: string[] = [];
      if (cpuPosCounts.G < 3) cpuDeficits.push("G");
      if (cpuPosCounts.F < 3) cpuDeficits.push("F");
      if (cpuPosCounts.C < 2) cpuDeficits.push("C");
      if (cpuPosCounts.G > 5) cpuSurpluses.push("G");
      if (cpuPosCounts.F > 5) cpuSurpluses.push("F");
      if (cpuPosCounts.C > 3) cpuSurpluses.push("C");

      // Verify roster size limits (bounds remain identical for 1-for-1 swap)
      if (userRoster.length < MIN_ROSTER_SIZE || userRoster.length > MAX_ROSTER_SIZE) continue;
      if (cpuRoster.length < MIN_ROSTER_SIZE || cpuRoster.length > MAX_ROSTER_SIZE) continue;

      let validPairs: Array<[typeof players.$inferSelect, typeof players.$inferSelect]> = [];

      // Option A: User deficit, CPU surplus
      for (const userDef of userDeficits) {
        if (cpuSurpluses.includes(userDef)) {
          const cpuCandidates = cpuRoster.filter((p) => getPositionGroup(p.position) === userDef);
          const userCandidates = userRoster.filter((p) => getPositionGroup(p.position) !== userDef);
          for (const u of userCandidates) {
            for (const c of cpuCandidates) {
              if (checkTradeViability(u, c, userSalaryTotal, cpuRoster, userTeam.budget, cpuTeam.budget)) {
                validPairs.push([c, u]);
              }
            }
          }
          if (validPairs.length > 0) break;
        }
      }

      // Option B: CPU deficit, User surplus
      if (validPairs.length === 0) {
        for (const cpuDef of cpuDeficits) {
          if (userSurpluses.includes(cpuDef)) {
            const userCandidates = userRoster.filter((p) => getPositionGroup(p.position) === cpuDef);
            const cpuCandidates = cpuRoster.filter((p) => getPositionGroup(p.position) !== cpuDef);
            for (const u of userCandidates) {
              for (const c of cpuCandidates) {
                  if (checkTradeViability(u, c, userSalaryTotal, cpuRoster, userTeam.budget, cpuTeam.budget)) {
                  validPairs.push([c, u]);
                }
              }
            }
            if (validPairs.length > 0) break;
          }
        }
      }

      // Option C: General OVR swap
      if (validPairs.length === 0) {
        for (const posGrp of ["G", "F", "C"]) {
          const userCandidates = userRoster.filter((p) => getPositionGroup(p.position) === posGrp);
          const cpuCandidates = cpuRoster.filter((p) => getPositionGroup(p.position) === posGrp);
          for (const u of userCandidates) {
            for (const c of cpuCandidates) {
              if (checkTradeViability(u, c, userSalaryTotal, cpuRoster, userTeam.budget, cpuTeam.budget)) {
                validPairs.push([c, u]);
              }
            }
          }
          if (validPairs.length > 0) break;
        }
      }

      if (validPairs.length > 0) {
        const [matchingCpuPlayer, matchingUserPlayer] = validPairs[Math.floor(Math.random() * validPairs.length)];
        const expiresAt = new Date(Date.now() + 24 * 3600 * 1000); // Expires in 24 hours of real time (or 3 simulation days)
        
        await db.insert(tradeProposals).values({
          seasonYear,
          proposerTeamId: cpuTeam.id,
          receiverTeamId: userTeamId,
          outgoingPlayerIds: [matchingCpuPlayer.id],
          incomingPlayerIds: [matchingUserPlayer.id],
          status: "Pending",
          expiresAt,
        });

        console.log(`[CPU Trade Proposal] Generated proposal: ${cpuTeam.city} ${cpuTeam.name} offers ${matchingCpuPlayer.firstName} ${matchingCpuPlayer.lastName} for User's ${matchingUserPlayer.firstName} ${matchingUserPlayer.lastName}`);
        return { success: true, count: 1 };
      }
    }

    return { success: true, count: 0 };
  } catch (error: any) {
    console.error("Error generating trade proposals:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches all pending trade proposals for a team.
 */
export async function getTradeProposalsAction(teamId: string) {
  try {
    // Auto-expire proposals
    await db
      .update(tradeProposals)
      .set({ status: "Expired" })
      .where(
        and(
          eq(tradeProposals.status, "Pending"),
          sql`expires_at < ${new Date()}`
        )
      );

    const proposalsList = await db
      .select({
        id: tradeProposals.id,
        seasonYear: tradeProposals.seasonYear,
        proposerTeamId: tradeProposals.proposerTeamId,
        receiverTeamId: tradeProposals.receiverTeamId,
        outgoingPlayerIds: tradeProposals.outgoingPlayerIds,
        incomingPlayerIds: tradeProposals.incomingPlayerIds,
        status: tradeProposals.status,
        createdAt: tradeProposals.createdAt,
        expiresAt: tradeProposals.expiresAt,
        proposerName: teams.name,
        proposerCity: teams.city,
      })
      .from(tradeProposals)
      .innerJoin(teams, eq(tradeProposals.proposerTeamId, teams.id))
      .where(
        and(
          eq(tradeProposals.receiverTeamId, teamId),
          eq(tradeProposals.status, "Pending")
        )
      )
      .orderBy(desc(tradeProposals.createdAt));

    const results = [];
    for (const prop of proposalsList) {
      const outgoingPlayers = await db
        .select()
        .from(players)
        .where(inArray(players.id, prop.outgoingPlayerIds));
      
      const incomingPlayers = await db
        .select()
        .from(players)
        .where(inArray(players.id, prop.incomingPlayerIds));

      results.push({
        ...prop,
        outgoingPlayers,
        incomingPlayers,
      });
    }

    return { success: true, proposals: results };
  } catch (error: any) {
    console.error("Error fetching trade proposals:", error);
    return { success: false, proposals: [], error: error.message };
  }
}

/**
 * Accepts a pending trade proposal.
 */
export async function acceptTradeProposalAction(proposalId: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await db.transaction(async (tx) => {
      const [proposal] = await tx
        .select()
        .from(tradeProposals)
        .where(eq(tradeProposals.id, proposalId))
        .limit(1);

      if (!proposal) throw new Error("Proposal not found.");
      if (proposal.status !== "Pending") throw new Error("Proposal is no longer pending.");

      const maxSeasonGame = await tx
        .select({ year: games.seasonYear })
        .from(games)
        .orderBy(desc(games.seasonYear))
        .limit(1);
      const currentSeasonYear = maxSeasonGame[0]?.year ?? 2026;

      const nextScheduled = await tx
        .select({ day: games.gameNumber })
        .from(games)
        .where(and(
          eq(games.seasonYear, currentSeasonYear),
          eq(games.status, "Scheduled"),
          eq(games.stage, "Regular")
        ))
        .orderBy(games.gameNumber)
        .limit(1);
      const currentDay = nextScheduled[0]?.day ?? 82;

      if (currentDay > 50) {
        throw new Error("The trade deadline has passed.");
      }

      const [proposerTeam] = await tx.select().from(teams).where(eq(teams.id, proposal.proposerTeamId)).limit(1);
      const [receiverTeam] = await tx.select().from(teams).where(eq(teams.id, proposal.receiverTeamId)).limit(1);

      if (!proposerTeam || !receiverTeam) throw new Error("Teams not found.");

      const outgoingPlayersList = await tx
        .select()
        .from(players)
        .where(inArray(players.id, proposal.outgoingPlayerIds));
      
      const incomingPlayersList = await tx
        .select()
        .from(players)
        .where(inArray(players.id, proposal.incomingPlayerIds));

      if (outgoingPlayersList.length !== proposal.outgoingPlayerIds.length || incomingPlayersList.length !== proposal.incomingPlayerIds.length) {
        throw new Error("One or more players in the trade proposal are no longer valid.");
      }

      const proposerRoster = await tx.select().from(players).where(and(eq(players.teamId, proposal.proposerTeamId), eq(players.status, "Active")));
      const receiverRoster = await tx.select().from(players).where(and(eq(players.teamId, proposal.receiverTeamId), eq(players.status, "Active")));

      const newProposerCount = proposerRoster.length - outgoingPlayersList.length + incomingPlayersList.length;
      const newReceiverCount = receiverRoster.length - incomingPlayersList.length + outgoingPlayersList.length;

      if (newProposerCount < 12 || newProposerCount > 18) {
        throw new Error(`Opposing team roster limits violated after trade (${newProposerCount} players).`);
      }
      if (newReceiverCount < 12 || newReceiverCount > 18) {
        throw new Error(`Your team roster limits violated after trade (${newReceiverCount} players).`);
      }

      const proposerSalary = proposerRoster.reduce((sum, p) => sum + p.salary, 0);
      const receiverSalary = receiverRoster.reduce((sum, p) => sum + p.salary, 0);

      const newProposerSalary = proposerSalary - outgoingPlayersList.reduce((sum, p) => sum + p.salary, 0) + incomingPlayersList.reduce((sum, p) => sum + p.salary, 0);
      const newReceiverSalary = receiverSalary - incomingPlayersList.reduce((sum, p) => sum + p.salary, 0) + outgoingPlayersList.reduce((sum, p) => sum + p.salary, 0);

      if (newProposerSalary > proposerTeam.budget) {
        throw new Error(`Opposing team exceeds the ₱${proposerTeam.budget.toLocaleString("en-PH")} salary cap.`);
      }
      if (newReceiverSalary > receiverTeam.budget) {
        throw new Error(`Your team exceeds the ₱${receiverTeam.budget.toLocaleString("en-PH")} salary cap.`);
      }

      // SWAP PLAYERS
      for (const p of outgoingPlayersList) {
        await tx
          .update(players)
          .set({ teamId: proposal.receiverTeamId, isOnTradeBlock: false })
          .where(eq(players.id, p.id));
      }

      if (proposal.outgoingPlayerIds.length > 0) {
        await tx
          .update(playerSalaryHistory)
          .set({ teamId: proposal.receiverTeamId })
          .where(
            and(
              inArray(playerSalaryHistory.playerId, proposal.outgoingPlayerIds),
              eq(playerSalaryHistory.seasonYear, currentSeasonYear)
            )
          );
      }

      for (const p of incomingPlayersList) {
        await tx
          .update(players)
          .set({ teamId: proposal.proposerTeamId, isOnTradeBlock: false })
          .where(eq(players.id, p.id));
      }

      if (proposal.incomingPlayerIds.length > 0) {
        await tx
          .update(playerSalaryHistory)
          .set({ teamId: proposal.proposerTeamId })
          .where(
            and(
              inArray(playerSalaryHistory.playerId, proposal.incomingPlayerIds),
              eq(playerSalaryHistory.seasonYear, currentSeasonYear)
            )
          );
      }

      await tx
        .update(tradeProposals)
        .set({ status: "Accepted" })
        .where(eq(tradeProposals.id, proposalId));

      const allInvolvedPlayerIds = [...proposal.outgoingPlayerIds, ...proposal.incomingPlayerIds];
      
      const otherPending = await tx
        .select()
        .from(tradeProposals)
        .where(and(eq(tradeProposals.status, "Pending"), sql`id != ${proposalId}`));

      for (const other of otherPending) {
        const hasOverlap = other.outgoingPlayerIds.some((id) => allInvolvedPlayerIds.includes(id)) ||
                            other.incomingPlayerIds.some((id) => allInvolvedPlayerIds.includes(id));
        if (hasOverlap) {
          await tx
            .update(tradeProposals)
            .set({ status: "Expired" })
            .where(eq(tradeProposals.id, other.id));
        }
      }

      const outgoingDescs = outgoingPlayersList.map((p) => `${p.firstName} ${p.lastName} (OVR ${p.overall})`).join(", ");
      const incomingDescs = incomingPlayersList.map((p) => `${p.firstName} ${p.lastName} (OVR ${p.overall})`).join(", ");
      const descStr = `🤝 TRADE ACCEPTED: The ${receiverTeam.city} ${receiverTeam.name} accepted a CPU trade proposal from the ${proposerTeam.city} ${proposerTeam.name}. Received: ${outgoingDescs}. Traded away: ${incomingDescs}.`;

      await tx.insert(transactions).values({
        type: "Trade",
        description: descStr,
        seasonYear: currentSeasonYear,
        gameDay: currentDay,
      });

      return { success: true };
    });
  } catch (error: any) {
    console.error("Error accepting trade proposal:", error);
    return { success: false, error: error.message || "Failed to accept trade proposal." };
  }
}

/**
 * Rejects a pending trade proposal.
 */
export async function rejectTradeProposalAction(proposalId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(tradeProposals)
      .set({ status: "Rejected" })
      .where(eq(tradeProposals.id, proposalId));
    return { success: true };
  } catch (error: any) {
    console.error("Error rejecting trade proposal:", error);
    return { success: false, error: error.message || "Failed to reject trade proposal." };
  }
}

export async function requestTradeOfferForPlayerAction(
  userTeamId: string,
  cpuTeamId: string,
  cpuPlayerId: string
): Promise<{
  success: boolean;
  offers?: Array<{
    playerIds: string[];
    pickIds: string[];
    description: string;
    value: number;
  }>;
  error?: string;
}> {
  try {
    // 1. Fetch CPU player
    const [cpuPlayer] = await db
      .select()
      .from(players)
      .where(
        and(
          eq(players.id, cpuPlayerId),
          eq(players.teamId, cpuTeamId),
          eq(players.status, "Active")
        )
      )
      .limit(1);

    if (!cpuPlayer) {
      return { success: false, error: "CPU player not found or no longer active." };
    }

    // 2. Fetch rosters and budgets
    const userRoster = await db
      .select()
      .from(players)
      .where(and(eq(players.teamId, userTeamId), eq(players.status, "Active")));

    const cpuRoster = await db
      .select()
      .from(players)
      .where(and(eq(players.teamId, cpuTeamId), eq(players.status, "Active")));

    const [userTeam] = await db.select().from(teams).where(eq(teams.id, userTeamId)).limit(1);
    const [cpuTeam] = await db.select().from(teams).where(eq(teams.id, cpuTeamId)).limit(1);

    if (!userTeam || !cpuTeam) {
      return { success: false, error: "Team data not found." };
    }

    // 3. Fetch unused draft picks
    const userPicks = await db
      .select()
      .from(draftPicks)
      .where(and(eq(draftPicks.ownerTeamId, userTeamId), eq(draftPicks.isUsed, false)));

    // Salary sums
    const userCurrentSalary = userRoster.reduce((sum, p) => sum + p.salary, 0);
    const cpuCurrentSalary = cpuRoster.reduce((sum, p) => sum + p.salary, 0);

    const getVal = (overall: number) => Math.pow(1.09, overall);
    const getPickVal = (round: number) => Math.pow(1.09, round === 1 ? 77 : 64);

    const cpuVal = getVal(cpuPlayer.overall);

    // List of candidate packages
    const candidates: Array<{
      playerIds: string[];
      pickIds: string[];
      description: string;
      value: number;
    }> = [];

    // Helper to evaluate a specific asset combination
    const evaluateCombination = (pIds: string[], pkIds: string[]) => {
      // Roster counts post-trade
      const newUserCount = userRoster.length - pIds.length + 1;
      const newCpuCount = cpuRoster.length - 1 + pIds.length;

      if (newUserCount < MIN_ROSTER_SIZE || newUserCount > MAX_ROSTER_SIZE) return;
      if (newCpuCount < MIN_ROSTER_SIZE || newCpuCount > MAX_ROSTER_SIZE) return;

      // Salaries post-trade
      const pList = userRoster.filter(p => pIds.includes(p.id));
      const pkList = userPicks.filter(pk => pkIds.includes(pk.id));

      const pSalarySum = pList.reduce((sum, p) => sum + p.salary, 0);

      const newUserSalary = userCurrentSalary - pSalarySum + cpuPlayer.salary + (userTeam.deadCap ?? 0);
      const newCpuSalary = cpuCurrentSalary - cpuPlayer.salary + pSalarySum + (cpuTeam.deadCap ?? 0);

      if (newUserSalary > userTeam.budget) return;
      if (newCpuSalary > cpuTeam.budget) return;

      // Values
      const valueUser = pList.reduce((sum, p) => sum + getVal(p.overall), 0) +
                        pkList.reduce((sum, pk) => sum + getPickVal(pk.round), 0);

      // CPU perspective check
      if (valueUser < cpuVal * 0.98) return;
      if (cpuVal < valueUser * 0.75) return; // League balance check

      // Star player check
      const maxUserOvr = pList.length > 0 ? Math.max(...pList.map(p => p.overall)) : 0;
      const hasUserFirstRoundPick = pkList.some(pk => pk.round === 1);

      if (cpuPlayer.overall >= 80) {
        if (cpuPlayer.overall >= 88) {
          const hasProperPlayer = maxUserOvr >= 80;
          const hasFallback = maxUserOvr >= 75 && hasUserFirstRoundPick;
          if (!hasProperPlayer && !hasFallback) return;
        } else {
          const hasProperPlayer = maxUserOvr >= 73;
          if (!hasProperPlayer && !hasUserFirstRoundPick) return;
        }
      }

      // Format description
      const descParts: string[] = [];
      pList.forEach(p => descParts.push(`${p.firstName} ${p.lastName} (OVR ${p.overall})`));
      pkList.forEach(pk => descParts.push(`Season ${pk.season} Rd ${pk.round} Pick`));

      candidates.push({
        playerIds: pIds,
        pickIds: pkIds,
        description: descParts.join(" + "),
        value: valueUser,
      });
    };

    // We generate combinations of size 1, 2, and 3
    // Size 1: 1 player OR 1 pick
    for (const p of userRoster) {
      evaluateCombination([p.id], []);
    }
    for (const pk of userPicks) {
      evaluateCombination([], [pk.id]);
    }

    // Size 2: 2 players, 1 player + 1 pick, 2 picks
    for (let i = 0; i < userRoster.length; i++) {
      for (let j = i + 1; j < userRoster.length; j++) {
        evaluateCombination([userRoster[i].id, userRoster[j].id], []);
      }
    }
    for (const p of userRoster) {
      for (const pk of userPicks) {
        evaluateCombination([p.id], [pk.id]);
      }
    }
    for (let i = 0; i < userPicks.length; i++) {
      for (let j = i + 1; j < userPicks.length; j++) {
        evaluateCombination([], [userPicks[i].id, userPicks[j].id]);
      }
    }

    // Size 3: 2 players + 1 pick, 1 player + 2 picks
    for (let i = 0; i < userRoster.length; i++) {
      for (let j = i + 1; j < userRoster.length; j++) {
        for (const pk of userPicks) {
          evaluateCombination([userRoster[i].id, userRoster[j].id], [pk.id]);
        }
      }
    }
    for (const p of userRoster) {
      for (let i = 0; i < userPicks.length; i++) {
        for (let j = i + 1; j < userPicks.length; j++) {
          evaluateCombination([p.id], [userPicks[i].id, userPicks[j].id]);
        }
      }
    }

    // Sort candidate packages by how close they are to CPU value (cheapest fair trade first)
    candidates.sort((a, b) => a.value - b.value);

    // Limit to top 4 offers
    return { success: true, offers: candidates.slice(0, 4) };
  } catch (error: any) {
    console.error("Error in requestTradeOfferForPlayerAction:", error);
    return { success: false, error: error.message || "Failed to generate counter offers." };
  }
}
