import { db } from "@/db";
import { teams } from "@/db/schema";
import TeamSelectorClient from "./TeamSelectorClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Query all 30 teams from NeonDB using Drizzle
  const allTeams = await db.select().from(teams).orderBy(teams.city);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-orange-500 selection:text-white relative overflow-hidden">
      {/* Background design elements */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-orange-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      <TeamSelectorClient teams={allTeams} />
    </main>
  );
}
