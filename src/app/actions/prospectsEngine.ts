"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { players } from "@/db/schema";

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
    const rows = await db
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

    rows.sort((a, b) => b.overall - a.overall);
    return { success: true, prospects: rows };
  } catch (error: any) {
    console.error("[Prospects Action] Failed:", error);
    return { success: false, prospects: [], error: error.message };
  }
}
