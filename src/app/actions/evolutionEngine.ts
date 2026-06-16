"use server";

import { db } from "@/db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { players, teams, playerEvolutions, transactions, games } from "@/db/schema";

// Helper to format Philippine Peso
const formatPHP = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
};

// Skill list
const SKILLS = [
  "threePoint",
  "insideScoring",
  "playmaking",
  "perimeterDefense",
  "interiorDefense",
  "rebounding",
  "speed",
  "stamina",
] as const;

// Label helper for attributes
const SKILL_LABELS: Record<string, string> = {
  threePoint: "3PT",
  insideScoring: "Inside",
  playmaking: "Playmaking",
  perimeterDefense: "Defense",
  interiorDefense: "Interior",
  rebounding: "Rebound",
  speed: "Speed",
  stamina: "Stamina",
};

/**
 * Mutates an in-memory active players array to simulate in-season progression/regression for a specific day.
 * Returns the modified player objects, database records to insert for logs, and news transaction records.
 */
export async function evolvePlayersListInMemory(
  localPlayers: any[],
  seasonYear: number,
  gameDay: number
) {
  const evolutionsToInsert: any[] = [];
  const evolutionTransactions: any[] = [];

  // Filter to active players who are assigned to a team (no free agents evolving in-season for realism/simplicity)
  const activeLeaguePlayers = localPlayers.filter(
    (p) => p.status === "Active" && p.teamId !== null
  );

  if (activeLeaguePlayers.length === 0) {
    return {
      updatedPlayers: localPlayers,
      evolutionsToInsert,
      evolutionTransactions,
    };
  }

  // Choose a small subset of players to evolve today (approx. 5 random players daily)
  const targetCount = Math.min(activeLeaguePlayers.length, 5);
  const selectedPlayers: typeof players.$inferSelect[] = [];
  const indices = new Set<number>();

  while (indices.size < targetCount) {
    const randomIndex = Math.floor(Math.random() * activeLeaguePlayers.length);
    indices.add(randomIndex);
  }

  indices.forEach((idx) => {
    selectedPlayers.push(activeLeaguePlayers[idx]);
  });

  // Fetch team names for transaction log descriptions
  const allTeams = await db.select({ id: teams.id, name: teams.name, city: teams.city }).from(teams);
  const teamMap = new Map(allTeams.map((t) => [t.id, t]));

  for (const player of selectedPlayers) {
    const changedAttributes: Record<string, number> = {};
    const oldOverall = player.overall;

    const age = player.age;
    let attributeUpdated = false;

    // Check progression/regression odds based on age brackets
    if (age >= 19 && age <= 24) {
      // 60% chance of progression (youth development)
      if (Math.random() < 0.60) {
        // Boost 1 or 2 skills
        const skillsCount = Math.random() < 0.3 ? 2 : 1;
        for (let i = 0; i < skillsCount; i++) {
          const randomSkill = SKILLS[Math.floor(Math.random() * SKILLS.length)];
          const oldVal = player[randomSkill] as number;
          if (oldVal < 99) {
            player[randomSkill] = oldVal + 1;
            changedAttributes[SKILL_LABELS[randomSkill]] = 1;
            attributeUpdated = true;
          }
        }
      }
    } else if (age >= 32) {
      // 40% chance of regression (aging decline)
      if (Math.random() < 0.40) {
        // Decline 1 physical/defense or skill rating
        const randomSkill = SKILLS[Math.floor(Math.random() * SKILLS.length)];
        const oldVal = player[randomSkill] as number;
        if (oldVal > 40) {
          player[randomSkill] = oldVal - 1;
          changedAttributes[SKILL_LABELS[randomSkill]] = -1;
          attributeUpdated = true;
        }
      }
    } else {
      // Prime players (25-31) have small development or decay odds (5% each)
      const roll = Math.random();
      if (roll < 0.05) {
        // Boost 1 skill
        const randomSkill = SKILLS[Math.floor(Math.random() * SKILLS.length)];
        const oldVal = player[randomSkill] as number;
        if (oldVal < 99) {
          player[randomSkill] = oldVal + 1;
          changedAttributes[SKILL_LABELS[randomSkill]] = 1;
          attributeUpdated = true;
        }
      } else if (roll < 0.10) {
        // Decay 1 skill
        const randomSkill = SKILLS[Math.floor(Math.random() * SKILLS.length)];
        const oldVal = player[randomSkill] as number;
        if (oldVal > 40) {
          player[randomSkill] = oldVal - 1;
          changedAttributes[SKILL_LABELS[randomSkill]] = -1;
          attributeUpdated = true;
        }
      }
    }

    if (attributeUpdated) {
      // Recalculate Overall
      const totalSkills =
        player.threePoint +
        player.insideScoring +
        player.playmaking +
        player.perimeterDefense +
        player.interiorDefense +
        player.rebounding +
        player.speed +
        player.stamina;

      const newOverall = Math.round(totalSkills / 8);
      const overallDelta = newOverall - oldOverall;
      player.overall = newOverall;
      player.salary = newOverall * 40000;

      // Add to player_evolutions DB records
      evolutionsToInsert.push({
        playerId: player.id,
        seasonYear,
        gameDay,
        oldOverall,
        newOverall,
        attributeChangesJson: JSON.stringify(changedAttributes),
      });

      // If overall changes, log a transactions item
      if (overallDelta !== 0) {
        const teamObj = player.teamId ? teamMap.get(player.teamId) : null;
        const teamName = teamObj ? `${teamObj.city} ${teamObj.name}` : "Free Agent";
        const indicator = overallDelta > 0 ? "📈 EVOLUTION" : "📉 DECAY";
        const verb = overallDelta > 0 ? "improved" : "declined";
        const sign = overallDelta > 0 ? "+" : "";

        const logMsg = `${indicator}: ${player.firstName} ${player.lastName} (${player.position}, ${teamName}) has ${verb} ${sign}${overallDelta} overall (OVR ${newOverall}, Age ${player.age}) during regular season activities.`;

        evolutionTransactions.push({
          type: "Evolution",
          description: logMsg,
          seasonYear,
          gameDay,
        });
      }
    }
  }

  return {
    updatedPlayers: localPlayers,
    evolutionsToInsert,
    evolutionTransactions,
  };
}

/**
 * Runs the daily progression update directly on the database.
 * Used for single-day simulations (simulateRemainingDayGames).
 */
export async function processWithinSeasonEvolutionAction(
  seasonYear: number,
  gameDay: number
) {
  try {
    const activePlayers = await db
      .select()
      .from(players)
      .where(eq(players.status, "Active"));

    const { updatedPlayers, evolutionsToInsert, evolutionTransactions } =
      await evolvePlayersListInMemory(activePlayers, seasonYear, gameDay);

    if (evolutionsToInsert.length === 0) {
      return { success: true, count: 0 };
    }

    // Persist player rating updates in bulk
    const playerUpdateQueries = updatedPlayers.map((p) =>
      db
        .update(players)
        .set({
          overall: p.overall,
          salary: p.salary,
          threePoint: p.threePoint,
          insideScoring: p.insideScoring,
          playmaking: p.playmaking,
          perimeterDefense: p.perimeterDefense,
          interiorDefense: p.interiorDefense,
          rebounding: p.rebounding,
          speed: p.speed,
          stamina: p.stamina,
        })
        .where(eq(players.id, p.id))
    );

    const batchQueries: any[] = [...playerUpdateQueries];

    if (evolutionsToInsert.length > 0) {
      batchQueries.push(db.insert(playerEvolutions).values(evolutionsToInsert));
    }
    if (evolutionTransactions.length > 0) {
      batchQueries.push(db.insert(transactions).values(evolutionTransactions));
    }

    // Run batch execution in chunks
    const chunkSize = 100;
    for (let i = 0; i < batchQueries.length; i += chunkSize) {
      await db.batch(batchQueries.slice(i, i + chunkSize) as any);
    }

    return { success: true, count: evolutionsToInsert.length };
  } catch (error: any) {
    console.error("Failed to run in-season evolution server action:", error);
    return { success: false, error: error.message || "In-season evolution failed." };
  }
}

/**
 * Queries player evolution entries for timeline feeds.
 * Supports filtering by user team, specific player, or league-wide.
 */
export async function getPlayerEvolutionsAction(filters: {
  teamId?: string;
  playerId?: string;
  limit?: number;
}) {
  try {
    const { teamId, playerId, limit = 50 } = filters;

    // Build base query
    let query = db
      .select({
        id: playerEvolutions.id,
        playerId: playerEvolutions.playerId,
        seasonYear: playerEvolutions.seasonYear,
        gameDay: playerEvolutions.gameDay,
        oldOverall: playerEvolutions.oldOverall,
        newOverall: playerEvolutions.newOverall,
        attributeChangesJson: playerEvolutions.attributeChangesJson,
        createdAt: playerEvolutions.createdAt,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.position,
        age: players.age,
        teamId: players.teamId,
        teamName: teams.name,
        teamCity: teams.city,
      })
      .from(playerEvolutions)
      .innerJoin(players, eq(playerEvolutions.playerId, players.id))
      .leftJoin(teams, eq(players.teamId, teams.id));

    // Apply filters
    if (playerId) {
      // Specific player timeline
      query = query.where(eq(playerEvolutions.playerId, playerId)) as any;
    } else if (teamId) {
      // Filter by team
      query = query.where(eq(players.teamId, teamId)) as any;
    }

    // Sort by chronological feed (newest first)
    const results = await query
      .orderBy(desc(playerEvolutions.createdAt), desc(playerEvolutions.gameDay))
      .limit(limit);

    return { success: true, evolutions: results };
  } catch (error: any) {
    console.error("Failed to fetch player evolutions:", error);
    return { success: false, evolutions: [], error: error.message || "Failed to query database." };
  }
}

/**
 * Returns a player's career OVR history details for line graphs.
 */
export async function getPlayerCareerOvrHistoryAction(playerId: string) {
  try {
    // 1. Get initial OVR from players table or starting stats
    const [player] = await db
      .select({ id: players.id, overall: players.overall, age: players.age })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      return { success: false, error: "Player not found." };
    }

    // 2. Fetch all evolution updates chronologically
    const updates = await db
      .select({
        seasonYear: playerEvolutions.seasonYear,
        gameDay: playerEvolutions.gameDay,
        newOverall: playerEvolutions.newOverall,
        oldOverall: playerEvolutions.oldOverall,
        createdAt: playerEvolutions.createdAt,
      })
      .from(playerEvolutions)
      .where(eq(playerEvolutions.playerId, playerId))
      .orderBy(playerEvolutions.createdAt);

    return {
      success: true,
      currentOverall: player.overall,
      history: updates,
    };
  } catch (error: any) {
    console.error("Failed to load player career OVR history:", error);
    return { success: false, error: error.message || "Failed to load OVR chart data." };
  }
}

/**
 * Retrieves a list of all active players in the league for autocomplete search lists.
 */
export async function getActivePlayersListAction() {
  try {
    const results = await db
      .select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.position,
        overall: players.overall,
        teamId: players.teamId,
        teamName: teams.name,
        teamCity: teams.city,
      })
      .from(players)
      .leftJoin(teams, eq(players.teamId, teams.id))
      .where(eq(players.status, "Active"))
      .orderBy(desc(players.overall));

    return { success: true, players: results };
  } catch (error: any) {
    console.error("Failed to query active players list:", error);
    return { success: false, players: [], error: error.message || "Failed to query players directory." };
  }
}

