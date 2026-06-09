import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GameState {
  userTeamId: string | null;
  currentLeagueDay: number;
  isSimulating: boolean;
  setTeam: (teamId: string) => void;
  advanceDay: () => void;
  setSimulating: (isSimulating: boolean) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      userTeamId: null,
      currentLeagueDay: 1,
      isSimulating: false,
      setTeam: (teamId) => set({ userTeamId: teamId }),
      advanceDay: () => set((state) => ({ currentLeagueDay: state.currentLeagueDay + 1 })),
      setSimulating: (isSimulating) => set({ isSimulating }),
    }),
    {
      name: "filipino-basketball-manager-store",
    }
  )
);
