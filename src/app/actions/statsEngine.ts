"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { players, playerGameStats } from "@/db/schema";

export async function getTeamSeasonStatsAction(teamId: string) {
  try {
    if (!teamId) {
      return { success: false, error: "Team ID is required." };
    }

    // 1. Fetch player box score stats joined on the players of this team
    const statsList = await db
      .select({
        playerId: playerGameStats.playerId,
        points: playerGameStats.points,
        rebounds: playerGameStats.rebounds,
        assists: playerGameStats.assists,
        steals: playerGameStats.steals,
        blocks: playerGameStats.blocks,
        turnovers: playerGameStats.turnovers,
      })
      .from(playerGameStats)
      .innerJoin(players, eq(players.id, playerGameStats.playerId))
      .where(eq(players.teamId, teamId));

    // Group stats list by playerId
    const playerStatsMap: Record<string, typeof statsList> = {};
    for (const stat of statsList) {
      if (!playerStatsMap[stat.playerId]) {
        playerStatsMap[stat.playerId] = [];
      }
      playerStatsMap[stat.playerId].push(stat);
    }

    // 2. Fetch the roster and sort overall descending to identify starters (top 5)
    const teamPlayersList = await db
      .select()
      .from(players)
      .where(eq(players.teamId, teamId));

    const teamPlayers = [...teamPlayersList].sort((a, b) => b.overall - a.overall);

    // 3. Compute averages for each roster player
    const averages = teamPlayers.map((player, idx) => {
      const stats = playerStatsMap[player.id] || [];
      const gp = stats.length;

      // Base minutes on overall and index (starters index 0-4 play 28-36 mins, bench play 12-24 mins)
      const isStarter = idx < 5;
      const baseMin = isStarter ? 28 : 12;
      const minVar = isStarter ? 6 : 10;
      const staminaFactor = player.stamina / 100;
      
      const mpg = Number(
        (baseMin + (player.overall / 100) * minVar + staminaFactor * 2).toFixed(1)
      );

      if (gp === 0) {
        return {
          playerId: player.id,
          gp: 0,
          mpg: 0,
          ppg: 0,
          rpg: 0,
          apg: 0,
          spg: 0,
          bpg: 0,
          to: 0,
        };
      }

      const totalPoints = stats.reduce((s, st) => s + st.points, 0);
      const totalRebounds = stats.reduce((s, st) => s + st.rebounds, 0);
      const totalAssists = stats.reduce((s, st) => s + st.assists, 0);
      const totalSteals = stats.reduce((s, st) => s + st.steals, 0);
      const totalBlocks = stats.reduce((s, st) => s + st.blocks, 0);
      const totalTurnovers = stats.reduce((s, st) => s + st.turnovers, 0);

      return {
        playerId: player.id,
        gp,
        mpg,
        ppg: Number((totalPoints / gp).toFixed(1)),
        rpg: Number((totalRebounds / gp).toFixed(1)),
        apg: Number((totalAssists / gp).toFixed(1)),
        spg: Number((totalSteals / gp).toFixed(1)),
        bpg: Number((totalBlocks / gp).toFixed(1)),
        to: Number((totalTurnovers / gp).toFixed(1)),
      };
    });

    return { success: true, averages };
  } catch (error: any) {
    console.error("Failed to fetch team season stats:", error);
    return { success: false, error: error.message || "Failed to calculate averages." };
  }
}
