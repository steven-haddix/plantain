"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { ItineraryEventCard } from "./itinerary-event-card";
import type { ItineraryEventBucket, ItineraryEventListItem } from "./types";
import { bucketLabel } from "./utils";

export function ItineraryBucketSection({
  dayIndex,
  bucket,
  events,
  selectedEventId,
  onSelectEvent,
  expanded,
}: {
  dayIndex: number;
  bucket: ItineraryEventBucket;
  events: ItineraryEventListItem[];
  selectedEventId?: string;
  onSelectEvent: (event: ItineraryEventListItem) => void;
  /** When true: show the bucket label and an empty-state drop slot. */
  expanded: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `bucket:${dayIndex}:${bucket}`,
    data: { type: "bucket", dayIndex, bucket },
  });

  // In compact mode an empty bucket renders nothing.
  if (!expanded && events.length === 0) {
    return null;
  }

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "transition-colors",
        expanded && "rounded-xl",
        expanded && isOver && "bg-accent/30 ring-1 ring-primary/30",
      )}
    >
      {expanded ? (
        <div className="mb-1.5 flex items-baseline gap-2 px-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            {bucketLabel[bucket]}
          </div>
          {events.length ? (
            <div className="text-[10px] text-muted-foreground/60">
              {events.length}
            </div>
          ) : null}
        </div>
      ) : null}

      <SortableContext
        items={events.map((e) => `event:${e.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className={cn(expanded ? "space-y-2" : "space-y-6")}>
          {events.map((event) => (
            <ItineraryEventCard
              key={event.id}
              event={event}
              isSelected={event.id === selectedEventId}
              onSelect={onSelectEvent}
            />
          ))}
          {expanded && events.length === 0 ? (
            <div
              className={cn(
                "rounded-xl border border-dashed bg-background/40 px-3 py-3 text-center text-[11px] text-muted-foreground/70",
                isOver && "border-primary/40 text-foreground/80",
              )}
            >
              Drop here
            </div>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}
