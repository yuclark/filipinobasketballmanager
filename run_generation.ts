import { db } from "./src/db";
import { players, teams, games, tradeProposals } from "./src/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { MIN_ROSTER_SIZE, MAX_ROSTER_SIZE } from "./src/lib/constants";

const SALARY_CAP = 50000000;

function getPositionGroup(pos: string): "G" | "F" | "C" {
  const p = pos.toUpperCase();
  if (p === "PG" || p === "SG" || p === "G") return "G";
  if (p === "SF" || p === "PF" || p === "F") return "F";
  return "C";
}

async function main() {
  const allTeams = await db.select().from(teams);
  const userTeam = allTeams.find(t => t.name === "Metros") || allTeams[0];
  const userTeamId = userTeam.id;
  console.log(`Running with team: ${userTeam.city} ${userTeam.name} (${userTeamId})`);

  const lastCompleted = await db
    .select({ year: games.seasonYear, day: games.gameNumber })
    .from(games)
    .where(eq(games.status, "Completed"))
    .orderBy(desc(games.seasonYear), desc(games.gameNumber))
    .limit(1);
  const lastGame = lastCompleted.length > 0 ? lastCompleted : await db
    .select({ year: games.seasonYear, day: games.gameNumber })
    .from(games)
    .orderBy(desc(games.seasonYear), games.gameNumber)
    .limit(1);
  const currentDay = lastGame[0]?.day ?? 1;
  console.log(`Current game day: ${currentDay}`);

  const activePlayers = await db
    .select()
    .from(players)
    .where(eq(players.status, "Active"));

  const userRoster = activePlayers.filter((p) => p.teamId === userTeamId);
  console.log(`User roster size: ${userRoster.length}`);
  if (userRoster.length === 0) {
    console.log("Exiting: User roster is empty");
    return;
  }

  const cpuPlayers = activePlayers.filter((p) => p.teamId && p.teamId !== userTeamId);
  
  const rostersByCpuTeam = new Map<string, typeof players.$inferSelect[]>();
  for (const p of cpuPlayers) {
    if (p.teamId) {
      if (!rostersByCpuTeam.has(p.teamId)) rostersByCpuTeam.set(p.teamId, []);
      rostersByCpuTeam.get(p.teamId)!.push(p);
    }
  }

  const allCpuTeams = await db.select().from(teams).where(sql`id != ${userTeamId}`);
  console.log(`CPU Teams count: ${allCpuTeams.length}`);

  const userPosCounts = { G: 0, F: 0, C: 0 };
  for (const p of userRoster) {
    userPosCounts[getPositionGroup(p.position)]++;
  }
  console.log("User position counts:", userPosCounts);

  const userDeficits: string[] = [];
  const userSurpluses: string[] = [];
  if (userPosCounts.G < 3) userDeficits.push("G");
  if (userPosCounts.F < 3) userDeficits.push("F");
  if (userPosCounts.C < 2) userDeficits.push("C");
  if (userPosCounts.G > 5) userSurpluses.push("G");
  if (userPosCounts.F > 5) userSurpluses.push("F");
  if (userPosCounts.C > 3) userSurpluses.push("C");
  console.log("User deficits:", userDeficits, "Surpluses:", userSurpluses);

  const userSalaryTotal = userRoster.reduce((sum, p) => sum + p.salary, 0);
  console.log(`User total salary: ${userSalaryTotal}`);

  for (const cpuTeam of allCpuTeams) {
    const cpuRoster = rostersByCpuTeam.get(cpuTeam.id) || [];
    if (cpuRoster.length === 0) {
      console.log(`Skipping CPU Team ${cpuTeam.name}: Roster is empty`);
      continue;
    }

    const cpuPosCounts = { G: 0, F: 0, C: 0 };
    for (const p of cpuRoster) {
      cpuPosCounts[getPositionGroup(p.position)]++;
    }

    const cpuDeficits: string[] = [];
    const cpuSurpluses: string[] = [];
    if (cpuPosCounts.G < 3) cpuDeficits.push("G");
    if (cpuPosCounts.F < 3) cpuDeficits.push("F");
    if (cpuPosCounts.C < 2) cpuDeficits.push("C");
    if (cpuPosCounts.G > 5) cpuSurpluses.push("G");
    if (cpuPosCounts.F > 5) cpuSurpluses.push("F");
    if (cpuPosCounts.C > 3) cpuSurpluses.push("C");

    let matchingCpuPlayer: typeof players.$inferSelect | null = null;
    let matchingUserPlayer: typeof players.$inferSelect | null = null;

    // Option A: User deficit, CPU surplus
    for (const userDef of userDeficits) {
      if (cpuSurpluses.includes(userDef)) {
        const cpuCandidates = cpuRoster.filter((p) => getPositionGroup(p.position) === userDef);
        const userCandidates = userRoster.filter((p) => getPositionGroup(p.position) !== userDef);
        if (cpuCandidates.length > 0 && userCandidates.length > 0) {
          matchingCpuPlayer = cpuCandidates[Math.floor(Math.random() * cpuCandidates.length)];
          matchingUserPlayer = userCandidates[Math.floor(Math.random() * userCandidates.length)];
          break;
        }
      }
    }

    // Option B: CPU deficit, User surplus
    if (!matchingCpuPlayer || !matchingUserPlayer) {
      for (const cpuDef of cpuDeficits) {
        if (userSurpluses.includes(cpuDef)) {
          const userCandidates = userRoster.filter((p) => getPositionGroup(p.position) === cpuDef);
          const cpuCandidates = cpuRoster.filter((p) => getPositionGroup(p.position) !== cpuDef);
          if (userCandidates.length > 0 && cpuCandidates.length > 0) {
            matchingUserPlayer = userCandidates[Math.floor(Math.random() * userCandidates.length)];
            matchingCpuPlayer = cpuCandidates[Math.floor(Math.random() * cpuCandidates.length)];
            break;
          }
        }
      }
    }

    // Option C: General OVR swap
    if (!matchingCpuPlayer || !matchingUserPlayer) {
      for (const posGrp of ["G", "F", "C"]) {
        const userCandidates = userRoster.filter((p) => getPositionGroup(p.position) === posGrp);
        const cpuCandidates = cpuRoster.filter((p) => getPositionGroup(p.position) === posGrp);
        if (userCandidates.length > 0 && cpuCandidates.length > 0) {
          matchingUserPlayer = userCandidates[Math.floor(Math.random() * userCandidates.length)];
          matchingCpuPlayer = cpuCandidates[Math.floor(Math.random() * cpuCandidates.length)];
          break;
        }
      }
    }

    if (matchingCpuPlayer && matchingUserPlayer) {
      const ovrDiff = Math.abs(matchingCpuPlayer.overall - matchingUserPlayer.overall);
      const maxOvr = Math.max(matchingCpuPlayer.overall, matchingUserPlayer.overall);
      if (ovrDiff > maxOvr * 0.15) {
        console.log(`Rejected ${cpuTeam.name}: OVR diff (${ovrDiff}) too high (limit is ${maxOvr * 0.15}) - CPU: ${matchingCpuPlayer.firstName} (${matchingCpuPlayer.overall}), User: ${matchingUserPlayer.firstName} (${matchingUserPlayer.overall})`);
        continue;
      }
      if (matchingCpuPlayer.overall < 65 || matchingUserPlayer.overall < 65) {
        console.log(`Rejected ${cpuTeam.name}: OVR too low (CPU: ${matchingCpuPlayer.overall}, User: ${matchingUserPlayer.overall})`);
        continue;
      }

      const cpuSalaryTotal = cpuRoster.reduce((sum, p) => sum + p.salary, 0);
      const newUserSalary = userSalaryTotal - matchingUserPlayer.salary + matchingCpuPlayer.salary;
      const newCpuSalary = cpuSalaryTotal - matchingCpuPlayer.salary + matchingUserPlayer.salary;

      if (newUserSalary > SALARY_CAP || newCpuSalary > SALARY_CAP) {
        console.log(`Rejected ${cpuTeam.name}: Salary cap exceeded (User salary: ${newUserSalary}, CPU salary: ${newCpuSalary})`);
        continue;
      }

      if (userRoster.length < MIN_ROSTER_SIZE || userRoster.length > MAX_ROSTER_SIZE) {
        console.log(`Rejected ${cpuTeam.name}: User roster size invalid (${userRoster.length})`);
        continue;
      }
      if (cpuRoster.length < MIN_ROSTER_SIZE || cpuRoster.length > MAX_ROSTER_SIZE) {
        console.log(`Rejected ${cpuTeam.name}: CPU roster size invalid (${cpuRoster.length})`);
        continue;
      }

      console.log(`SUCCESS candidate found with CPU Team ${cpuTeam.name}: CPU ${matchingCpuPlayer.firstName} ${matchingCpuPlayer.lastName} (OVR ${matchingCpuPlayer.overall}) for User ${matchingUserPlayer.firstName} ${matchingUserPlayer.lastName} (OVR ${matchingUserPlayer.overall})`);
    } else {
      console.log(`No match options found for CPU Team ${cpuTeam.name}`);
    }
  }
}

main().catch(console.error);
