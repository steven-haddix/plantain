import Outscraper from "outscraper";
import type { Place, PlacePhoto, PlaceReview, PlacesSearchProvider } from "../../types";
import * as adapter from "./adapter";

export class OutscraperProvider implements PlacesSearchProvider {
    private client: Outscraper;
    private apiKey: string;
    private baseUrl = "https://api.app.outscraper.com";

    constructor() {
        this.apiKey = process.env.OUTSCRAPER_API_KEY || "";
        this.client = new Outscraper(this.apiKey);
    }

    async search(
        query: string,
        location?: string,
        limit = 10,
        region = "us",
    ): Promise<Place[]> {
        const searchQuery = location ? `${query}, ${location}` : query;
        const response = await this.client.googleMapsSearchV3(
            searchQuery,
            limit,
            "en",
            null,
            0,
            false,
            null,
            false,
        );

        console.debug("OutscraperProvider search response:", response);

        const rawPlaces = adapter.extractPlaces(response);
        return rawPlaces.map(adapter.mapPlace);
    }

    async getDetails(id: string): Promise<Place | null> {
        const response = await this.client.googleMapsSearchV3(
            id,
            1,
            "en",
            undefined,
            0,
            false,
            null,
            false,
        );

        const rawPlaces = adapter.extractPlaces(response);
        if (rawPlaces.length === 0) return null;

        return adapter.mapPlace(rawPlaces[0]);
    }

    async getReviews(id: string, limit = 10): Promise<PlaceReview[]> {
        const response = await this.client.googleMapsReviews([id], limit, "en");

        if (
            Array.isArray(response) &&
            response.length > 0 &&
            response[0]?.reviews
        ) {
            return response[0].reviews.map(adapter.mapReview);
        }

        return [];
    }

    async getPhotos(id: string, limit = 10): Promise<PlacePhoto[]> {
        const queryParams = new URLSearchParams({
            query: id,
            photosLimit: limit.toString(),
            async: "false",
        });

        const response = await fetch(
            `${this.baseUrl}/google-maps-photos?${queryParams.toString()}`,
            {
                method: "GET",
                headers: {
                    "X-API-KEY": this.apiKey,
                    Accept: "application/json",
                },
            },
        );

        if (!response.ok) return [];

        const data = await response.json();
        const results = data.data;

        if (!Array.isArray(results) || results.length === 0) return [];

        const firstResult = Array.isArray(results[0]) ? results[0][0] : results[0];
        if (!firstResult || !Array.isArray(firstResult.photos_data)) return [];

        return firstResult.photos_data.map(adapter.mapPhoto);
    }
}
