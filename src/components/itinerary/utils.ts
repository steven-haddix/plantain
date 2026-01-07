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

/**
 * Generate a hue value for a day index using HSL/OKLCH color wheel rotation.
 * Creates a gradient effect where each day has a slightly different color.
 * Day 0 starts at ~190° (teal) and rotates ~35° per day.
 */
export function getDayHue(dayIndex: number): number {
  // Start at 190° (teal) and rotate 35° per day for gradient effect
  const baseHue = 190;
  const hueStep = 35;
  return (baseHue + dayIndex * hueStep) % 360;
}
