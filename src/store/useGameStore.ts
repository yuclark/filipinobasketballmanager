import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GameState {
  userTeamId: string | null;
  currentLeagueDay: number;
  isSimulating: boolean;
  tradeDeadlinePassed: boolean;
  setTeam: (teamId: string) => void;
  advanceDay: () => void;
  setSimulating: (isSimulating: boolean) => void;
  setTradeDeadlinePassed: (passed: boolean) => void;
  setLeagueDay: (day: number) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      userTeamId: null,
      currentLeagueDay: 1,
      isSimulating: false,
      tradeDeadlinePassed: false,
      setTeam: (teamId) => set({ userTeamId: teamId }),
      advanceDay: () =>
        set((state) => {
          const nextDay = state.currentLeagueDay + 1;
          return {
            currentLeagueDay: nextDay,
            tradeDeadlinePassed: nextDay > 50,
          };
        }),
      setSimulating: (isSimulating) => set({ isSimulating }),
      setTradeDeadlinePassed: (passed) => set({ tradeDeadlinePassed: passed }),
      setLeagueDay: (day) => set({ currentLeagueDay: day, tradeDeadlinePassed: day > 50 }),
    }),
    {
      name: "filipino-basketball-manager-store",
    }
  )
);
