import { create } from "zustand";
import { persist } from "zustand/middleware";
import { saveGameAction } from "@/app/actions/saveEngine";

interface GameState {
  userTeamId: string | null;
  currentLeagueDay: number;
  isSimulating: boolean;
  tradeDeadlinePassed: boolean;
  activeSaveSlotId: string | null;
  autoReplaceInjured: boolean;
  setTeam: (teamId: string) => void;
  advanceDay: () => void;
  setSimulating: (isSimulating: boolean) => void;
  setTradeDeadlinePassed: (passed: boolean) => void;
  setLeagueDay: (day: number) => void;
  setActiveSaveSlotId: (id: string | null) => void;
  setAutoReplaceInjured: (val: boolean) => void;
  triggerAutosave: () => Promise<void>;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      userTeamId: null,
      currentLeagueDay: 1,
      isSimulating: false,
      tradeDeadlinePassed: false,
      activeSaveSlotId: null,
      autoReplaceInjured: false,
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
      setActiveSaveSlotId: (id) => set({ activeSaveSlotId: id }),
      setAutoReplaceInjured: (val) => set({ autoReplaceInjured: val }),
      triggerAutosave: async () => {
        const { userTeamId, currentLeagueDay, activeSaveSlotId } = get();
        if (!activeSaveSlotId) {
          console.warn("[Autosave] Blocked: No active save slot configured.");
          return;
        }
        try {
          const res = await saveGameAction(null, userTeamId, currentLeagueDay, activeSaveSlotId);
          if (res.success) {
            console.log("[Autosave] Game saved to slot:", activeSaveSlotId);
          } else {
            console.error("[Autosave] Failed:", res.error);
          }
        } catch (err) {
          console.error("[Autosave] Error occurred:", err);
        }
      },
    }),
    {
      name: "filipino-basketball-manager-store",
    }
  )
);

