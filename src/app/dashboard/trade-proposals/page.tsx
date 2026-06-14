"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useGameStore } from "@/store/useGameStore";
import {
  getTradeProposalsAction,
  acceptTradeProposalAction,
  rejectTradeProposalAction,
} from "@/app/actions/tradeEngine";
import { getTeamRoster } from "@/app/actions";
import {
  RefreshCw,
  Loader2,
  Check,
  X,
  AlertCircle,
  TrendingUp,
  Coins,
  Shield,
  ArrowRightLeft,
} from "lucide-react";
import React from "react";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  overall: number;
  position: string;
  salary: number;
}

interface Proposal {
  id: string;
  seasonYear: number;
  proposerTeamId: string;
  receiverTeamId: string;
  outgoingPlayerIds: string[];
  incomingPlayerIds: string[];
  status: string;
  createdAt: Date;
  expiresAt: Date;
  proposerName: string;
  proposerCity: string;
  outgoingPlayers: Player[];
  incomingPlayers: Player[];
}

export default function TradeProposalsPage() {
  const router = useRouter();
  const { userTeamId } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [userRoster, setUserRoster] = useState<Player[]>([]);
  const [userTeam, setUserTeam] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadProposals = async () => {
    if (!userTeamId) return;
    try {
      setLoading(true);
      setError(null);

      const [propRes, rosterRes] = await Promise.all([
        getTradeProposalsAction(userTeamId),
        getTeamRoster(userTeamId),
      ]);

      if (propRes.success && propRes.proposals) {
        setProposals(propRes.proposals as unknown as Proposal[]);
      } else {
        setError(propRes.error || "Failed to load proposals.");
      }

      if (rosterRes) {
        setUserRoster(rosterRes.players as Player[]);
        setUserTeam(rosterRes.team);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted && userTeamId) {
      loadProposals();
    }
  }, [mounted, userTeamId]);

  const handleAccept = async (proposalId: string) => {
    try {
      setProcessingId(proposalId);
      setError(null);
      setSuccessMsg(null);
      const res = await acceptTradeProposalAction(proposalId);
      if (res.success) {
        setSuccessMsg("Trade accepted! Rosters have been updated.");
        await loadProposals();
        router.refresh();
      } else {
        setError(res.error || "Failed to accept trade.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process transaction.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (proposalId: string) => {
    try {
      setProcessingId(proposalId);
      setError(null);
      setSuccessMsg(null);
      const res = await rejectTradeProposalAction(proposalId);
      if (res.success) {
        setSuccessMsg("Proposal rejected and removed.");
        await loadProposals();
      } else {
        setError(res.error || "Failed to reject proposal.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process rejection.");
    } finally {
      setProcessingId(null);
    }
  };

  const formatPHP = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!mounted || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-zinc-500 text-sm font-semibold">Scanning for front office proposals...</p>
      </div>
    );
  }

  const userRosterCount = userRoster.length;
  const userSalaryTotal = userRoster.reduce((sum, p) => sum + p.salary, 0);
  const SALARY_CAP = 50000000;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-orange-500/10 rounded-2xl text-orange-500">
            <ArrowRightLeft className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">Incoming Trade Proposals</h3>
            <p className="text-zinc-500 text-sm font-semibold tracking-wide">
              Review and negotiate trade packages submitted by other CPU front offices
            </p>
          </div>
        </div>

        <button
          onClick={loadProposals}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-950 border border-zinc-900 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {successMsg && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 font-semibold flex items-center justify-between">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 font-semibold flex items-center justify-between">
          <span>✕ {error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {proposals.length === 0 ? (
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-900 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-2xl">
          <ArrowRightLeft className="w-12 h-12 text-zinc-700 mx-auto mb-4 animate-pulse" />
          <h4 className="text-lg font-bold text-zinc-200">No Pending Proposals</h4>
          <p className="text-zinc-500 text-xs mt-2 max-w-xs mx-auto">
            CPU franchises are currently satisfied with their rosters. Continue simulating season games to trigger new proposal scans.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {proposals.map((prop) => {
            // Outgoing are the CPU's players in the trade, i.e., what WE receive
            const receivedPlayers = prop.outgoingPlayers;
            // Incoming are OUR players in the trade, i.e., what WE send away
            const tradedPlayers = prop.incomingPlayers;

            const receivedSalary = receivedPlayers.reduce((sum, p) => sum + p.salary, 0);
            const tradedSalary = tradedPlayers.reduce((sum, p) => sum + p.salary, 0);
            const salaryChange = receivedSalary - tradedSalary;

            const nextSalary = userSalaryTotal + salaryChange;
            const isCapCompliant = nextSalary <= SALARY_CAP;

            const receivedCount = receivedPlayers.length;
            const tradedCount = tradedPlayers.length;
            const rosterChange = receivedCount - tradedCount;
            const nextRosterCount = userRosterCount + rosterChange;
            const isRosterCompliant = nextRosterCount >= 12 && nextRosterCount <= 18;

            return (
              <div
                key={prop.id}
                className="bg-zinc-900/30 border border-zinc-900 hover:border-zinc-800 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col gap-6"
              >
                {/* Header Card info */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-900 pb-4 gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                      <Shield className="w-5 h-5 animate-pulse" />
                    </span>
                    <div>
                      <h4 className="font-extrabold text-white text-base leading-tight">
                        Proposal from the {prop.proposerCity} {prop.proposerName}
                      </h4>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mt-1">
                        Season {prop.seasonYear} · Expires in 24 hrs
                      </span>
                    </div>
                  </div>

                  {/* Actions Buttons */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => handleAccept(prop.id)}
                      disabled={processingId !== null || !isCapCompliant || !isRosterCompliant}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-xs shadow-md transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-30 disabled:scale-100"
                    >
                      {processingId === prop.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Accept Deal</span>
                    </button>
                    <button
                      onClick={() => handleReject(prop.id)}
                      disabled={processingId !== null}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-950 border border-zinc-900 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-xl font-bold text-xs transition-all cursor-pointer disabled:opacity-30"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>

                {/* Swapping panels side-by-side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column: CPU Sends (What we receive) */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs font-bold uppercase text-zinc-500 border-b border-zinc-900 pb-2">
                      <span>Incoming Assets (Received)</span>
                      <span className="text-orange-500">{prop.proposerName} Sends</span>
                    </div>
                    <div className="space-y-3">
                      {receivedPlayers.map((player) => (
                        <div
                          key={player.id}
                          className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-4 flex justify-between items-center"
                        >
                          <div>
                            <span className="text-[9px] font-bold bg-orange-550/10 text-orange-500 px-1.5 py-0.5 rounded border border-orange-500/10 uppercase mr-2">
                              OVR {player.overall}
                            </span>
                            <span className="text-xs font-extrabold text-zinc-300">
                              {player.position}
                            </span>
                            <Link href={`/dashboard/players/${player.id}`} className="font-bold text-white text-sm mt-1 hover:text-orange-400 block transition-colors">
                              {player.firstName} {player.lastName}
                            </Link>
                            <span className="text-[10px] text-zinc-500 font-semibold block mt-0.5">
                              Age {player.age}
                            </span>
                          </div>
                          <span className="text-xs font-extrabold text-white">
                            {formatPHP(player.salary)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: User Sends (What we give away) */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs font-bold uppercase text-zinc-500 border-b border-zinc-900 pb-2">
                      <span>Outgoing Assets (Traded Away)</span>
                      <span className="text-amber-500">Your Team Sends</span>
                    </div>
                    <div className="space-y-3">
                      {tradedPlayers.map((player) => (
                        <div
                          key={player.id}
                          className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-4 flex justify-between items-center"
                        >
                          <div>
                            <span className="text-[9px] font-bold bg-amber-550/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/10 uppercase mr-2">
                              OVR {player.overall}
                            </span>
                            <span className="text-xs font-extrabold text-zinc-300">
                              {player.position}
                            </span>
                            <Link href={`/dashboard/players/${player.id}`} className="font-bold text-white text-sm mt-1 hover:text-orange-400 block transition-colors">
                              {player.firstName} {player.lastName}
                            </Link>
                            <span className="text-[10px] text-zinc-500 font-semibold block mt-0.5">
                              Age {player.age}
                            </span>
                          </div>
                          <span className="text-xs font-extrabold text-white">
                            {formatPHP(player.salary)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Financial and Roster Impact analysis */}
                <div className="bg-zinc-950/80 border border-zinc-900 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                  {/* Cap space check */}
                  <div className="space-y-2">
                    <span className="text-zinc-500 font-bold uppercase tracking-wider block">Salary Cap Impact</span>
                    <div className="flex items-center gap-2.5">
                      <Coins className="w-5 h-5 text-amber-500" />
                      <div>
                        <span className="text-white font-extrabold block">
                          {formatPHP(nextSalary)}
                        </span>
                        <span className={`text-[10px] font-bold uppercase ${salaryChange >= 0 ? "text-red-400" : "text-green-400"}`}>
                          {salaryChange >= 0 ? "+" : ""}{formatPHP(salaryChange)} yr
                        </span>
                      </div>
                    </div>
                    {!isCapCompliant && (
                      <span className="text-[10px] text-red-400 font-bold block mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Exceeds ₱50M Salary Cap
                      </span>
                    )}
                  </div>

                  {/* Roster bounds check */}
                  <div className="space-y-2">
                    <span className="text-zinc-500 font-bold uppercase tracking-wider block">Roster Spots</span>
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-5 h-5 text-blue-500" />
                      <div>
                        <span className="text-white font-extrabold block">
                          {nextRosterCount} Players
                        </span>
                        <span className="text-[10px] text-zinc-500 font-semibold block mt-0.5">
                          Limit: 12 min / 18 max
                        </span>
                      </div>
                    </div>
                    {!isRosterCompliant && (
                      <span className="text-[10px] text-red-400 font-bold block mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Violates 12-18 limit
                      </span>
                    )}
                  </div>

                  {/* Proximity evaluation */}
                  <div className="space-y-2">
                    <span className="text-zinc-500 font-bold uppercase tracking-wider block">Value Proximity</span>
                    <div className="flex items-center gap-2.5">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      <div>
                        <span className="text-white font-extrabold block">
                          CPU: {receivedPlayers.reduce((sum, p) => sum + p.overall, 0)} OVR total
                        </span>
                        <span className="text-[10px] text-zinc-400 font-semibold block mt-0.5">
                          You: {tradedPlayers.reduce((sum, p) => sum + p.overall, 0)} OVR total
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
