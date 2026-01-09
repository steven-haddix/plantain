import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ChatMessage } from "@/db/schema";

interface Trip {
  id: string;
  title: string | null;
  startDate: string | null;
  endDate: string | null;
  destinationLocation?: { latitude: number; longitude: number } | null;
  chatMessages?: ChatMessage[];
  hasMoreMessages?: boolean;
}

interface AppState {
  activeTrip: Trip | null;
  setActiveTrip: (trip: Trip | null) => void;
  prependMessages: (
    tripId: string,
    messages: ChatMessage[],
    hasMore: boolean,
  ) => void;
  clearMessages: (tripId: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTrip: null,
      setActiveTrip: (trip) => set({ activeTrip: trip }),
      prependMessages: (tripId, messages, hasMore) =>
        set((state) => {
          if (state.activeTrip?.id !== tripId) return state;
          return {
            activeTrip: {
              ...state.activeTrip,
              chatMessages: [
                ...messages,
                ...(state.activeTrip.chatMessages || []),
              ],
              hasMoreMessages: hasMore,
            },
          };
        }),
      clearMessages: (tripId) =>
        set((state) => {
          if (state.activeTrip?.id !== tripId) return state;
          return {
            activeTrip: {
              ...state.activeTrip,
              chatMessages: [],
              hasMoreMessages: false,
            },
          };
        }),
    }),
    {
      name: "plantain-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
