import { PLACES_CACHE_TTL } from "@/lib/constants";
import { redisCacheService as redis } from "@/lib/redis";
import { OutscraperProvider } from "./providers/outscraper/index";
import type { Place, PlacePhoto, PlaceReview, PlacesSearchProvider } from "./types";

export class PlacesSearchService {
    private provider: PlacesSearchProvider;

    constructor(provider?: PlacesSearchProvider) {
        // Default to Outscraper for now
        this.provider = provider || new OutscraperProvider();
    }

    /**
     * Search for places using the active provider
     */
    async searchPlaces(
        query: string,
        location?: string,
        limit = 10,
        region?: string,
    ): Promise<Place[]> {
        const searchQuery = location ? `${query}, ${location}` : query;
        const cacheKey = `places:v1:search:${searchQuery}:${limit}:${region || "us"}`;

        return redis.cacheWrapper(
            cacheKey,
            () => this.provider.search(query, location, limit, region),
            PLACES_CACHE_TTL,
        );
    }

    /**
     * Get full details for a place by its ID
     */
    async getPlaceDetails(id: string): Promise<Place | null> {
        const cacheKey = `places:v1:details:${id}`;

        return redis.cacheWrapper(
            cacheKey,
            () => this.provider.getDetails(id),
            PLACES_CACHE_TTL,
        );
    }

    /**
     * Get reviews for a place
     */
    async getPlaceReviews(
        id: string,
        limit = 10,
    ): Promise<PlaceReview[]> {
        const cacheKey = `places:v1:reviews:${id}:${limit}`;

        return redis.cacheWrapper(
            cacheKey,
            () => this.provider.getReviews(id, limit),
            PLACES_CACHE_TTL,
        );
    }

    /**
     * Get photos for a place
     */
    async getPlacePhotos(
        id: string,
        limit = 10,
    ): Promise<PlacePhoto[]> {
        const cacheKey = `places:v1:photos:${id}:${limit}`;

        return redis.cacheWrapper(
            cacheKey,
            () => this.provider.getPhotos(id, limit),
            PLACES_CACHE_TTL,
        );
    }
}

export const placesService = new PlacesSearchService();
export * from "./types";
