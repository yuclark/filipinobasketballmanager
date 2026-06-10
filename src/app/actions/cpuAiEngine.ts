"use server";

import { db } from "@/db";
import { eq, and, desc, sql, isNull, inArray, isNotNull } from "drizzle-orm";
import { players, teams, games, transactions } from "@/db/schema";
import { MIN_ROSTER_SIZE, MAX_ROSTER_SIZE } from "@/lib/constants";

const SALARY_CAP = 50000000; // 50,000,000 PHP

// Name pools for emergency free agent generation
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

function getPositionGroup(pos: string): "G" | "F" | "C" {
  const p = pos.toUpperCase();
  if (p === "PG" || p === "SG" || p === "G") return "G";
  if (p === "SF" || p === "PF" || p === "F") return "F";
  return "C";
}

/**
 * Sequential-loop based roster limits balancing agent.
 * Enforces the 12-18 player rules with NBA Minimum Contract Exception and filler fallback generation.
 */
export async function enforceLeagueRosterLimitsAction() {
  try {
    console.log("[Roster Balancing Agent] Starting sequential roster limits enforcement...");

    const allTeams = await db.select().from(teams);

    // Fetch current season/day to log transaction correctly
    const lastGame = await db
      .select({ year: games.seasonYear, day: games.gameNumber })
      .from(games)
      .orderBy(desc(games.seasonYear), desc(games.gameNumber))
      .limit(1);
    const currentYear = lastGame[0]?.year ?? 2026;
    const currentDay = lastGame[0]?.day ?? 1;

    // Strict sequential loop over all teams (avoiding forEach to prevent race conditions)
    for (const team of allTeams) {
      // Query roster sequentially for this specific team
      const teamRoster = await db
        .select()
        .from(players)
        .where(and(eq(players.teamId, team.id), eq(players.status, "Active")));

      let rosterCount = teamRoster.length;

      if (rosterCount < MIN_ROSTER_SIZE) {
        const deficit = MIN_ROSTER_SIZE - rosterCount;
        console.log(`[Roster Balancing Agent] Team ${team.city} ${team.name} has deficit of ${deficit} players.`);

        for (let i = 0; i < deficit; i++) {
          // Fetch the highest overall free agent from the pool
          const [bestFa] = await db
            .select()
            .from(players)
            .where(and(isNull(players.teamId), eq(players.status, "Active")))
            .orderBy(desc(players.overall))
            .limit(1);

          let chosenPlayer;

          if (!bestFa) {
            // Free Agency pool is completely exhausted, generate a local baseline filler player inside the loop
            console.log(`[Roster Balancing Agent] FA pool empty. Generating local replacement player for ${team.name}.`);

            // Find lowest depth group position on the team roster
            const positionCounts: Record<string, number> = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
            for (const p of teamRoster) {
              if (p.position in positionCounts) {
                positionCounts[p.position]++;
              }
            }

            let lowestPos = "SG";
            let minCount = Infinity;
            for (const pos of ["PG", "SG", "SF", "PF", "C"]) {
              if (positionCounts[pos] < minCount) {
                minCount = positionCounts[pos];
                lowestPos = pos;
              }
            }

            const isFilAm = Math.random() < 0.2;
            const firstName = isFilAm
              ? FILAM_FIRST_NAMES[Math.floor(Math.random() * FILAM_FIRST_NAMES.length)]
              : FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
            const lastName = isFilAm
              ? FILAM_SURNAMES[Math.floor(Math.random() * FILAM_SURNAMES.length)]
              : SURNAMES[Math.floor(Math.random() * SURNAMES.length)];

            const age = Math.floor(Math.random() * 8) + 21; // 21 to 28
            const overall = Math.floor(Math.random() * 6) + 60; // 60 to 65

            const [inserted] = await db.insert(players).values({
              teamId: team.id, // assign directly to team
              firstName,
              lastName,
              age,
              hometown: isFilAm ? "Fil-Am" : "Manila",
              isFilAm,
              overall,
              salary: 500000, // minimum salary
              position: lowestPos,
              threePoint: overall,
              insideScoring: overall,
              playmaking: overall,
              perimeterDefense: overall,
              interiorDefense: overall,
              rebounding: overall,
              speed: overall,
              stamina: overall,
              contractYearsRemaining: 1, // contract to 1 year
              status: "Active",
              isRookie: false,
            }).returning();

            chosenPlayer = inserted;

            // Log this transaction immediately
            await db.insert(transactions).values({
              type: "System",
              description: `SYSTEM: Generated emergency local replacement player ${chosenPlayer.firstName} ${chosenPlayer.lastName} (${chosenPlayer.position}, OVR ${chosenPlayer.overall}) to fulfill ${team.city} ${team.name} roster requirements.`,
              seasonYear: currentYear,
              gameDay: currentDay,
            });

            teamRoster.push(chosenPlayer);
          } else {
            // Assign existing free agent to team (bypassing salary cap check!)
            const [updated] = await db
              .update(players)
              .set({
                teamId: team.id,
                salary: 500000,
                contractYearsRemaining: 2,
              })
              .where(eq(players.id, bestFa.id))
              .returning();

            chosenPlayer = updated;

            await db.insert(transactions).values({
              type: "System",
              description: `SYSTEM: Programmatically signed free agent ${chosenPlayer.firstName} ${chosenPlayer.lastName} (OVR ${chosenPlayer.overall}) to the ${team.city} ${team.name} via Minimum Contract Exception.`,
              seasonYear: currentYear,
              gameDay: currentDay,
            });

            teamRoster.push(chosenPlayer);
          }
        }
      } else if (rosterCount > MAX_ROSTER_SIZE) {
        const excess = rosterCount - MAX_ROSTER_SIZE;
        console.log(`[Roster Balancing Agent] Team ${team.city} ${team.name} has excess of ${excess} players.`);

        // Sort roster by overall ascending (lowest overall rating first)
        const sortedRoster = [...teamRoster].sort((a, b) => a.overall - b.overall);

        for (let i = 0; i < excess; i++) {
          const p = sortedRoster[i];
          await db
            .update(players)
            .set({
              teamId: null,
            })
            .where(eq(players.id, p.id));

          await db.insert(transactions).values({
            type: "System",
            description: `SYSTEM: Programmatically waived player ${p.firstName} ${p.lastName} (OVR ${p.overall}) from the ${team.city} ${team.name} to comply with roster maximum limits of ${MAX_ROSTER_SIZE} players.`,
            seasonYear: currentYear,
            gameDay: currentDay,
          });
        }
      }
    }

    console.log("[Roster Balancing Agent] Roster limits enforcement completed.");
    return { success: true };
  } catch (error: any) {
    console.error("Error in enforceLeagueRosterLimitsAction:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle daily CPU team front-office logic (signings & trades).
 * Converted to sequential loops to eliminate any asynchronous race conditions.
 */
type Player = typeof players.$inferSelect;
type Team = typeof teams.$inferSelect;

/**
 * Handle daily CPU team front-office logic (signings & trades) using purely in-memory operations.
 */
export async function runCpuDailyAiEngineAction(
  currentPlayersState: Player[],
  currentTeamsState: Team[],
  gameDay: number,
  seasonYear: number,
  userTeamId?: string | null
) {
  try {
    console.log(`[CPU Daily AI Engine] Running front office checks for Day ${gameDay}, Season ${seasonYear}...`);

    const cpuTeams = currentTeamsState.filter((t) => t.id !== userTeamId);
    if (cpuTeams.length === 0) {
      return { updatedPlayers: currentPlayersState, updatedTeams: currentTeamsState };
    }

    // ─── 1. CPU FREE AGENCY SIGNINGS ───
    for (const team of cpuTeams) {
      const roster = currentPlayersState.filter(
        (p) => p.teamId === team.id && p.status === "Active"
      );

      const rosterCount = roster.length;
      if (rosterCount >= MAX_ROSTER_SIZE) continue; // Cannot sign if at limit

      // Check position group counts
      const counts = { G: 0, F: 0, C: 0 };
      for (const p of roster) {
        const grp = getPositionGroup(p.position);
        counts[grp]++;
      }

      // Identify groups with deficit (< 3 players)
      const deficitGroups: ("G" | "F" | "C")[] = [];
      if (counts.G < 3) deficitGroups.push("G");
      if (counts.F < 3) deficitGroups.push("F");
      if (counts.C < 3) deficitGroups.push("C");

      if (deficitGroups.length === 0) continue;

      const teamTotalSalary = roster.reduce((sum, p) => sum + p.salary, 0);

      // Search free agency for the first player of a deficit group that maintains salary cap compliance
      for (const group of deficitGroups) {
        const freeAgents = currentPlayersState
          .filter((p) => !p.teamId && p.status === "Active")
          .sort((a, b) => b.overall - a.overall)
          .slice(0, 100);

        // Find qualifying player in FA pool
        const qualifyingFA = freeAgents.find((fa) => {
          const faGroup = getPositionGroup(fa.position);
          return faGroup === group && teamTotalSalary + fa.salary <= SALARY_CAP;
        });

        if (qualifyingFA) {
          // Mutate the state object directly in memory
          qualifyingFA.teamId = team.id;
          qualifyingFA.contractYearsRemaining = 2;

          const descStr = `✍️ Front Office: The ${team.city} ${team.name} signed Free Agent ${qualifyingFA.firstName} ${qualifyingFA.lastName} (${qualifyingFA.position}, OVR ${qualifyingFA.overall}) to a 2-year contract of ₱${qualifyingFA.salary.toLocaleString("en-PH")}/yr to address a positional deficit.`;
          await db.insert(transactions).values({
            type: "Signing",
            description: descStr,
            seasonYear,
            gameDay,
          });

          console.log(`[CPU Daily AI Engine] ${team.name} signed FA ${qualifyingFA.firstName} ${qualifyingFA.lastName} (${qualifyingFA.position})`);
          break; // Sign at most one player per team per day
        }
      }
    }

    // ─── 2. CPU-TO-CPU TRADES (Only before Day 50) ───
    if (gameDay < 50) {
      const tradeMatchingTeams = [];

      for (const team of cpuTeams) {
        const roster = currentPlayersState.filter(
          (p) => p.teamId === team.id && p.status === "Active"
        );

        const counts = { G: 0, F: 0, C: 0 };
        for (const p of roster) {
          const grp = getPositionGroup(p.position);
          counts[grp]++;
        }

        const deficits: ("G" | "F" | "C")[] = [];
        const surpluses: ("G" | "F" | "C")[] = [];

        if (counts.G < 3) deficits.push("G");
        if (counts.F < 3) deficits.push("F");
        if (counts.C < 3) deficits.push("C");

        if (counts.G > 5) surpluses.push("G");
        if (counts.F > 5) surpluses.push("F");
        if (counts.C > 3 && deficits.length > 0) surpluses.push("C");

        tradeMatchingTeams.push({
          team,
          roster,
          counts,
          deficits,
          surpluses,
          totalSalary: roster.reduce((sum, p) => sum + p.salary, 0),
        });
      }

      let tradeExecuted = false;

      for (let i = 0; i < tradeMatchingTeams.length && !tradeExecuted; i++) {
        const teamA = tradeMatchingTeams[i];
        if (teamA.surpluses.length === 0 || teamA.deficits.length === 0) continue;
        if (teamA.roster.length < MIN_ROSTER_SIZE || teamA.roster.length > MAX_ROSTER_SIZE) continue;

        for (let j = 0; j < tradeMatchingTeams.length && !tradeExecuted; j++) {
          if (i === j) continue;
          const teamB = tradeMatchingTeams[j];
          if (teamB.roster.length < MIN_ROSTER_SIZE || teamB.roster.length > MAX_ROSTER_SIZE) continue;

          // Inverse configurations
          const matchX = teamA.surpluses.find((x) => teamB.deficits.includes(x));
          const matchY = teamA.deficits.find((y) => teamB.surpluses.includes(y));

          if (matchX && matchY) {
            const candidatesA = teamA.roster.filter((p) => getPositionGroup(p.position) === matchX);
            const candidatesB = teamB.roster.filter((p) => getPositionGroup(p.position) === matchY);

            for (const playerA of candidatesA) {
              for (const playerB of candidatesB) {
                // Enforce 15% overall rating variance
                const ovrDiff = Math.abs(playerA.overall - playerB.overall);
                const maxOvr = Math.max(playerA.overall, playerB.overall);
                if (ovrDiff > maxOvr * 0.15) continue;

                // Check salary cap limits
                const newSalaryA = teamA.totalSalary - playerA.salary + playerB.salary;
                const newSalaryB = teamB.totalSalary - playerB.salary + playerA.salary;

                if (newSalaryA <= SALARY_CAP && newSalaryB <= SALARY_CAP) {
                  // Mutate player objects directly in memory
                  playerA.teamId = teamB.team.id;
                  playerB.teamId = teamA.team.id;

                  const descStr = `🔄 TRADE: The ${teamA.team.city} ${teamA.team.name} traded ${playerA.firstName} ${playerA.lastName} (${playerA.position}, OVR ${playerA.overall}) to the ${teamB.team.city} ${teamB.team.name} in exchange for ${playerB.firstName} ${playerB.lastName} (${playerB.position}, OVR ${playerB.overall}) to balance rosters.`;
                  await db.insert(transactions).values({
                    type: "Trade",
                    description: descStr,
                    seasonYear,
                    gameDay,
                  });

                  console.log(`[CPU Daily AI Engine] TRADE executed: ${descStr}`);

                  tradeExecuted = true;
                  break;
                }
              }
              if (tradeExecuted) break;
            }
          }
        }
      }

      // Alternative "Asset Optimization" Trade Pathway
      if (!tradeExecuted && Math.random() < 0.08) {
        console.log("[CPU Daily AI Engine] Asset Optimization trade trigger hit (8% roll). Searching for swaps...");

        // Generate all ordered pairs of distinct CPU teams
        const pairs: Array<{
          teamA: typeof tradeMatchingTeams[0];
          teamB: typeof tradeMatchingTeams[0];
        }> = [];

        for (let i = 0; i < tradeMatchingTeams.length; i++) {
          for (let j = 0; j < tradeMatchingTeams.length; j++) {
            if (i === j) continue;
            pairs.push({
              teamA: tradeMatchingTeams[i],
              teamB: tradeMatchingTeams[j],
            });
          }
        }

        // Shuffle pairs using Fisher-Yates
        for (let i = pairs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = pairs[i];
          pairs[i] = pairs[j];
          pairs[j] = temp;
        }

        // Search for a qualifying 1-for-1 swap
        for (const pair of pairs) {
          const tA = pair.teamA;
          const tB = pair.teamB;

          // Safeguard active roster bounds (bounds remain identical after 1-for-1 swap)
          if (tA.roster.length < MIN_ROSTER_SIZE || tA.roster.length > MAX_ROSTER_SIZE) continue;
          if (tB.roster.length < MIN_ROSTER_SIZE || tB.roster.length > MAX_ROSTER_SIZE) continue;

          for (const playerA of tA.roster) {
            for (const playerB of tB.roster) {
              // Position group must match exactly
              if (getPositionGroup(playerA.position) !== getPositionGroup(playerB.position)) {
                continue;
              }

              // Team A wants to clear cap space: higher salary, and target player (playerB) is younger or within 5 OVR points
              const isHigherSalary = playerA.salary > playerB.salary;
              if (!isHigherSalary) continue;

              const isYounger = playerB.age < playerA.age;
              const isWithinOvrLimit = (playerA.overall - playerB.overall) <= 5;
              if (!isYounger && !isWithinOvrLimit) continue;

              // Team B wants to upgrade: incoming player (playerA) is +3 or greater OVR rating than outgoing player (playerB)
              const isUpgrade = playerA.overall >= playerB.overall + 3;
              if (!isUpgrade) continue;

              // Enforce cap space limits for both teams post-trade
              const newSalaryA = tA.totalSalary - playerA.salary + playerB.salary;
              const newSalaryB = tB.totalSalary - playerB.salary + playerA.salary;

              if (newSalaryA <= SALARY_CAP && newSalaryB <= SALARY_CAP) {
                // Execute the swap directly in memory
                playerA.teamId = tB.team.id;
                playerB.teamId = tA.team.id;

                const descStr = `🔄 TRADE: The ${tA.team.city} ${tA.team.name} cleared cap space by sending ${playerA.firstName} ${playerA.lastName} (${playerA.position}, OVR ${playerA.overall}) to the ${tB.team.city} ${tB.team.name} in exchange for ${playerB.firstName} ${playerB.lastName} (${playerB.position}, OVR ${playerB.overall}).`;

                await db.insert(transactions).values({
                  type: "Trade",
                  description: descStr,
                  seasonYear,
                  gameDay,
                });

                console.log(`[CPU Daily AI Engine] Asset Optimization Trade Executed: ${descStr}`);

                tradeExecuted = true;
                break;
              }
            }
            if (tradeExecuted) break;
          }
          if (tradeExecuted) break;
        }
      }
    }

    return { updatedPlayers: currentPlayersState, updatedTeams: currentTeamsState };
  } catch (error: any) {
    console.error("Error in runCpuDailyAiEngineAction:", error);
    return { updatedPlayers: currentPlayersState, updatedTeams: currentTeamsState };
  }
}
