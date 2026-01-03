import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AppState {
  activeTripId: string | null;
  setActiveTripId: (id: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTripId: null,
      setActiveTripId: (id) => set({ activeTripId: id }),
    }),
    {
      name: "plantain-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
