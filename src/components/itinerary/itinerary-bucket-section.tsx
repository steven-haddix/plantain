"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ItineraryEventCard } from "./itinerary-event-card";
import type { ItineraryEventBucket, ItineraryEventListItem } from "./types";
import { bucketLabel } from "./utils";

export function ItineraryBucketSection({
  bucket,
  events,
  selectedEventId,
  onSelectEvent,
  onAdd,
}: {
  bucket: ItineraryEventBucket;
  events: ItineraryEventListItem[];
  selectedEventId?: string;
  onSelectEvent: (event: ItineraryEventListItem) => void;
  onAdd?: (bucket: ItineraryEventBucket) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            {bucketLabel[bucket]}
          </div>
          <div className="text-xs text-muted-foreground">{events.length}</div>
        </div>
        {onAdd ? (
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => onAdd(bucket)}
            aria-label={`Add to ${bucketLabel[bucket]}`}
          >
            <Plus className="size-4" />
          </Button>
        ) : null}
      </div>

      {events.length ? (
        <div className="space-y-2">
          {events.map((event) => (
            <ItineraryEventCard
              key={event.id}
              event={event}
              isSelected={event.id === selectedEventId}
              onSelect={onSelectEvent}
            />
          ))}
        </div>
      ) : (
        <div
          className={cn(
            "rounded-xl border border-dashed bg-background/40 p-3 text-xs text-muted-foreground",
          )}
        >
          Drag items here or add a big rock.
        </div>
      )}
    </section>
  );
}
