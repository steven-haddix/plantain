"use client";

import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ItineraryBucketSection } from "./itinerary-bucket-section";
import type { ItineraryEventListItem } from "./types";
import { bucketOrder, getDayHue, groupEventsByBucket } from "./utils";

export function ItineraryDay({
  dayIndex,
  dateLabel,
  ordinalLabel,
  events,
  selectedEventId,
  onSelectEvent,
  expanded,
  isFirstDay,
}: {
  dayIndex: number;
  dateLabel: string;
  ordinalLabel: string;
  events: ItineraryEventListItem[];
  selectedEventId?: string;
  onSelectEvent: (event: ItineraryEventListItem) => void;
  /** Show all 5 bucket sections with labels and "drop here" slots. */
  expanded: boolean;
  isFirstDay: boolean;
}) {
  const grouped = useMemo(() => groupEventsByBucket(events), [events]);

  const { setNodeRef } = useDroppable({
    id: `day:${dayIndex}`,
    data: { type: "day", dayIndex },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn("group relative pl-16 pr-4", !isFirstDay && "mt-8")}
    >
      {/* Timeline node */}
      <div
        className="absolute left-[21px] top-0.5 z-10 size-3 rounded-full border-2 bg-background ring-4 ring-background transition-colors"
        style={{
          borderColor: `oklch(0.7 0.14 ${getDayHue(dayIndex)})`,
        }}
      />

      {/* Day header */}
      <div className="mb-4 -mt-1 flex items-baseline justify-between">
        <h3 className="font-semibold text-foreground/90">{dateLabel}</h3>
        <span className="text-xs text-muted-foreground font-medium">
          {ordinalLabel}
        </span>
      </div>

      <motion.div
        layout
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={cn(expanded ? "space-y-3" : "space-y-6")}
      >
        <AnimatePresence initial={false}>
          {bucketOrder.map((bucket) => {
            const bucketEvents = grouped[bucket];
            // Compact mode: hide empty buckets entirely.
            if (!expanded && bucketEvents.length === 0) return null;
            return (
              <motion.div
                key={bucket}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ItineraryBucketSection
                  dayIndex={dayIndex}
                  bucket={bucket}
                  events={bucketEvents}
                  selectedEventId={selectedEventId}
                  onSelectEvent={onSelectEvent}
                  expanded={expanded}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
        {!expanded && events.length === 0 ? (
          <div className="text-sm text-muted-foreground italic pl-2 opacity-60">
            No events planned
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
