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

export async function getAllPlayersWithTeamsAction() {
  try {
    const list = await db
      .select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.position,
        age: players.age,
        overall: players.overall,
        salary: players.salary,
        isFilAm: players.isFilAm,
        status: players.status,
        teamId: players.teamId,
        teamName: teams.name,
        teamCity: teams.city,
        threePoint: players.threePoint,
        insideScoring: players.insideScoring,
        perimeterDefense: players.perimeterDefense,
        interiorDefense: players.interiorDefense,
        rebounding: players.rebounding,
        speed: players.speed,
        stamina: players.stamina,
      })
      .from(players)
      .leftJoin(teams, eq(players.teamId, teams.id))
      .where(eq(players.status, "Active"))
      .orderBy(desc(players.overall));

    const allTeams = await db.select().from(teams).orderBy(teams.city);

    return { success: true, players: list, teams: allTeams };
  } catch (error: any) {
    console.error("Failed to fetch player directory:", error);
    return { success: false, error: error.message || "Failed to fetch players" };
  }
}

