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
    accumulatedSearchPlaces: MapPlace[];
    selectedPlaceId?: string;
    appliedToolKeys: Record<string, true>;
    applySearchResults: (args: {
        toolKey: string;
        title: string;
        places: MapPlace[];
    }) => void;
    pinActiveResearch: () => void;
    clearResearch: () => void;
    clearAllSearchResults: () => void;
    selectPlace: (googlePlaceId?: string) => void;
};

export const useMapStore = create<MapState>((set, get) => ({
    pinnedResearch: [],
    accumulatedSearchPlaces: [],
    appliedToolKeys: {},

    applySearchResults: ({ toolKey, title, places }) => {
        const { appliedToolKeys, accumulatedSearchPlaces } = get();
        if (appliedToolKeys[toolKey]) return;

        // Accumulate new places without duplicates
        const existingIds = new Set(accumulatedSearchPlaces.map((p) => p.googlePlaceId));
        const newPlaces = places.filter((p) => !existingIds.has(p.googlePlaceId));

        set({
            activeResearch: {
                id: toolKey,
                title,
                places,
                createdAt: Date.now(),
            },
            accumulatedSearchPlaces: [...accumulatedSearchPlaces, ...newPlaces],
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

    clearAllSearchResults: () =>
        set({
            accumulatedSearchPlaces: [],
            appliedToolKeys: {},
            activeResearch: undefined,
        }),

    selectPlace: (googlePlaceId) => set({ selectedPlaceId: googlePlaceId }),
}));
