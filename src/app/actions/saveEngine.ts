"use server";

import { db } from "@/db";
import { eq, desc } from "drizzle-orm";
import {
  teams,
  players,
  games,
  playerGameStats,
  transactions,
  seasonChampions,
  playerAwards,
  allLeagueTeams,
  draftPicks,
  draftSessions,
  tradeProposals,
  saveSlots,
  playerSalaryHistory,
  playerEvolutions
} from "@/db/schema";
import { seedDatabase } from "@/db/seed";

export async function getSaveSlotsAction() {
  try {
    const slots = await db
      .select({
        id: saveSlots.id,
        name: saveSlots.name,
        userTeamId: saveSlots.userTeamId,
        managedTeamName: saveSlots.managedTeamName,
        managedTeamCity: saveSlots.managedTeamCity,
        currentLeagueDay: saveSlots.currentLeagueDay,
        currentSeasonYear: saveSlots.currentSeasonYear,
        updatedAt: saveSlots.updatedAt,
      })
      .from(saveSlots)
      .orderBy(desc(saveSlots.updatedAt));

    return { success: true, slots };
  } catch (error: any) {
    console.error("Failed to fetch save slots:", error);
    return { success: false, slots: [], error: error.message };
  }
}

export async function saveGameAction(
  slotName: string | null,
  userTeamId: string | null,
  currentLeagueDay: number,
  slotId?: string
) {
  try {
    // Resolve current season year from games table
    const maxSeasonGame = await db
      .select({ year: games.seasonYear })
      .from(games)
      .orderBy(desc(games.seasonYear))
      .limit(1);
    const currentSeasonYear = maxSeasonGame[0]?.year ?? 2026;
    // 1. Fetch all records from all tables
    const allTeams = await db.select().from(teams);
    const allPlayers = await db.select().from(players);
    const allGames = await db.select().from(games);
    const allStats = await db.select().from(playerGameStats);
    const allTx = await db.select().from(transactions);
    const allChamps = await db.select().from(seasonChampions);
    const allAwards = await db.select().from(playerAwards);
    const allLeagueTeamsList = await db.select().from(allLeagueTeams);
    const allPicks = await db.select().from(draftPicks);
    const allSessions = await db.select().from(draftSessions);
    const allProposals = await db.select().from(tradeProposals);
    const allSalaryHistory = await db.select().from(playerSalaryHistory);
    const allEvolutions = await db.select().from(playerEvolutions);

    // 2. Package everything into a JSON object
    const gameStateJson = JSON.stringify({
      teams: allTeams,
      players: allPlayers,
      games: allGames,
      playerGameStats: allStats,
      transactions: allTx,
      seasonChampions: allChamps,
      playerAwards: allAwards,
      allLeagueTeams: allLeagueTeamsList,
      draftPicks: allPicks,
      draftSessions: allSessions,
      tradeProposals: allProposals,
      playerSalaryHistory: allSalaryHistory,
      playerEvolutions: allEvolutions,
    });

    let managedTeamName = "";
    let managedTeamCity = "";
    if (userTeamId) {
      const managed = allTeams.find((t) => t.id === userTeamId);
      if (managed) {
        managedTeamName = managed.name;
        managedTeamCity = managed.city;
      }
    }

    if (slotId) {
      let finalName = slotName;
      if (!finalName) {
        const [existing] = await db
          .select({ name: saveSlots.name })
          .from(saveSlots)
          .where(eq(saveSlots.id, slotId))
          .limit(1);
        finalName = existing?.name ?? "Autosave Slot";
      }

      await db
        .update(saveSlots)
        .set({
          name: finalName,
          userTeamId,
          managedTeamName,
          managedTeamCity,
          currentLeagueDay,
          currentSeasonYear,
          gameStateJson,
          updatedAt: new Date(),
        })
        .where(eq(saveSlots.id, slotId));
      
      return { success: true, id: slotId };
    } else {
      const finalName = slotName || "Autosave Slot";
      const [inserted] = await db
        .insert(saveSlots)
        .values({
          name: finalName,
          userTeamId,
          managedTeamName,
          managedTeamCity,
          currentLeagueDay,
          currentSeasonYear,
          gameStateJson,
          updatedAt: new Date(),
        })
        .returning({ id: saveSlots.id });

      return { success: true, id: inserted.id };
    }
  } catch (error: any) {
    console.error("Failed to save game:", error);
    return { success: false, error: error.message };
  }
}

async function chunkedInsert(client: any, table: any, values: any[]) {
  const chunkSize = 200;
  for (let i = 0; i < values.length; i += chunkSize) {
    await client.insert(table).values(values.slice(i, i + chunkSize));
  }
}

export async function loadGameAction(slotId: string) {
  try {
    // 1. Fetch save slot details
    const [slot] = await db
      .select()
      .from(saveSlots)
      .where(eq(saveSlots.id, slotId))
      .limit(1);

    if (!slot) {
      return { success: false, error: "Save slot not found" };
    }

    const data = JSON.parse(slot.gameStateJson);

    // Deserialize Date objects from JSON string representation
    if (data.transactions) {
      data.transactions = data.transactions.map((tx: any) => ({
        ...tx,
        createdAt: tx.createdAt ? new Date(tx.createdAt) : new Date(),
      }));
    }
    if (data.draftSessions) {
      data.draftSessions = data.draftSessions.map((ds: any) => ({
        ...ds,
        createdAt: ds.createdAt ? new Date(ds.createdAt) : new Date(),
        updatedAt: ds.updatedAt ? new Date(ds.updatedAt) : new Date(),
      }));
    }
    if (data.tradeProposals) {
      data.tradeProposals = data.tradeProposals.map((tp: any) => ({
        ...tp,
        createdAt: tp.createdAt ? new Date(tp.createdAt) : new Date(),
        expiresAt: tp.expiresAt ? new Date(tp.expiresAt) : new Date(),
      }));
    }
    if (data.playerEvolutions) {
      data.playerEvolutions = data.playerEvolutions.map((pe: any) => ({
        ...pe,
        createdAt: pe.createdAt ? new Date(pe.createdAt) : new Date(),
      }));
    }

    // 2. Perform table swaps sequentially (neon-http doesn't support persistent transactions)
    // Clear dependent tables first
    await db.delete(tradeProposals);
    await db.delete(draftSessions);
    await db.delete(draftPicks);
    await db.delete(allLeagueTeams);
    await db.delete(playerAwards);
    await db.delete(seasonChampions);
    await db.delete(transactions);
    await db.delete(playerGameStats);
    await db.delete(playerSalaryHistory);
    await db.delete(playerEvolutions);
    await db.delete(games);
    await db.delete(players);
    await db.delete(teams);

    // Restore core tables in correct dependency order
    if (data.teams && data.teams.length > 0) {
      await chunkedInsert(db, teams, data.teams);
    }
    if (data.players && data.players.length > 0) {
      await chunkedInsert(db, players, data.players);
    }
    if (data.games && data.games.length > 0) {
      await chunkedInsert(db, games, data.games);
    }
    if (data.playerGameStats && data.playerGameStats.length > 0) {
      await chunkedInsert(db, playerGameStats, data.playerGameStats);
    }
    if (data.transactions && data.transactions.length > 0) {
      await chunkedInsert(db, transactions, data.transactions);
    }
    if (data.seasonChampions && data.seasonChampions.length > 0) {
      await chunkedInsert(db, seasonChampions, data.seasonChampions);
    }
    if (data.playerAwards && data.playerAwards.length > 0) {
      await chunkedInsert(db, playerAwards, data.playerAwards);
    }
    if (data.allLeagueTeams && data.allLeagueTeams.length > 0) {
      await chunkedInsert(db, allLeagueTeams, data.allLeagueTeams);
    }
    if (data.draftPicks && data.draftPicks.length > 0) {
      await chunkedInsert(db, draftPicks, data.draftPicks);
    }
    if (data.draftSessions && data.draftSessions.length > 0) {
      await chunkedInsert(db, draftSessions, data.draftSessions);
    }
    if (data.tradeProposals && data.tradeProposals.length > 0) {
      await chunkedInsert(db, tradeProposals, data.tradeProposals);
    }
    if (data.playerSalaryHistory && data.playerSalaryHistory.length > 0) {
      await chunkedInsert(db, playerSalaryHistory, data.playerSalaryHistory);
    }
    if (data.playerEvolutions && data.playerEvolutions.length > 0) {
      await chunkedInsert(db, playerEvolutions, data.playerEvolutions);
    }

    return {
      success: true,
      userTeamId: slot.userTeamId,
      currentLeagueDay: slot.currentLeagueDay,
      currentSeasonYear: slot.currentSeasonYear,
    };
  } catch (error: any) {
    console.error("Failed to load game:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteSaveSlotAction(slotId: string) {
  try {
    await db.delete(saveSlots).where(eq(saveSlots.id, slotId));
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete save slot:", error);
    return { success: false, error: error.message };
  }
}

export async function resetActiveGameAction() {
  try {
    // Runs seeder to restore fresh 2026 state programmatically
    const insertedTeams = await seedDatabase(db);
    return {
      success: true,
      teams: insertedTeams.map((t: any) => ({
        id: t.id,
        city: t.city,
        name: t.name
      }))
    };
  } catch (error: any) {
    console.error("Failed to reset database:", error);
    return { success: false, error: error.message };
  }
}
