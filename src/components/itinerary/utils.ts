import type { ItineraryEventBucket, ItineraryEventListItem } from "./types";

export const bucketOrder: ItineraryEventBucket[] = [
  "morning",
  "afternoon",
  "evening",
  "night",
  "anytime",
];

export const bucketLabel: Record<ItineraryEventBucket, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
  anytime: "Anytime",
};

export function groupEventsByBucket(
  events: ItineraryEventListItem[],
): Record<ItineraryEventBucket, ItineraryEventListItem[]> {
  const grouped: Record<ItineraryEventBucket, ItineraryEventListItem[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
    anytime: [],
  };

  for (const event of events) {
    grouped[event.bucket].push(event);
  }

  for (const bucket of bucketOrder) {
    grouped[bucket].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return grouped;
}

export function eventDisplayTitle(event: ItineraryEventListItem) {
  return event.placeName || event.customTitle || "Untitled";
}
