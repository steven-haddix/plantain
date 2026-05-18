"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import type {
  ItineraryEventBucket,
  ItineraryEventListItem,
  ItineraryEventsResponse,
} from "./types";
import { bucketOrder } from "./utils";

export type ItineraryMovePatch = {
  dayIndex: number;
  bucket: ItineraryEventBucket;
  sortOrder: string;
};

function itineraryUrl(tripId: string) {
  return `/api/trips/${encodeURIComponent(tripId)}/itinerary`;
}

function sortEvents(
  events: ItineraryEventListItem[],
): ItineraryEventListItem[] {
  return [...events].sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    const bucketA = bucketOrder.indexOf(a.bucket);
    const bucketB = bucketOrder.indexOf(b.bucket);
    if (bucketA !== bucketB) return bucketA - bucketB;
    return a.sortOrder.localeCompare(b.sortOrder);
  });
}

export function useItineraryMove(tripId: string) {
  return useCallback(
    async (eventId: string, patch: ItineraryMovePatch) => {
      const key = itineraryUrl(tripId);

      const applyOptimistic = (
        prev: ItineraryEventsResponse | undefined,
      ): ItineraryEventsResponse => {
        if (!prev) return { events: [] };
        const next = prev.events.map((event) =>
          event.id === eventId ? { ...event, ...patch } : event,
        );
        return { events: sortEvents(next) };
      };

      try {
        await mutate<ItineraryEventsResponse>(
          key,
          async (current) => {
            const res = await fetch(`${key}/${encodeURIComponent(eventId)}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(patch),
            });
            if (!res.ok) {
              throw new Error(`Move failed (${res.status})`);
            }
            return applyOptimistic(current);
          },
          {
            optimisticData: applyOptimistic,
            rollbackOnError: true,
            revalidate: false,
            populateCache: true,
          },
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Couldn't move event";
        toast.error(message);
      }
    },
    [tripId],
  );
}
