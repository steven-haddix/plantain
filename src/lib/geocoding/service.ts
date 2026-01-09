import { PLACES_CACHE_TTL } from "@/lib/constants";
import { redisCacheService as redis } from "@/lib/redis";
import { OutscraperGeocodingProvider } from "./providers/outscraper";
import type { GeocodingProvider, GeocodingResult } from "./types";

export class GeocodingService {
    private provider: GeocodingProvider;

    constructor(provider?: GeocodingProvider) {
        this.provider = provider || new OutscraperGeocodingProvider();
    }

    /**
     * Geocode an address to get coordinates and details
     */
    async geocode(query: string): Promise<GeocodingResult[]> {
        const cacheKey = `geocoding:v1:search:${query}`;

        return redis.cacheWrapper(
            cacheKey,
            () => this.provider.geocode(query),
            PLACES_CACHE_TTL
        );
    }

    /**
     * Reverse geocode coordinates to get address details
     */
    async reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult[]> {
        const cacheKey = `geocoding:v1:reverse:${latitude}:${longitude}`;

        return redis.cacheWrapper(
            cacheKey,
            () => this.provider.reverseGeocode(latitude, longitude),
            PLACES_CACHE_TTL
        );
    }
}

export const geocodingService = new GeocodingService();
export * from "./types";
