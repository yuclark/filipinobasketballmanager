"use server";

import { db } from "@/db";
import { eq, and, desc, sql, isNull, isNotNull } from "drizzle-orm";
import { players, teams, games, transactions, draftPicks } from "@/db/schema";
import { MIN_ROSTER_SIZE } from "@/lib/constants";
import { generateScheduleAction } from "@/app/actions/leagueEngine";
import { enforceLeagueRosterLimitsAction } from "@/app/actions/cpuAiEngine";

// Name Pools
const FIRST_NAMES = [
  "Junmar", "Kiefer", "Jayson", "Thirdy", "Aldrin", "Calvin", "CJ", "Gabe",
  "Paul", "Robert", "Marc", "LA", "Chris", "Stanley", "Japeth", "Raymond",
  "Terrence", "Beau", "Alex", "Scottie", "Arwind", "Roger", "Baser", "Jio",
  "Matthew", "Von", "Kevin", "Jericho", "Shaun", "Rey", "Mark", "Vic",
  "Poy", "Troy", "Jerick", "Allein", "Mac", "Ramon", "Nonoy", "Mike"
];

const SURNAMES = [
  "Reyes", "Santos", "Garcia", "Fajardo", "De Leon", "Castro", "Ravena", "Pogoy",
  "Erram", "Tenorio", "Aguilar", "Barroca", "Lassiter", "Cabagnot", "Standhardinger",
  "Thompson", "Norwood", "Yap", "Pingris", "Almazan", "Lee", "Pringle", "Wright",
  "Abueva", "Cruz", "Banchero", "Newsome", "Belo", "Tolentino", "Rosario", "Malonzo",
  "Oftana", "Perez", "Sangalang", "Jalalon", "David", "Pascual", "Guanzon"
];

const FILAM_FIRST_NAMES = [
  "Jordan", "Christian", "Green", "Washington", "Clarkson", "Gabe", "Matthew",
  "Chris", "Alex", "Bobby", "Moala", "Sean", "Maverick", "Cliff", "Taylor",
  "DeAndre", "Tyler", "Justin", "Brandon", "Ethan", "Jeremy", "Zachary"
];

const FILAM_SURNAMES = [
  "Clarkson", "Washington", "Standhardinger", "Banchero", "Newsome", "Wright",
  "Lassiter", "Pringle", "Holt", "Perkins", "Hodge", "Adams", "Croft", "Moore",
  "Green", "Tautuaa", "Ellis", "Harris", "Parks", "Williams", "Smith", "Johnson"
];

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

const LUZON_HOMETOWNS = [
  "Manila", "Quezon City", "Makati", "Pampanga", "Bulacan", "Laguna",
  "Cavite", "Batangas", "Pangasinan", "Baguio", "Legazpi", "Isabela",
  "Valenzuela", "Pasig", "Taguig", "Angeles City", "Rizal", "Tarlac"
];

const VISMIN_HOMETOWNS = [
  "Cebu City", "Mandaue City", "Iloilo City", "Bacolod", "Davao City",
  "Zamboanga City", "Cagayan de Oro", "General Santos", "Butuan", "Iligan",
  "Cotabato City", "Dumaguete", "Tagbilaran", "Tacloban", "Lapu-Lapu",
  "Ormoc", "Dapitan", "Pagadian"
];

export async function generateRookiePoolAction(seasonYear: number, forceRegenerate = false) {
  try {
    if (!forceRegenerate) {
      const existing = await db
        .select({ count: sql<number>`count(*)` })
        .from(players)
        .where(eq(players.status, "DraftPool"));

      if (Number(existing[0]?.count ?? 0) > 0) {
        console.log("[Offseason Engine] Draft pool already exists, skipping regeneration to preserve scouting records.");
        return { success: true };
      }
    }

    // 1. Delete old DraftPool players
    await db.delete(players).where(eq(players.status, "DraftPool"));

    const prospects: Array<typeof players.$inferInsert> = [];

    for (let i = 0; i < 75; i++) {
      const isFilAm = Math.random() < 0.2; // 20% Fil-Am
      const firstName = isFilAm
        ? FILAM_FIRST_NAMES[Math.floor(Math.random() * FILAM_FIRST_NAMES.length)]
        : FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = isFilAm
        ? FILAM_SURNAMES[Math.floor(Math.random() * FILAM_SURNAMES.length)]
        : SURNAMES[Math.floor(Math.random() * SURNAMES.length)];

      const age = Math.floor(Math.random() * 4) + 19; // 19 to 22
      const position = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];

      const hometown = Math.random() < 0.5
        ? LUZON_HOMETOWNS[Math.floor(Math.random() * LUZON_HOMETOWNS.length)]
        : VISMIN_HOMETOWNS[Math.floor(Math.random() * VISMIN_HOMETOWNS.length)];

      // Skills between 45 and 82
      const threePoint = Math.floor(Math.random() * 38) + 45;
      const insideScoring = Math.floor(Math.random() * 38) + 45;
      const playmaking = Math.floor(Math.random() * 38) + 45;
      const perimeterDefense = Math.floor(Math.random() * 38) + 45;
      const interiorDefense = Math.floor(Math.random() * 38) + 45;
      const rebounding = Math.floor(Math.random() * 38) + 45;
      const speed = Math.floor(Math.random() * 38) + 45;
      const stamina = Math.floor(Math.random() * 38) + 45;

      const overall = Math.round(
        (threePoint + insideScoring + playmaking + perimeterDefense + interiorDefense + rebounding + speed + stamina) / 8
      );

      const salary = overall * 40000;

      prospects.push({
        teamId: null,
        firstName,
        lastName,
        age,
        hometown,
        isFilAm,
        overall,
        salary,
        position,
        threePoint,
        insideScoring,
        playmaking,
        perimeterDefense,
        interiorDefense,
        rebounding,
        speed,
        stamina,
        contractYearsRemaining: 3,
        status: "DraftPool",
        isRookie: true, // eligible for Rookie of the Year
      });
    }

    const chunkSize = 15;
    for (let i = 0; i < prospects.length; i += chunkSize) {
      const chunk = prospects.slice(i, i + chunkSize);
      await db.insert(players).values(chunk);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to generate rookie pool:", error);
    return { success: false, error: error.message || "Failed to generate rookies." };
  }
}

export async function processPlayerEvolutionAction() {
  try {
    // 1. Fetch active players and all teams
    const activePlayers = await db.select().from(players).where(eq(players.status, "Active"));
    const allTeams = await db.select().from(teams);
    const teamMap = new Map(allTeams.map((t) => [t.id, t]));

    // 2. Fetch current year
    const lastGame = await db
      .select({ year: games.seasonYear })
      .from(games)
      .orderBy(desc(games.seasonYear))
      .limit(1);
    const currentYear = lastGame[0]?.year ?? 2026;

    const evolutionLogs: string[] = [];
    const updatedPlayers: any[] = [];
    const newTransactions: any[] = [];
    
    // Structured evolution results
    const evolutionResultsList: any[] = [];
    let retiredCount = 0;
    let improvedCount = 0;
    let regressedCount = 0;

    for (const player of activePlayers) {
      const team = player.teamId ? teamMap.get(player.teamId) : null;
      const teamNameStr = team ? `[${team.city} ${team.name}]` : "[Free Agent]";

      // A. Retirement Check (only check if older than 34)
      if (player.age > 34) {
        let retirementChance = 0.2; // age 35
        if (player.age === 36) retirementChance = 0.4;
        else if (player.age === 37) retirementChance = 0.6;
        else if (player.age >= 38) retirementChance = 0.8;

        if (Math.random() < retirementChance) {
          updatedPlayers.push({
            ...player,
            status: "Retired",
            teamId: null,
            contractYearsRemaining: 0,
          });

          retiredCount++;
          const logMsg = `🚨 ${team ? `${team.city} ${team.name} veteran ` : ""}${player.firstName} ${player.lastName} has officially announced his retirement at Age ${player.age}.`;
          evolutionLogs.push(logMsg);
          newTransactions.push({
            type: "Release",
            description: logMsg,
            seasonYear: currentYear,
            gameDay: 82,
          });
          continue; // Player retired, skip progression/contract updates
        }
      }

      // B. Progression/Regression
      let nextOverall = player.overall;
      let diff = 0;
      let nextThreePoint = player.threePoint;
      let nextInsideScoring = player.insideScoring;
      let nextPlaymaking = player.playmaking;
      let nextPerimeterDefense = player.perimeterDefense;
      let nextInteriorDefense = player.interiorDefense;
      let nextRebounding = player.rebounding;
      let nextSpeed = player.speed;
      let nextStamina = player.stamina;

      if (player.age >= 19 && player.age <= 24) {
        // Boost +1 to +5
        diff = Math.floor(Math.random() * 5) + 1;
        const totalPointsToAdd = diff * 8;

        let added = 0;
        const attrs = ["threePoint", "insideScoring", "playmaking", "perimeterDefense", "interiorDefense", "rebounding", "speed", "stamina"];
        while (added < totalPointsToAdd) {
          const attr = attrs[Math.floor(Math.random() * attrs.length)];
          if (attr === "threePoint" && nextThreePoint < 99) { nextThreePoint++; added++; }
          else if (attr === "insideScoring" && nextInsideScoring < 99) { nextInsideScoring++; added++; }
          else if (attr === "playmaking" && nextPlaymaking < 99) { nextPlaymaking++; added++; }
          else if (attr === "perimeterDefense" && nextPerimeterDefense < 99) { nextPerimeterDefense++; added++; }
          else if (attr === "interiorDefense" && nextInteriorDefense < 99) { nextInteriorDefense++; added++; }
          else if (attr === "rebounding" && nextRebounding < 99) { nextRebounding++; added++; }
          else if (attr === "speed" && nextSpeed < 99) { nextSpeed++; added++; }
          else if (attr === "stamina" && nextStamina < 99) { nextStamina++; added++; }

          if (nextThreePoint === 99 && nextInsideScoring === 99 && nextPlaymaking === 99 &&
            nextPerimeterDefense === 99 && nextInteriorDefense === 99 && nextRebounding === 99 &&
            nextSpeed === 99 && nextStamina === 99) {
            break;
          }
        }

        nextOverall = Math.round((nextThreePoint + nextInsideScoring + nextPlaymaking + nextPerimeterDefense + nextInteriorDefense + nextRebounding + nextSpeed + nextStamina) / 8);
        evolutionLogs.push(`📈 ${teamNameStr} ${player.firstName} ${player.lastName} improved +${nextOverall - player.overall} OVR (OVR ${nextOverall}, Age ${player.age})`);
      } else if (player.age >= 32) {
        // Regression -1 to -4
        diff = Math.floor(Math.random() * 4) + 1;
        const totalPointsToDeduct = diff * 8;

        let deducted = 0;
        const physicalDefenseAttrs = ["speed", "stamina", "perimeterDefense", "interiorDefense"];
        const otherAttrs = ["threePoint", "insideScoring", "playmaking", "rebounding"];

        while (deducted < totalPointsToDeduct) {
          const usePhysical = Math.random() < 0.7;
          const attr = usePhysical
            ? physicalDefenseAttrs[Math.floor(Math.random() * physicalDefenseAttrs.length)]
            : otherAttrs[Math.floor(Math.random() * otherAttrs.length)];

          if (attr === "speed" && nextSpeed > 40) { nextSpeed--; deducted++; }
          else if (attr === "stamina" && nextStamina > 40) { nextStamina--; deducted++; }
          else if (attr === "perimeterDefense" && nextPerimeterDefense > 40) { nextPerimeterDefense--; deducted++; }
          else if (attr === "interiorDefense" && nextInteriorDefense > 40) { nextInteriorDefense--; deducted++; }
          else if (attr === "threePoint" && nextThreePoint > 40) { nextThreePoint--; deducted++; }
          else if (attr === "insideScoring" && nextInsideScoring > 40) { nextInsideScoring--; deducted++; }
          else if (attr === "playmaking" && nextPlaymaking > 40) { nextPlaymaking--; deducted++; }
          else if (attr === "rebounding" && nextRebounding > 40) { nextRebounding--; deducted++; }

          if (nextSpeed === 40 && nextStamina === 40 && nextPerimeterDefense === 40 && nextInteriorDefense === 40 &&
            nextThreePoint === 40 && nextInsideScoring === 40 && nextPlaymaking === 40 && nextRebounding === 40) {
            break;
          }
        }

        nextOverall = Math.round((nextThreePoint + nextInsideScoring + nextPlaymaking + nextPerimeterDefense + nextInteriorDefense + nextRebounding + nextSpeed + nextStamina) / 8);
        evolutionLogs.push(`📉 ${teamNameStr} ${player.firstName} ${player.lastName} declined -${player.overall - nextOverall} OVR (OVR ${nextOverall}, Age ${player.age})`);
      }

      const deltaOverall = nextOverall - player.overall;
      if (deltaOverall > 0) improvedCount++;
      else if (deltaOverall < 0) regressedCount++;

      // Track detailed changes
      const changedAttributes: Record<string, number> = {};
      let biggestImprovedAttr = "";
      let maxImprovement = 0;
      let biggestDeclinedAttr = "";
      let maxDecline = 0;

      const attrComparisons = [
        { key: "threePoint", oldVal: player.threePoint, newVal: nextThreePoint, label: "3PT" },
        { key: "insideScoring", oldVal: player.insideScoring, newVal: nextInsideScoring, label: "Inside" },
        { key: "playmaking", oldVal: player.playmaking, newVal: nextPlaymaking, label: "Playmaking" },
        { key: "perimeterDefense", oldVal: player.perimeterDefense, newVal: nextPerimeterDefense, label: "Defense" },
        { key: "interiorDefense", oldVal: player.interiorDefense, newVal: nextInteriorDefense, label: "Interior" },
        { key: "rebounding", oldVal: player.rebounding, newVal: nextRebounding, label: "Rebound" },
        { key: "speed", oldVal: player.speed, newVal: nextSpeed, label: "Speed" },
        { key: "stamina", oldVal: player.stamina, newVal: nextStamina, label: "Stamina" },
      ];

      for (const comp of attrComparisons) {
        const delta = comp.newVal - comp.oldVal;
        if (delta !== 0) {
          changedAttributes[comp.label] = delta;
          if (delta > maxImprovement) {
            maxImprovement = delta;
            biggestImprovedAttr = comp.label;
          }
          if (-delta > maxDecline) {
            maxDecline = -delta;
            biggestDeclinedAttr = comp.label;
          }
        }
      }

      evolutionResultsList.push({
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        teamId: player.teamId,
        teamName: team ? `${team.city} ${team.name}` : "Free Agent",
        age: player.age,
        oldOverall: player.overall,
        newOverall: nextOverall,
        deltaOverall,
        changedAttributes,
        biggestImprovedAttribute: biggestImprovedAttr,
        biggestDeclinedAttribute: biggestDeclinedAttr,
      });

      // C. Age increment and Contract Decrement
      const nextAge = player.age + 1;
      let nextContractYears = player.contractYearsRemaining - 1;
      let nextTeamId = player.teamId;

      if (nextContractYears <= 0 && player.teamId !== null) {
        nextTeamId = null;
        nextContractYears = 0;

        const logMsg = `🔓 ${player.firstName} ${player.lastName} became an unrestricted free agent as their contract expired.`;
        evolutionLogs.push(logMsg);
        newTransactions.push({
          type: "Release",
          description: logMsg,
          seasonYear: currentYear,
          gameDay: 82,
        });
      }

      updatedPlayers.push({
        ...player,
        age: nextAge,
        overall: nextOverall,
        salary: nextOverall * 40000,
        threePoint: nextThreePoint,
        insideScoring: nextInsideScoring,
        playmaking: nextPlaymaking,
        perimeterDefense: nextPerimeterDefense,
        interiorDefense: nextInteriorDefense,
        rebounding: nextRebounding,
        speed: nextSpeed,
        stamina: nextStamina,
        contractYearsRemaining: nextContractYears <= 0 ? 3 : nextContractYears,
        teamId: nextTeamId,
      });
    }

    if (updatedPlayers.length > 0) {
      const batchQueries: any[] = [];
      for (const p of updatedPlayers) {
        batchQueries.push(
          db.update(players)
            .set({
              age: p.age,
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
              contractYearsRemaining: p.contractYearsRemaining,
              status: p.status,
              teamId: p.teamId,
              isRookie: false, // clear rookie status after first season
            })
            .where(eq(players.id, p.id))
        );
      }

      if (newTransactions.length > 0) {
        batchQueries.push(db.insert(transactions).values(newTransactions));
      }

      const queryChunkSize = 100;
      for (let i = 0; i < batchQueries.length; i += queryChunkSize) {
        const queryChunk = batchQueries.slice(i, i + queryChunkSize);
        await db.batch(queryChunk as any);
      }
    }

    // Enforce strict roster limits at the end of Phase 2 evolution/retirements
    await enforceLeagueRosterLimitsAction();

    // Determine biggest leap
    let biggestLeap: any = null;
    let maxLeap = 0;
    for (const res of evolutionResultsList) {
      if (res.deltaOverall > maxLeap) {
        maxLeap = res.deltaOverall;
        biggestLeap = res;
      }
    }

    return {
      success: true,
      logs: evolutionLogs,
      evolutionResults: {
        improvedCount,
        regressedCount,
        retiredCount,
        biggestLeap,
        players: evolutionResultsList.sort((a, b) => b.deltaOverall - a.deltaOverall),
      }
    };
  } catch (error: any) {
    console.error("Failed to run player evolution:", error);
    return { success: false, error: error.message || "Failed to progress players." };
  }
}

export async function executeDraftPickAction(teamId: string, playerId: string, pickNumber: number, season: number) {
  try {
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    if (!player) return { success: false, error: "Player not found." };
    if (player.status !== "DraftPool") return { success: false, error: "Player is not in the draft pool." };

    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) return { success: false, error: "Team not found." };

    // Update player to active, assign to team, set contract to 3 years
    await db
      .update(players)
      .set({
        teamId,
        status: "Active",
        contractYearsRemaining: 3,
      })
      .where(eq(players.id, playerId));

    // Mark pick as used in draftPicks table
    await db
      .update(draftPicks)
      .set({ isUsed: true })
      .where(
        and(
          eq(draftPicks.pickNumber, pickNumber),
          eq(draftPicks.season, season)
        )
      );

    // Record transaction
    const lastGame = await db
      .select({ year: games.seasonYear })
      .from(games)
      .orderBy(desc(games.seasonYear))
      .limit(1);
    const currentYear = lastGame[0]?.year ?? 2026;

    const description = `DRAFT: ${team.city} ${team.name} selected prospect ${player.firstName} ${player.lastName} (${player.position}, OVR ${player.overall}) in the Rookie Draft.`;
    await db.insert(transactions).values({
      type: "Draft",
      description,
      seasonYear: currentYear,
      gameDay: 82,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Draft pick execution failed:", error);
    return { success: false, error: error.message || "Draft pick failed." };
  }
}

export async function getDraftSessionPicksAction(season: number) {
  try {
    const picks = await db
      .select({
        id: draftPicks.id,
        ownerTeamId: draftPicks.ownerTeamId,
        originalTeamId: draftPicks.originalTeamId,
        season: draftPicks.season,
        round: draftPicks.round,
        pickNumber: draftPicks.pickNumber,
        isUsed: draftPicks.isUsed,
        ownerCity: teams.city,
        ownerName: teams.name,
      })
      .from(draftPicks)
      .leftJoin(teams, eq(draftPicks.ownerTeamId, teams.id))
      .where(and(eq(draftPicks.season, season), isNotNull(draftPicks.pickNumber)))
      .orderBy(draftPicks.pickNumber);

    return { success: true, picks };
  } catch (error: any) {
    console.error("Failed to load draft session picks:", error);
    return { success: false, picks: [], error: error.message || "Failed to load picks." };
  }
}

export async function replenishLeagueRostersAction() {
  try {
    console.log("[Roster Replenishment] Starting safety net check...");

    const allTeams = await db.select().from(teams);
    const activePlayers = await db
      .select()
      .from(players)
      .where(eq(players.status, "Active"));

    const rosterCounts = new Map<string, number>();
    for (const t of allTeams) {
      rosterCounts.set(t.id, 0);
    }
    for (const p of activePlayers) {
      if (p.teamId) {
        rosterCounts.set(p.teamId, (rosterCounts.get(p.teamId) ?? 0) + 1);
      }
    }

    const depletedTeams = allTeams.filter((t) => (rosterCounts.get(t.id) ?? 0) < MIN_ROSTER_SIZE);

    if (depletedTeams.length === 0) {
      console.log("[Roster Replenishment] All teams have at least 12 players. Safety net bypassed.");
      return { success: true, count: 0 };
    }

    console.log(`[Roster Replenishment] Found ${depletedTeams.length} depleted teams. Initiating signings...`);

    const freeAgents = await db
      .select()
      .from(players)
      .where(and(eq(players.status, "Active"), isNull(players.teamId)))
      .orderBy(desc(players.overall));

    let faIndex = 0;
    let totalSigningsCount = 0;

    await db.transaction(async (tx) => {
      const lastGame = await tx
        .select({ year: games.seasonYear })
        .from(games)
        .orderBy(desc(games.seasonYear))
        .limit(1);
      const currentYear = lastGame[0]?.year ?? 2026;

      for (const team of depletedTeams) {
        const currentCount = rosterCounts.get(team.id) ?? 0;
        const playersNeeded = MIN_ROSTER_SIZE - currentCount;

        console.log(`[Roster Replenishment] ${team.city} ${team.name} needs ${playersNeeded} players (current roster: ${currentCount}).`);

        if (faIndex + playersNeeded > freeAgents.length) {
          console.warn("[Roster Replenishment] Free agency pool is too small! Generating emergency free agents...");
          const emergencyFAs: Array<typeof players.$inferInsert> = [];
          const neededFAsCount = (faIndex + playersNeeded) - freeAgents.length;

          for (let k = 0; k < neededFAsCount + 10; k++) {
            const isFilAm = Math.random() < 0.2;
            const firstName = isFilAm
              ? FILAM_FIRST_NAMES[Math.floor(Math.random() * FILAM_FIRST_NAMES.length)]
              : FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
            const lastName = isFilAm
              ? FILAM_SURNAMES[Math.floor(Math.random() * FILAM_SURNAMES.length)]
              : SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
            const age = Math.floor(Math.random() * 12) + 21; // 21 to 32
            const hometown = Math.random() < 0.5 ? "Manila" : "Cebu City";
            const position = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
            const overall = Math.floor(Math.random() * 20) + 55; // 55 to 74

            emergencyFAs.push({
              teamId: null,
              firstName,
              lastName,
              age,
              hometown,
              isFilAm,
              overall,
              salary: 500000,
              position,
              threePoint: overall - Math.floor(Math.random() * 5),
              insideScoring: overall - Math.floor(Math.random() * 5),
              playmaking: overall - Math.floor(Math.random() * 5),
              perimeterDefense: overall - Math.floor(Math.random() * 5),
              interiorDefense: overall - Math.floor(Math.random() * 5),
              rebounding: overall - Math.floor(Math.random() * 5),
              speed: overall - Math.floor(Math.random() * 5),
              stamina: overall - Math.floor(Math.random() * 5),
              contractYearsRemaining: 1,
              status: "Active",
              isRookie: false,
              injuryDaysRemaining: 0,
              injuryType: null,
            });
          }

          const insertedFAs = await tx.insert(players).values(emergencyFAs).returning();
          freeAgents.push(...insertedFAs);
        }

        for (let signIdx = 0; signIdx < playersNeeded; signIdx++) {
          const fa = freeAgents[faIndex];
          faIndex++;
          totalSigningsCount++;

          const contractYears = Math.random() < 0.5 ? 1 : 2;
          const salaryVal = 500000; // Minimum baseline salary ₱500,000

          await tx
            .update(players)
            .set({
              teamId: team.id,
              contractYearsRemaining: contractYears,
              salary: salaryVal,
            })
            .where(eq(players.id, fa.id));

          const description = `SYSTEM: ${team.city} ${team.name} signed free agent ${fa.firstName} ${fa.lastName} (OVR ${fa.overall}) to meet league roster minimums.`;

          await tx.insert(transactions).values({
            type: "Signing",
            description,
            seasonYear: currentYear,
            gameDay: 82,
          });

          console.log(`[Roster Replenishment] Signed ${fa.firstName} ${fa.lastName} to ${team.name}.`);
        }
      }
    });

    console.log(`[Roster Replenishment] Safety net execution complete. Signed ${totalSigningsCount} players.`);
    return { success: true, count: totalSigningsCount };
  } catch (error: any) {
    console.error("[Roster Replenishment] Safety net execution failed:", error);
    return { success: false, error: error.message || "Failed to replenish rosters." };
  }
}

export async function advanceToNextSeasonAction() {
  try {
    // 1. Get current year
    const lastGame = await db
      .select({ year: games.seasonYear })
      .from(games)
      .orderBy(desc(games.seasonYear))
      .limit(1);
    const currentYear = lastGame[0]?.year ?? 2026;
    const nextYear = currentYear + 1;

    // Run safety net roster limits enforcement
    await enforceLeagueRosterLimitsAction();

    // 2. Wipe completed season schedule
    await db.delete(games); // Cascade deletes playerGameStats

    // 3. Generate new schedule for the next year
    const scheduleRes = await generateScheduleAction(nextYear);
    if (!scheduleRes.success) {
      throw new Error(scheduleRes.error || "Failed to generate schedule.");
    }

    // Record season start transaction
    await db.insert(transactions).values({
      type: "Signing",
      description: `📣 Season ${nextYear} has officially initialized! Schedules generated, rosters updated, and trades are open.`,
      seasonYear: nextYear,
      gameDay: 1,
    });

    // Generate draft picks for the next season (Round 1 & Round 2)
    const allTeams = await db.select().from(teams);
    const draftPicksToInsert: Array<typeof draftPicks.$inferInsert> = [];
    for (const team of allTeams) {
      draftPicksToInsert.push({
        ownerTeamId: team.id,
        originalTeamId: team.id,
        season: nextYear,
        round: 1,
        pickNumber: null,
        isUsed: false,
      });
      draftPicksToInsert.push({
        ownerTeamId: team.id,
        originalTeamId: team.id,
        season: nextYear,
        round: 2,
        pickNumber: null,
        isUsed: false,
      });
    }
    await db.insert(draftPicks).values(draftPicksToInsert);

    // Generate fresh rookie class for the upcoming draft pool (so they can be scouted during the season)
    await generateRookiePoolAction(nextYear, true);

    return { success: true, nextYear };
  } catch (error: any) {
    console.error("Failed to advance to next season:", error);
    return { success: false, error: error.message || "Failed to advance season." };
  }
}

export async function getDraftProspectsAction() {
  try {
    const prospects = await db
      .select()
      .from(players)
      .where(eq(players.status, "DraftPool"))
      .orderBy(desc(players.overall));
    return { success: true, prospects };
  } catch (error: any) {
    console.error("Failed to fetch draft prospects:", error);
    return { success: false, prospects: [], error: error.message || "Failed to fetch prospects." };
  }
}

export async function getUserDraftPicksAction(teamId: string) {
  try {
    const picks = await db
      .select({
        id: draftPicks.id,
        ownerTeamId: draftPicks.ownerTeamId,
        originalTeamId: draftPicks.originalTeamId,
        season: draftPicks.season,
        round: draftPicks.round,
        pickNumber: draftPicks.pickNumber,
        isUsed: draftPicks.isUsed,
        originalTeamName: teams.name,
        originalTeamCity: teams.city,
      })
      .from(draftPicks)
      .leftJoin(teams, eq(draftPicks.originalTeamId, teams.id))
      .where(and(eq(draftPicks.ownerTeamId, teamId), eq(draftPicks.isUsed, false)))
      .orderBy(draftPicks.season, draftPicks.round);
    return { success: true, picks };
  } catch (error: any) {
    console.error("Failed to fetch user draft picks:", error);
    return { success: false, picks: [], error: error.message || "Failed to fetch draft picks." };
  }
}

export async function runOffseasonFreeAgencyAction(userTeamId: string) {
  try {
    const allTeams = await db.select().from(teams);
    const cpuTeams = allTeams.filter((t) => t.id !== userTeamId);
    
    // Fetch all active players
    const allPlayers = await db
      .select()
      .from(players)
      .where(eq(players.status, "Active"));

    // Calculate rosters and payrolls
    const rosters: Record<string, typeof allPlayers> = {};
    for (const team of allTeams) {
      rosters[team.id] = [];
    }
    const freeAgents: typeof allPlayers = [];
    for (const player of allPlayers) {
      if (player.teamId) {
        if (!rosters[player.teamId]) rosters[player.teamId] = [];
        rosters[player.teamId].push(player);
      } else {
        freeAgents.push(player);
      }
    }

    // Sort free agents by overall descending
    freeAgents.sort((a, b) => b.overall - a.overall);

    const logs: string[] = [];
    const SALARY_CAP = 50000000;

    // CPU teams sign players if they have less than 12 players
    for (const team of cpuTeams) {
      const roster = rosters[team.id] || [];
      let currentPayroll = roster.reduce((sum, p) => sum + p.salary, 0);
      let rosterSize = roster.length;

      if (rosterSize < 12) {
        const slotsNeeded = 12 - rosterSize;

        for (let i = 0; i < slotsNeeded; i++) {
          const capRemaining = SALARY_CAP - currentPayroll;
          // Find the best FA we can afford, or sign at min salary if cap space is less than 500k
          let selectedFaIndex = -1;
          for (let j = 0; j < freeAgents.length; j++) {
            const fa = freeAgents[j];
            if (fa.salary <= capRemaining || capRemaining < 500000) {
              selectedFaIndex = j;
              break;
            }
          }

          if (selectedFaIndex !== -1) {
            const fa = freeAgents[selectedFaIndex];
            // Remove from free agents list
            freeAgents.splice(selectedFaIndex, 1);

            // Determine contract details
            const contractYears = Math.floor(Math.random() * 2) + 2; // 2-3 years
            const signingSalary = capRemaining >= fa.salary ? fa.salary : Math.max(500000, capRemaining);

            await db
              .update(players)
              .set({
                teamId: team.id,
                contractYearsRemaining: contractYears,
                salary: signingSalary,
              })
              .where(eq(players.id, fa.id));

            // Log it
            const msg = `✍️ [${team.city} ${team.name}] signed free agent ${fa.firstName} ${fa.lastName} (OVR ${fa.overall}) for ₱${signingSalary.toLocaleString("en-PH")}/yr.`;
            logs.push(msg);

            const lastGame = await db
              .select({ year: games.seasonYear })
              .from(games)
              .orderBy(desc(games.seasonYear))
              .limit(1);
            const currentYear = lastGame[0]?.year ?? 2026;

            await db.insert(transactions).values({
              type: "Signing",
              description: msg,
              seasonYear: currentYear,
              gameDay: 82,
            });

            currentPayroll += signingSalary;
            rosterSize++;
          }
        }
      }
    }

    // Run the safety net sweep to enforce all rules (waive excess, minimum signings if any left)
    await enforceLeagueRosterLimitsAction();

    // Re-query free agents remaining
    const remainingFAs = await db
      .select()
      .from(players)
      .where(and(eq(players.status, "Active"), isNull(players.teamId)));

    return {
      success: true,
      cpuSignings: logs,
      freeAgentsRemaining: remainingFAs.length,
    };
  } catch (error: any) {
    console.error("runOffseasonFreeAgencyAction failed:", error);
    return { success: false, error: error.message || "Failed to run offseason free agency." };
  }
}
