import type { OutscraperGeocodingResponse } from "outscraper";
import type { GeocodingResult } from "../../types";

export function mapGeocodingResult(
    source: OutscraperGeocodingResponse
): GeocodingResult {
    return {
        query: source.query,
        latitude: source.latitude,
        longitude: source.longitude,
        country: source.country,
        state: source.state,
        city: source.city,
        borough: source.borough,
        street: source.street,
        postalCode: source.postal_code,
        formattedAddress: source.formatted_address || `${source.street}, ${source.city}, ${source.state} ${source.postal_code}, ${source.country}`,
        placeId: source.place_id,
        timezone: source.time_zone,
    };
}
