export type PlacePhoto = {
  id: string;
  url: string;
  urlLarge?: string;
};

export type PlaceDetails = {
  name?: string;
  category?: string;
  rating?: number;
  reviewsCount?: number;
  address?: string;
  source?: string;
  url?: string;
  priceText?: string;
  locationPrecision?: "exact" | "geocoded" | "centroid" | "unknown";
  photos?: PlacePhoto[];
  googlePlaceId?: string;
  latitude?: number;
  longitude?: number;
};

export type PlaceDetailsResponse = { place: PlaceDetails | null };

export function placeDetailsUrl(placeId: string) {
  return `/api/places/${encodeURIComponent(placeId)}`;
}

export async function fetchPlaceDetails(
  url: string,
): Promise<PlaceDetailsResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as PlaceDetailsResponse;
}

export function placePhotosUrl(placeId: string) {
  return `/api/places/${encodeURIComponent(placeId)}/photos`;
}

export async function fetchPlacePhotos(
  url: string,
): Promise<{ photos: PlacePhoto[] }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as { photos: PlacePhoto[] };
}
