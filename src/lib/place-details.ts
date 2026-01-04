export type PlaceDetails = {
  name?: string;
  category?: string;
  rating?: number;
  reviewsCount?: number;
  address?: string;
  photos?: { url: string }[];
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
