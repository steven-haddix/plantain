export type HotelProviderId = "airbnb" | "hotels_com" | "google_hotels";

export type HotelLocationPrecision =
  | "exact"
  | "geocoded"
  | "centroid"
  | "unknown";

export type HotelSearchInput = {
  locations: string | string[];
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  providers?: HotelProviderId[];
  limitPerProvider?: number;
  currency?: string;
  language?: string;
  region?: string;
};

export type HotelSearchInputNormalized = {
  locations: string[];
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  providers: HotelProviderId[];
  limitPerProvider: number;
  currency: string;
  language: string;
  region: string;
};

export type HotelResult = {
  canonicalId: string;
  provider: HotelProviderId;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewsCount?: number;
  priceText?: string;
  imageUrl?: string;
  imageUrls?: string[];
  url?: string;
  category: "hotel";
  locationPrecision: HotelLocationPrecision;
  metadata?: Record<string, unknown>;
};

export type HotelSearchWarning = {
  provider?: HotelProviderId;
  location?: string;
  code:
    | "provider_failed"
    | "provider_unavailable"
    | "unmappable"
    | "invalid_input"
    | "out_of_area_filtered";
  message: string;
};

export type HotelSearchProviderResult = {
  provider: HotelProviderId;
  results: HotelResult[];
  warnings?: HotelSearchWarning[];
};

export type HotelSearchResponse = {
  results: HotelResult[];
  warnings: HotelSearchWarning[];
};

export interface HotelSearchProvider {
  id: HotelProviderId;
  search(input: HotelSearchInputNormalized): Promise<HotelSearchProviderResult>;
}
