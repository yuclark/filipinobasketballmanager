"use server";

import { db } from "@/db";
import { eq, desc } from "drizzle-orm";
import { teams, players } from "@/db/schema";

export async function getTeamRoster(teamId: string) {
  if (!teamId) return null;

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return null;
    }

    const teamPlayers = await db
      .select()
      .from(players)
      .where(eq(players.teamId, teamId))
      .orderBy(desc(players.overall));

    return {
      team,
      players: teamPlayers,
    };
  } catch (error) {
    console.error("Failed to fetch team roster:", error);
    throw new Error("Failed to fetch team roster");
  }
}
