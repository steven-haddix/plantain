import { create } from "zustand";

export type MapPlace = {
    googlePlaceId: string;
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
    rating?: number;
    reviewsCount?: number;
    category?: string;
    imageUrl?: string;
};

type ResearchLayer = {
    id: string;
    title: string;
    places: MapPlace[];
    createdAt: number;
};

type MapState = {
    activeResearch?: ResearchLayer;
    pinnedResearch: ResearchLayer[];
    selectedPlaceId?: string;
    appliedToolKeys: Record<string, true>;
    applySearchResults: (args: {
        toolKey: string;
        title: string;
        places: MapPlace[];
    }) => void;
    pinActiveResearch: () => void;
    clearResearch: () => void;
    selectPlace: (googlePlaceId?: string) => void;
};

export const useMapStore = create<MapState>((set, get) => ({
    pinnedResearch: [],
    appliedToolKeys: {},

    applySearchResults: ({ toolKey, title, places }) => {
        const { appliedToolKeys } = get();
        if (appliedToolKeys[toolKey]) return;

        set({
            activeResearch: {
                id: toolKey,
                title,
                places,
                createdAt: Date.now(),
            },
            appliedToolKeys: { ...appliedToolKeys, [toolKey]: true },
        });
    },

    pinActiveResearch: () => {
        const active = get().activeResearch;
        if (!active) return;

        set((state) => {
            const alreadyPinned = state.pinnedResearch.some(
                (layer) => layer.id === active.id,
            );
            if (alreadyPinned) return state;
            return {
                pinnedResearch: [active, ...state.pinnedResearch].slice(0, 6),
            };
        });
    },

    clearResearch: () => set({ activeResearch: undefined, pinnedResearch: [] }),

    selectPlace: (googlePlaceId) => set({ selectedPlaceId: googlePlaceId }),
}));
