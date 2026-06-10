import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is missing in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

// Culturally authentic name pools
const FILIPINO_FIRST_NAMES = [
  "Junmar", "Kiefer", "Jayson", "Thirdy", "Aldrin", "Calvin", "CJ", "Gabe",
  "Paul", "Robert", "Marc", "LA", "Chris", "Stanley", "Japeth", "Raymond",
  "Terrence", "Beau", "Alex", "Scottie", "Arwind", "Roger", "Baser", "Jio",
  "Matthew", "Von", "Kevin", "Jericho", "Shaun", "Rey", "Mark", "Vic",
  "Poy", "Troy", "Jerick", "Allein", "Mac", "Ramon", "Nonoy", "Mike"
];

const FILIPINO_SURNAMES = [
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

// Region-specific Hometowns
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

const TEAMS_DATA = [
  // LUZON CONFERENCE (15 Teams)
  { city: "Manila", name: "Metros", conference: "Luzon" as const },
  { city: "Quezon City", name: "Capitals", conference: "Luzon" as const },
  { city: "Makati", name: "Executives", conference: "Luzon" as const },
  { city: "Pasig", name: "Flow", conference: "Luzon" as const },
  { city: "Taguig", name: "Titans", conference: "Luzon" as const },
  { city: "Valenzuela", name: "Steel", conference: "Luzon" as const },
  { city: "Baguio", name: "Highlanders", conference: "Luzon" as const },
  { city: "Angeles", name: "Flight", conference: "Luzon" as const },
  { city: "Batangas", name: "Barakos", conference: "Luzon" as const },
  { city: "Legazpi", name: "Volcanoes", conference: "Luzon" as const },
  { city: "Cavite", name: "Patriots", conference: "Luzon" as const },
  { city: "Laguna", name: "Express", conference: "Luzon" as const },
  { city: "Bulacan", name: "Craftsmen", conference: "Luzon" as const },
  { city: "Pangasinan", name: "Sharks", conference: "Luzon" as const },
  { city: "Isabela", name: "Harvest", conference: "Luzon" as const },
  // VISMIN CONFERENCE (15 Teams)
  { city: "Mandaue City", name: "Marauders", conference: "VisMin" as const },
  { city: "Cebu City", name: "Navigators", conference: "VisMin" as const },
  { city: "Iloilo City", name: "Warriors", conference: "VisMin" as const },
  { city: "Bacolod", name: "Sugar Kings", conference: "VisMin" as const },
  { city: "Tacloban", name: "Valor", conference: "VisMin" as const },
  { city: "Lapu-Lapu", name: "Chieftains", conference: "VisMin" as const },
  { city: "Dumaguete", name: "Scholars", conference: "VisMin" as const },
  { city: "Tagbilaran", name: "Boomers", conference: "VisMin" as const },
  { city: "Davao City", name: "EagleClaws", conference: "VisMin" as const },
  { city: "Zamboanga City", name: "Hermosas", conference: "VisMin" as const },
  { city: "Cagayan de Oro", name: "Rapids", conference: "VisMin" as const },
  { city: "Gen. Santos City", name: "Generals", conference: "VisMin" as const },
  { city: "Butuan", name: "Balangays", conference: "VisMin" as const },
  { city: "Iligan", name: "Waterfalls", conference: "VisMin" as const },
  { city: "Cotabato City", name: "Monarchs", conference: "VisMin" as const },
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("Starting sequential database seeding process...");

  try {
    // 1. CLEAN RESET (SEQUENTIAL TRUNCATION) USING DB INSTANCE DIRECTLY
    console.log("Truncating dependent transaction tables...");

    await db.delete(schema.playerGameStats);
    console.log(" - Truncated player_game_stats");

    await db.delete(schema.games);
    console.log(" - Truncated games");

    await db.delete(schema.transactions);
    console.log(" - Truncated transactions");

    await db.delete(schema.playerAwards);
    console.log(" - Truncated player_awards");

    await db.delete(schema.allLeagueTeams);
    console.log(" - Truncated all_league_teams");

    await db.delete(schema.seasonChampions);
    console.log(" - Truncated season_champions");

    await db.delete(schema.draftPicks);
    console.log(" - Truncated draft_picks");

    console.log("Truncating core players and teams tables...");

    await db.delete(schema.players);
    console.log(" - Truncated players");

    await db.delete(schema.teams);
    console.log(" - Truncated teams");

    // 2. SEED 30 CULTURALLY AUTHENTIC TEAMS
    console.log("Inserting 30 teams with default budget (₱50,000,000)...");
    const insertedTeams = await db
      .insert(schema.teams)
      .values(
        TEAMS_DATA.map((t) => ({
          ...t,
          budget: 50000000, // 50M salary cap budget
        }))
      )
      .returning();

    console.log(`Successfully seeded ${insertedTeams.length} teams.`);

    // 2.5 SEED 2026 DRAFT PICKS FOR ALL TEAMS
    console.log("Generating 2026 draft picks...");
    const draftPicksToInsert: Array<typeof schema.draftPicks.$inferInsert> = [];
    for (const team of insertedTeams) {
      // Round 1
      draftPicksToInsert.push({
        ownerTeamId: team.id,
        originalTeamId: team.id,
        season: 2026,
        round: 1,
        pickNumber: null,
        isUsed: false,
      });
      // Round 2
      draftPicksToInsert.push({
        ownerTeamId: team.id,
        originalTeamId: team.id,
        season: 2026,
        round: 2,
        pickNumber: null,
        isUsed: false,
      });
    }
    await db.insert(schema.draftPicks).values(draftPicksToInsert);
    console.log(`Successfully seeded ${draftPicksToInsert.length} draft picks.`);

    // 3. SEED EXACTLY 15 PLAYERS PER TEAM (450 TOTAL)
    const playersToInsert: Array<typeof schema.players.$inferInsert> = [];

    for (const team of insertedTeams) {
      // Organic position distribution: 3 of each position PG, SG, SF, PF, C
      const POSITIONS_TO_ASSIGN = [
        "PG", "PG", "PG",
        "SG", "SG", "SG",
        "SF", "SF", "SF",
        "PF", "PF", "PF",
        "C", "C", "C"
      ];

      // 1 to 3 Fil-Ams per team
      const numFilAms = getRandomNumber(1, 3);
      const teamPlayers: Array<Omit<typeof schema.players.$inferInsert, "salary">> = [];

      for (let i = 0; i < 15; i++) {
        const isFilAm = i < numFilAms;
        const firstName = isFilAm
          ? getRandomElement(FILAM_FIRST_NAMES)
          : getRandomElement(FILIPINO_FIRST_NAMES);
        const lastName = isFilAm
          ? getRandomElement(FILAM_SURNAMES)
          : getRandomElement(FILIPINO_SURNAMES);

        const age = getRandomNumber(21, 36);
        const hometown =
          team.conference === "Luzon"
            ? getRandomElement(LUZON_HOMETOWNS)
            : getRandomElement(VISMIN_HOMETOWNS);
        const position = POSITIONS_TO_ASSIGN[i];

        // Randomized attributes between 55 and 90
        const threePoint = getRandomNumber(55, 90);
        const insideScoring = getRandomNumber(55, 90);
        const playmaking = getRandomNumber(55, 90);
        const perimeterDefense = getRandomNumber(55, 90);
        const interiorDefense = getRandomNumber(55, 90);
        const rebounding = getRandomNumber(55, 90);
        const speed = getRandomNumber(55, 90);
        const stamina = getRandomNumber(55, 90);

        // Calculate Overall Rating
        const overall = Math.round(
          (threePoint +
            insideScoring +
            playmaking +
            perimeterDefense +
            interiorDefense +
            rebounding +
            speed +
            stamina) /
          8
        );

        const contractYearsRemaining = getRandomElement([1, 2, 3]);

        teamPlayers.push({
          teamId: team.id,
          firstName,
          lastName,
          age,
          hometown,
          isFilAm,
          overall,
          position,
          threePoint,
          insideScoring,
          playmaking,
          perimeterDefense,
          interiorDefense,
          rebounding,
          speed,
          stamina,
          contractYearsRemaining,
          status: "Active",
          isRookie: false,
          injuryDaysRemaining: 0,
          injuryType: null,
        });
      }

      // Calculate proportionate salary based on overall rating:
      // overall 55 -> ₱1,500,000, overall 90 -> ₱4,500,000
      let salaries = teamPlayers.map((p) => {
        const baseSalary = 1500000 + ((p.overall - 55) / (90 - 55)) * (4500000 - 1500000);
        return Math.round(baseSalary / 10000) * 10000; // Round to nearest 10k PHP
      });

      // Enforce hard salary cap limit of ₱50,000,000 per team.
      // We target an average team salary of ₱45,000,000 to keep it realistic and safe.
      const totalTeamSalary = salaries.reduce((sum, s) => sum + s, 0);
      if (totalTeamSalary > 46000000) {
        const factor = 46000000 / totalTeamSalary;
        salaries = salaries.map((s) => Math.round((s * factor) / 10000) * 10000);
      }

      // Attach final compliant salaries and push to array
      for (let i = 0; i < 15; i++) {
        playersToInsert.push({
          ...teamPlayers[i],
          salary: salaries[i],
        });
      }
    }

    console.log(`Generated exactly 15 players per team (Total: ${playersToInsert.length} roster players).`);

    // 4. SEED 50 COMPLIANT FREE AGENTS (for functional trade / signing market)
    console.log("Generating 50 free agents...");
    const FA_POSITIONS = ["PG", "SG", "SF", "PF", "C"];
    for (let i = 0; i < 50; i++) {
      const isFilAm = Math.random() < 0.2; // 20% Fil-Ams
      const firstName = isFilAm
        ? getRandomElement(FILAM_FIRST_NAMES)
        : getRandomElement(FILIPINO_FIRST_NAMES);
      const lastName = isFilAm
        ? getRandomElement(FILAM_SURNAMES)
        : getRandomElement(FILIPINO_SURNAMES);

      const age = getRandomNumber(20, 36);
      const hometown =
        Math.random() < 0.5
          ? getRandomElement(LUZON_HOMETOWNS)
          : getRandomElement(VISMIN_HOMETOWNS);
      const position = getRandomElement(FA_POSITIONS);

      const threePoint = getRandomNumber(55, 90);
      const insideScoring = getRandomNumber(55, 90);
      const playmaking = getRandomNumber(55, 90);
      const perimeterDefense = getRandomNumber(55, 90);
      const interiorDefense = getRandomNumber(55, 90);
      const rebounding = getRandomNumber(55, 90);
      const speed = getRandomNumber(55, 90);
      const stamina = getRandomNumber(55, 90);

      const overall = Math.round(
        (threePoint +
          insideScoring +
          playmaking +
          perimeterDefense +
          interiorDefense +
          rebounding +
          speed +
          stamina) /
        8
      );

      const salary = Math.round((1500000 + ((overall - 55) / (90 - 55)) * (4500000 - 1500000)) / 10000) * 10000;
      const contractYearsRemaining = getRandomElement([1, 2, 3]);

      playersToInsert.push({
        teamId: null, // Free Agent
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
        contractYearsRemaining,
        status: "Active",
        isRookie: false,
        injuryDaysRemaining: 0,
        injuryType: null,
      });
    }

    // Batch insert players in chunks of 50 to prevent packet payload limit errors
    console.log(`Seeding all ${playersToInsert.length} players into the database sequentially...`);
    const chunkSize = 50;
    for (let i = 0; i < playersToInsert.length; i += chunkSize) {
      const chunk = playersToInsert.slice(i, i + chunkSize);
      await db.insert(schema.players).values(chunk);
    }

    console.log("Database seeding completed successfully! All tables ready.");
  } catch (error) {
    console.error("Database seeding process failed:", error);
    process.exit(1);
  }
}

main();
