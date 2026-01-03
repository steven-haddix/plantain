import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface Trip {
  id: string;
  title: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface AppState {
  activeTrip: Trip | null;
  setActiveTrip: (trip: Trip | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTrip: null,
      setActiveTrip: (trip) => set({ activeTrip: trip }),
    }),
    {
      name: "plantain-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
