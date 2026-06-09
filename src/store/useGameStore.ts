import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GameState {
  userTeamId: string | null;
  setTeam: (teamId: string) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      userTeamId: null,
      setTeam: (teamId) => set({ userTeamId: teamId }),
    }),
    {
      name: "filipino-basketball-manager-store",
    }
  )
);
