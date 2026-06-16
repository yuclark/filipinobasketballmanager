"use server";

import { db } from "@/db";
import { eq, desc, and } from "drizzle-orm";
import { teams, players, games } from "@/db/schema";

export async function getTeamFinancesAction(teamId: string) {
  if (!teamId) {
    return { success: false, error: "Team ID is required." };
  }

  try {
    // 1. Fetch team details (budget, dead cap)
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return { success: false, error: "Team not found." };
    }

    // 2. Fetch active players for this team, sorted by salary descending
    const teamPlayers = await db
      .select()
      .from(players)
      .where(and(eq(players.teamId, teamId), eq(players.status, "Active")))
      .orderBy(desc(players.salary));

    // 3. Fetch all teams in the league for selection dropdown
    const allTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        city: teams.city,
      })
      .from(teams)
      .orderBy(teams.city);

    // 4. Retrieve current league season year from games table
    const maxSeasonGame = await db
      .select({ year: games.seasonYear })
      .from(games)
      .orderBy(desc(games.seasonYear))
      .limit(1);
    const currentSeasonYear = maxSeasonGame[0]?.year ?? 2026;

    return {
      success: true,
      team,
      players: teamPlayers,
      allTeams,
      currentSeasonYear,
    };
  } catch (error: any) {
    console.error("Failed to load team finances:", error);
    return {
      success: false,
      error: error.message || "Failed to load team finances.",
    };
  }
}
