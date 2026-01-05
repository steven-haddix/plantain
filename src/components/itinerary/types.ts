export type ItineraryEventBucket =
  | "morning"
  | "afternoon"
  | "evening"
  | "night"
  | "anytime";

export type ItineraryEventStatus = "proposed" | "confirmed" | "canceled";

export type ItineraryEventListItem = {
  id: string;
  tripId: string;
  placeId: string | null;
  placeGooglePlaceId: string | null;
  customTitle: string | null;
  dayIndex: number;
  bucket: ItineraryEventBucket;
  sortOrder: number;
  isOptional: boolean;
  status: ItineraryEventStatus;
  sourceSavedLocationId: string | null;
  metadata: Record<string, unknown> | null;
  placeName: string | null;
  placeAddress: string | null;
};

export type ItineraryEventsResponse = {
  events: ItineraryEventListItem[];
};
