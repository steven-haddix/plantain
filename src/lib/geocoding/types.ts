export interface GeocodingResult {
    query: string;
    latitude: number;
    longitude: number;
    country?: string;
    state?: string;
    city?: string;
    borough?: string;
    street?: string;
    postalCode?: string;
    formattedAddress?: string;
    placeId?: string;
    timezone?: string;
}

export interface GeocodingProvider {
    geocode(query: string): Promise<GeocodingResult[]>;
    reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult[]>;
}
