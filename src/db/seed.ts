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

// Name Pools
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

// Region-specific Hotspots
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
  // LUZON CONFERENCE
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
  // VISMIN CONFERENCE
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
  console.log("Starting database seeding process...");

  try {
    // 1. Clean up existing data (players deleted cascade via team delete)
    console.log("Cleaning up old database entries...");
    await db.delete(schema.teams);
    console.log("Database cleaned.");

    // 2. Insert Teams
    console.log("Inserting 30 teams...");
    const insertedTeams = await db
      .insert(schema.teams)
      .values(TEAMS_DATA)
      .returning();

    console.log(`Successfully inserted ${insertedTeams.length} teams.`);

    // 3. Generate 15 Players for each Team
    const playersToInsert: Array<typeof schema.players.$inferInsert> = [];

    for (const team of insertedTeams) {
      // Determine number of Fil-Ams: random between 1 and 3
      const numFilAms = getRandomNumber(1, 3);

      for (let i = 0; i < 15; i++) {
        const isFilAm = i < numFilAms;

        // Names selection
        const firstName = isFilAm
          ? getRandomElement(FILAM_FIRST_NAMES)
          : getRandomElement(FILIPINO_FIRST_NAMES);
        const lastName = isFilAm
          ? getRandomElement(FILAM_SURNAMES)
          : getRandomElement(FILIPINO_SURNAMES);

        // Demographics
        const age = getRandomNumber(19, 38);
        const hometown =
          team.conference === "Luzon"
            ? getRandomElement(LUZON_HOMETOWNS)
            : getRandomElement(VISMIN_HOMETOWNS);

        // Attributes (50 to 99)
        const threePoint = getRandomNumber(50, 99);
        const insideScoring = getRandomNumber(50, 99);
        const playmaking = getRandomNumber(50, 99);
        const perimeterDefense = getRandomNumber(50, 99);
        const interiorDefense = getRandomNumber(50, 99);
        const rebounding = getRandomNumber(50, 99);
        const speed = getRandomNumber(50, 99);
        const stamina = getRandomNumber(50, 99);

        // Calculate Overall
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

        playersToInsert.push({
          teamId: team.id,
          firstName,
          lastName,
          age,
          hometown,
          isFilAm,
          overall,
          threePoint,
          insideScoring,
          playmaking,
          perimeterDefense,
          interiorDefense,
          rebounding,
          speed,
          stamina,
        });
      }
    }

    // 4. Batch Insert Players
    console.log(`Generating and inserting ${playersToInsert.length} players...`);
    // Batch in chunks to prevent database payload limits
    const chunkSize = 100;
    for (let i = 0; i < playersToInsert.length; i += chunkSize) {
      const chunk = playersToInsert.slice(i, i + chunkSize);
      await db.insert(schema.players).values(chunk);
    }

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Seeding failed with error:", error);
    process.exit(1);
  }
}

main();
