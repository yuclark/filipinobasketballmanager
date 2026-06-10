import { db } from "@/db";
import { teams } from "@/db/schema";
import Link from "next/link";
import { Shield, ChevronRight, Globe } from "lucide-react";

export const revalidate = 0;

export default async function TeamsDirectoryPage() {
  const allTeams = await db.select().from(teams);

  const luzonTeams = allTeams
    .filter((t) => t.conference === "Luzon")
    .sort((a, b) => a.city.localeCompare(b.city));

  const visMinTeams = allTeams
    .filter((t) => t.conference === "VisMin")
    .sort((a, b) => a.city.localeCompare(b.city));

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-zinc-900 to-zinc-900/30 border border-zinc-900 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Globe className="w-48 h-48 text-white" />
        </div>
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-orange-500/10 rounded-2xl text-orange-500">
            <Globe className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">FBM League Explorer</h3>
            <p className="text-zinc-500 text-sm font-semibold tracking-wide">
              Inspect any of the 30 active Luzon and VisMin conference teams, their rosters, attributes, and stats.
            </p>
          </div>
        </div>
      </div>

      {/* Conference Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* LUZON CONFERENCE (North) */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider px-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-500" />
            Luzon Conference (North)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {luzonTeams.map((team) => (
              <div
                key={team.id}
                className="bg-zinc-900/30 border border-zinc-900/60 rounded-2xl p-5 hover:border-red-500/30 shadow-md transition-all group hover:scale-[1.01] hover:bg-red-500/5 flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/25 rounded-md font-bold uppercase tracking-wider">
                    Luzon
                  </span>
                  <h5 className="text-lg font-bold text-white mt-3 leading-tight">{team.city}</h5>
                  <p className="text-zinc-400 font-extrabold text-sm">{team.name}</p>
                </div>
                <div className="mt-5 pt-3 border-t border-zinc-950 flex justify-end">
                  <Link
                    href={`/dashboard/teams/${team.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl font-bold text-xs group-hover:text-red-400 transition-colors"
                  >
                    <span>View Roster</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* VISMIN CONFERENCE (South) */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-wider px-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-500" />
            VisMin Conference (South)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visMinTeams.map((team) => (
              <div
                key={team.id}
                className="bg-zinc-900/30 border border-zinc-900/60 rounded-2xl p-5 hover:border-cyan-500/30 shadow-md transition-all group hover:scale-[1.01] hover:bg-cyan-500/5 flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] px-2 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 rounded-md font-bold uppercase tracking-wider">
                    VisMin
                  </span>
                  <h5 className="text-lg font-bold text-white mt-3 leading-tight">{team.city}</h5>
                  <p className="text-zinc-400 font-extrabold text-sm">{team.name}</p>
                </div>
                <div className="mt-5 pt-3 border-t border-zinc-950 flex justify-end">
                  <Link
                    href={`/dashboard/teams/${team.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl font-bold text-xs group-hover:text-cyan-400 transition-colors"
                  >
                    <span>View Roster</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
