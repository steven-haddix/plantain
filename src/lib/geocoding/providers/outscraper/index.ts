import Outscraper from "outscraper";
import type { GeocodingProvider, GeocodingResult } from "../../types";
import * as adapter from "./adapter";

export class OutscraperGeocodingProvider implements GeocodingProvider {
    private client: Outscraper;
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.OUTSCRAPER_API_KEY || "";
        this.client = new Outscraper(this.apiKey);
    }

    async geocode(query: string): Promise<GeocodingResult[]> {
        const response = await this.client.geocoding(query);
        return response.map(adapter.mapGeocodingResult);
    }

    async reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult[]> {
        const query = `${latitude},${longitude}`;
        const response = await this.client.reverseGeocoding(query);
        return response.map(adapter.mapGeocodingResult);
    }
}
