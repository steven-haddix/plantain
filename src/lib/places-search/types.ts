export interface PlacePhoto {
    id: string;
    url: string;
    urlLarge?: string;
    width?: number;
    height?: number;
}

export interface PlaceReview {
    id: string;
    author: string;
    rating: number;
    text: string;
    relativeTime: string;
    timestamp: number;
}

export interface Place {
    id?: string;
    googlePlaceId: string;
    name: string;
    address: string;
    city?: string;
    state?: string;
    latitude: number;
    longitude: number;
    rating?: number;
    reviewsCount?: number;
    priceLevel?: number;
    type?: string;
    category?: string;
    subtypes?: string[];
    website?: string;
    phone?: string;
    hours?: Record<string, string>;
    photos?: PlacePhoto[];
    reviews?: PlaceReview[];
    details?: Record<string, any>;
}

export interface PlacesSearchProvider {
    search(
        query: string,
        location?: string,
        limit?: number,
        region?: string,
    ): Promise<Place[]>;
    getDetails(id: string): Promise<Place | null>;
    getReviews(id: string, limit?: number): Promise<PlaceReview[]>;
    getPhotos(id: string, limit?: number): Promise<PlacePhoto[]>;
}
