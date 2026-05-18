"use client";

import { ItineraryEventCard } from "./itinerary-event-card";
import type { ItineraryEventListItem } from "./types";

export function ItineraryDragOverlay({
  event,
}: {
  event: ItineraryEventListItem;
}) {
  return (
    <ItineraryEventCard
      event={event}
      isSelected={false}
      onSelect={() => {}}
      overlay
    />
  );
}
