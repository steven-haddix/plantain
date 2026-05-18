"use client";

import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { addDays, format, isValid, parseISO } from "date-fns";
import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetcher } from "@/lib/fetcher";
import { generateKeyBetween } from "@/lib/trips/sort-keys";
import { ItineraryDay } from "./itinerary-day";
import { ItineraryDragOverlay } from "./itinerary-drag-overlay";
import type {
  ItineraryEventBucket,
  ItineraryEventListItem,
  ItineraryEventsResponse,
} from "./types";
import { useItineraryMove } from "./use-itinerary-move";
import { bucketOrder } from "./utils";

function itineraryUrl(tripId: string) {
  return `/api/trips/${encodeURIComponent(tripId)}/itinerary`;
}

function getTripDayCount(args: {
  startDate?: string | null;
  endDate?: string | null;
  fallbackDays: number;
}) {
  const { startDate, endDate, fallbackDays } = args;
  if (!startDate || !endDate) return Math.max(1, fallbackDays);

  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (!isValid(start) || !isValid(end)) return Math.max(1, fallbackDays);

  const diff = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(1, diff + 1);
}

function ordinalLabelFor(dayIndex: number) {
  if (dayIndex === 0) return "1st day";
  if (dayIndex === 1) return "2nd day";
  if (dayIndex === 2) return "3rd day";
  return `${dayIndex + 1}th day`;
}

function parseDayFromId(id: string): number | null {
  // event:X — caller handles via lookup; we only resolve day-relative ids here.
  if (id.startsWith("day:")) return Number(id.slice("day:".length));
  if (id.startsWith("bucket:")) {
    const parts = id.split(":");
    return parts.length >= 3 ? Number(parts[1]) : null;
  }
  return null;
}

function parseBucketFromId(id: string): ItineraryEventBucket | null {
  if (!id.startsWith("bucket:")) return null;
  const parts = id.split(":");
  return parts.length >= 3 ? (parts[2] as ItineraryEventBucket) : null;
}

const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  return closestCenter(args);
};

export function ItineraryPanel({
  tripId,
  startDate,
  endDate,
}: {
  tripId: string;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedEventId = searchParams.get("event") ?? undefined;
  const targetDayIndex = searchParams.get("day")
    ? Number(searchParams.get("day"))
    : null;

  const { data, isLoading, error } = useSWR<ItineraryEventsResponse>(
    tripId ? itineraryUrl(tripId) : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const events = data?.events ?? [];
  const moveEvent = useItineraryMove(tripId);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeOverDayIndex, setActiveOverDayIndex] = useState<number | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const maxDayIndex = useMemo(() => {
    return events.reduce((max, event) => Math.max(max, event.dayIndex), 0);
  }, [events]);

  const dayCount = getTripDayCount({
    startDate,
    endDate,
    fallbackDays: maxDayIndex + 1,
  });

  const eventsByDay = useMemo(() => {
    const map = new Map<number, ItineraryEventListItem[]>();
    for (const event of events) {
      const list = map.get(event.dayIndex) || [];
      list.push(event);
      map.set(event.dayIndex, list);
    }
    for (const [, list] of map.entries()) {
      list.sort((a, b) => {
        const bucketA = bucketOrder.indexOf(a.bucket);
        const bucketB = bucketOrder.indexOf(b.bucket);
        if (bucketA !== bucketB) return bucketA - bucketB;
        return a.sortOrder.localeCompare(b.sortOrder);
      });
    }
    return map;
  }, [events]);

  const eventById = useMemo(() => {
    const map = new Map<string, ItineraryEventListItem>();
    for (const event of events) map.set(event.id, event);
    return map;
  }, [events]);

  const activeEvent = activeDragId
    ? eventById.get(activeDragId.replace(/^event:/, ""))
    : undefined;

  const setParams = (next: URLSearchParams) => {
    router.replace(`/dashboard?${next.toString()}`);
  };

  const close = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("itinerary");
    next.delete("event");
    setParams(next);
  };

  const selectEvent = useCallback(
    (event: ItineraryEventListItem) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("itinerary", "1");
      next.set("day", String(event.dayIndex));
      next.set("event", event.id);
      if (event.placeGooglePlaceId) {
        next.set("place", event.placeGooglePlaceId);
      } else {
        next.delete("place");
      }
      router.replace(`/dashboard?${next.toString()}`);
    },
    [router, searchParams],
  );

  const start = startDate ? parseISO(startDate) : null;
  const hasValidStart = Boolean(start && isValid(start));

  const dayRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (targetDayIndex !== null) {
      const el = dayRefs.current.get(targetDayIndex);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [targetDayIndex]);

  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveDragId(id);
    const eventId = id.replace(/^event:/, "");
    const dragged = eventById.get(eventId);
    if (dragged) setActiveOverDayIndex(dragged.dayIndex);
  };

  const onDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id;
    if (overId === undefined || overId === null) return;
    const idStr = String(overId);
    // event:X → look up the event's day
    if (idStr.startsWith("event:")) {
      const ev = eventById.get(idStr.slice("event:".length));
      if (ev && ev.dayIndex !== activeOverDayIndex) {
        setActiveOverDayIndex(ev.dayIndex);
      }
      return;
    }
    const dayFromId = parseDayFromId(idStr);
    if (dayFromId !== null && dayFromId !== activeOverDayIndex) {
      setActiveOverDayIndex(dayFromId);
    }
  };

  const onDragCancel = () => {
    setActiveDragId(null);
    setActiveOverDayIndex(null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over?.id !== undefined ? String(event.over.id) : null;
    setActiveDragId(null);
    setActiveOverDayIndex(null);

    if (!overId) return; // dropped outside
    const eventId = activeId.replace(/^event:/, "");
    const dragged = eventById.get(eventId);
    if (!dragged) return;

    // Resolve target dayIndex + bucket
    let targetDay: number | null = null;
    let targetBucket: ItineraryEventBucket | null = null;
    let targetEventId: string | null = null;

    if (overId.startsWith("event:")) {
      const overEvent = eventById.get(overId.slice("event:".length));
      if (!overEvent) return;
      targetDay = overEvent.dayIndex;
      targetBucket = overEvent.bucket;
      targetEventId = overEvent.id;
    } else if (overId.startsWith("bucket:")) {
      targetDay = parseDayFromId(overId);
      targetBucket = parseBucketFromId(overId);
    } else {
      // day:N or anything else: snap back, no write.
      return;
    }

    if (targetDay === null || targetBucket === null) return;

    // Build the bucket's sibling list (excluding the dragged card if it's in this bucket)
    const dayEvents = eventsByDay.get(targetDay) ?? [];
    const siblings = dayEvents.filter(
      (e) => e.bucket === targetBucket && e.id !== dragged.id,
    );

    let newKey: string;
    try {
      if (targetEventId) {
        const idx = siblings.findIndex((e) => e.id === targetEventId);
        // Drop above the target: between siblings[idx-1] and target
        // (Without per-frame pointer Y here we always insert ABOVE the hovered card,
        // which matches dnd-kit sortable's default reordering semantics.)
        const prev = idx > 0 ? siblings[idx - 1].sortOrder : null;
        const next = siblings[idx]?.sortOrder ?? null;
        // If active was already directly before target in the original list, no-op.
        if (
          dragged.dayIndex === targetDay &&
          dragged.bucket === targetBucket &&
          prev === null &&
          siblings[0]?.id === targetEventId
        ) {
          // No movement
        }
        newKey = generateKeyBetween(prev, next);
      } else {
        // Empty bucket or bucket-zone drop → append to end.
        const last = siblings[siblings.length - 1];
        newKey = generateKeyBetween(last?.sortOrder ?? null, null);
      }
    } catch {
      // Pathological: identical neighbors. Skip rather than crash.
      return;
    }

    // No-op if nothing actually changed.
    if (
      dragged.dayIndex === targetDay &&
      dragged.bucket === targetBucket &&
      dragged.sortOrder === newKey
    ) {
      return;
    }

    moveEvent(dragged.id, {
      dayIndex: targetDay,
      bucket: targetBucket,
      sortOrder: newKey,
    });
  };

  return (
    <div className="w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-background/90 backdrop-blur shadow-lg">
      <div className="flex items-start justify-between gap-3 border-b p-4 bg-background/50">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">Itinerary</div>
          <div className="mt-1 truncate text-base font-semibold">
            Trip Rundown
          </div>
          {hasValidStart && endDate ? (
            <div className="text-xs text-muted-foreground mt-0.5">
              {format(start as Date, "MMM d")} –{" "}
              {format(parseISO(endDate), "MMM d, yyyy")}
            </div>
          ) : null}
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={close}
          aria-label="Close itinerary"
          className="hover:bg-muted"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="relative">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading itinerary…
          </div>
        ) : null}

        {error ? (
          <div className="p-8 text-center text-sm text-destructive">
            Failed to load itinerary.
          </div>
        ) : null}

        <ScrollArea className="flex h-[min(600px,calc(100vh-10rem))]">
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            <div className="min-w-0 relative pb-8 pt-4">
              {/* Continuous spine */}
              <div className="absolute left-[27px] top-4 bottom-4 w-px bg-border/60" />

              {Array.from({ length: dayCount }, (_, dayIndex) => {
                const dayEvents = eventsByDay.get(dayIndex) || [];
                const date = hasValidStart
                  ? addDays(start as Date, dayIndex)
                  : null;
                const dateLabel = date
                  ? format(date, "EEEE, d MMM")
                  : `Day ${dayIndex + 1}`;
                const dayKey = date
                  ? format(date, "yyyy-MM-dd")
                  : `day-${dayIndex}`;
                const isFirstDay = dayIndex === 0;
                const isExpanded =
                  activeDragId !== null && activeOverDayIndex === dayIndex;

                return (
                  <div
                    key={dayKey}
                    ref={(el) => {
                      if (el) dayRefs.current.set(dayIndex, el);
                      else dayRefs.current.delete(dayIndex);
                    }}
                  >
                    <ItineraryDay
                      dayIndex={dayIndex}
                      dateLabel={dateLabel}
                      ordinalLabel={ordinalLabelFor(dayIndex)}
                      events={dayEvents}
                      selectedEventId={selectedEventId}
                      onSelectEvent={selectEvent}
                      expanded={isExpanded}
                      isFirstDay={isFirstDay}
                    />
                  </div>
                );
              })}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeEvent ? (
                <ItineraryDragOverlay event={activeEvent} />
              ) : null}
            </DragOverlay>
          </DndContext>
        </ScrollArea>
      </div>
    </div>
  );
}
