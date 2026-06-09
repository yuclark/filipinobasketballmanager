"use server";

import { db } from "@/db";
import { eq, desc } from "drizzle-orm";
import { players, games } from "@/db/schema";
import { generateRookiePoolAction } from "@/app/actions/offseasonEngine";

export interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  hometown: string;
  isFilAm: boolean;
  overall: number;
  threePoint: number;
  insideScoring: number;
  perimeterDefense: number;
  interiorDefense: number;
  rebounding: number;
  speed: number;
}

export async function getDraftProspectsAction(): Promise<{
  success: boolean;
  prospects: Prospect[];
  error?: string;
}> {
  try {
    let rows = await db
      .select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.position,
        age: players.age,
        hometown: players.hometown,
        isFilAm: players.isFilAm,
        overall: players.overall,
        threePoint: players.threePoint,
        insideScoring: players.insideScoring,
        perimeterDefense: players.perimeterDefense,
        interiorDefense: players.interiorDefense,
        rebounding: players.rebounding,
        speed: players.speed,
      })
      .from(players)
      .where(eq(players.status, "DraftPool"));

    if (rows.length === 0) {
      console.log("[Prospects Action] Empty draft pool detected. Bootstrapping rookie pool...");
      const lastGame = await db
        .select({ year: games.seasonYear })
        .from(games)
        .orderBy(desc(games.seasonYear))
        .limit(1);
      
      const currentSeasonYear = lastGame[0]?.year ?? 2026;
      await generateRookiePoolAction(currentSeasonYear, true);

      // Re-query newly generated rookies
      rows = await db
        .select({
          id: players.id,
          firstName: players.firstName,
          lastName: players.lastName,
          position: players.position,
          age: players.age,
          hometown: players.hometown,
          isFilAm: players.isFilAm,
          overall: players.overall,
          threePoint: players.threePoint,
          insideScoring: players.insideScoring,
          perimeterDefense: players.perimeterDefense,
          interiorDefense: players.interiorDefense,
          rebounding: players.rebounding,
          speed: players.speed,
        })
        .from(players)
        .where(eq(players.status, "DraftPool"));
    }

    rows.sort((a, b) => b.overall - a.overall);
    return { success: true, prospects: rows };
  } catch (error: any) {
    console.error("[Prospects Action] Failed:", error);
    return { success: false, prospects: [], error: error.message };
  }
}
