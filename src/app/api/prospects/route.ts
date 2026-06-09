import { NextResponse } from "next/server";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { players } from "@/db/schema";

export async function GET() {
  try {
    const prospects = await db
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
      .where(eq(players.status, "DraftPool"))
      .orderBy(players.overall);

    // Sort descending by overall (best first)
    prospects.sort((a, b) => b.overall - a.overall);

    return NextResponse.json({ prospects });
  } catch (error: any) {
    console.error("[API /prospects] Failed to fetch draft pool:", error);
    return NextResponse.json({ prospects: [], error: error.message }, { status: 500 });
  }
}
