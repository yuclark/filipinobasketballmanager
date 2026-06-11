import React from "react";
import { getTeamRoster } from "@/app/actions";
import { getTeamSeasonStatsAction } from "@/app/actions/statsEngine";
import CPUTeamRosterClient from "./CPUTeamRosterClient";
import Link from "next/link";

interface PageProps {
  params: {
    teamId: string;
  };
}

export default async function CPUTeamRosterPage({ params }: PageProps) {
  // Await the params promise safely to support Next.js 15+ runtime async params
  const resolvedParams = await (params as any);
  const teamId = resolvedParams.teamId;

  if (!teamId) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p className="mb-4">No franchise selected.</p>
        <Link
          href="/dashboard/teams"
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-semibold hover:text-white transition-colors"
        >
          Back to Directory
        </Link>
      </div>
    );
  }

  const rosterData = await getTeamRoster(teamId);

  if (!rosterData || !rosterData.team) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p className="mb-4">Franchise not found.</p>
        <Link
          href="/dashboard/teams"
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-semibold hover:text-white transition-colors"
        >
          Back to Directory
        </Link>
      </div>
    );
  }

  const statsRes = await getTeamSeasonStatsAction(teamId);
  const statsData =
    statsRes.success && statsRes.regularSeason && statsRes.playoffs && statsRes.career
      ? {
          regularSeason: statsRes.regularSeason,
          playoffs: statsRes.playoffs,
          career: statsRes.career,
        }
      : null;

  return (
    <CPUTeamRosterClient
      team={rosterData.team as any}
      players={rosterData.players as any}
      stats={statsData}
    />
  );
}
