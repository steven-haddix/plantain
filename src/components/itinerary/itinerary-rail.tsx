"use client";

import { addDays, format, isValid, parseISO } from "date-fns";
import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { ItineraryEventCard } from "./itinerary-event-card";
import type { ItineraryEventListItem, ItineraryEventsResponse } from "./types";
import { bucketOrder, getDayHue } from "./utils";

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

  const maxDayIndex = useMemo(() => {
    return events.reduce((max, event) => Math.max(max, event.dayIndex), 0);
  }, [events]);

  const dayCount = getTripDayCount({
    startDate,
    endDate,
    fallbackDays: maxDayIndex + 1,
  });

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map = new Map<number, ItineraryEventListItem[]>();
    for (const event of events) {
      const list = map.get(event.dayIndex) || [];
      list.push(event);
      map.set(event.dayIndex, list);
    }
    // Sort events within each day by bucket/sortOrder
    for (const [day, list] of map.entries()) {
      list.sort((a, b) => {
        const bucketA = bucketOrder.indexOf(a.bucket);
        const bucketB = bucketOrder.indexOf(b.bucket);
        if (bucketA !== bucketB) return bucketA - bucketB;
        return a.sortOrder - b.sortOrder;
      });
    }
    return map;
  }, [events]);

  const setParams = (next: URLSearchParams) => {
    router.replace(`/dashboard?${next.toString()}`);
  };

  const close = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("itinerary");
    next.delete("event");
    setParams(next);
  };

  const selectEvent = (event: ItineraryEventListItem) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("itinerary", "1");
    next.set("day", String(event.dayIndex));
    next.set("event", event.id);
    if (event.placeGooglePlaceId) {
      next.set("place", event.placeGooglePlaceId);
    } else {
      next.delete("place");
    }
    setParams(next);
  };

  const start = startDate ? parseISO(startDate) : null;
  const hasValidStart = Boolean(start && isValid(start));

  const dayRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Scroll to day on open/change
  useEffect(() => {
    if (targetDayIndex !== null) {
      const el = dayRefs.current.get(targetDayIndex);
      if (el) {
        // slight delay to allow layout
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [targetDayIndex]);

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
              {format(start!, "MMM d")} –{" "}
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
          <div className="min-w-0 relative pb-8 pt-4">
            {/* Continuous spine line */}
            <div className="absolute left-[27px] top-4 bottom-4 w-px bg-border/60" />

            {Array.from({ length: dayCount }).map((_, dayIndex) => {
              const dayEvents = eventsByDay.get(dayIndex) || [];
              const date = hasValidStart
                ? addDays(start!, dayIndex)
                : null;
              const dateLabel = date
                ? format(date, "EEEE, d MMM")
                : `Day ${dayIndex + 1}`;
              const isFirstDay = dayIndex === 0;

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "group relative pl-16 pr-4",
                    !isFirstDay && "mt-8",
                  )}
                  ref={(el) => {
                    if (el) dayRefs.current.set(dayIndex, el);
                    else dayRefs.current.delete(dayIndex);
                  }}
                >
                  {/* Timeline Node for Day Header */}
                  <div
                    className="absolute left-[21px] top-0.5 z-10 size-3 rounded-full border-2 bg-background ring-4 ring-background transition-colors"
                    style={{
                      borderColor: `oklch(0.7 0.14 ${getDayHue(dayIndex)})`,
                    }}
                  />

                  {/* Day Header */}
                  <div className="mb-4 -mt-1 flex items-baseline justify-between">
                    <h3 className="font-semibold text-foreground/90">
                      {dateLabel}
                    </h3>
                    <span className="text-xs text-muted-foreground font-medium">
                      {dayIndex === 0
                        ? "1st day"
                        : dayIndex === 1
                          ? "2nd day"
                          : `${dayIndex + 1}th day`}
                    </span>
                  </div>

                  <div className="space-y-6">
                    {!dayEvents.length ? (
                      <div className="text-sm text-muted-foreground italic pl-2 opacity-60">
                        No events planned
                      </div>
                    ) : (
                      dayEvents.map((event, idx) => {
                        const isSelected = event.id === selectedEventId;
                        return (
                          <div key={event.id} className="relative">
                            {/* Event Node on spine */}
                            <div
                              className={cn(
                                "absolute -left-[39px] top-4 size-2 rounded-full border bg-background ring-4 ring-background transition-colors",
                                !isSelected && "border-border",
                              )}
                              style={
                                isSelected
                                  ? {
                                    borderColor: `oklch(0.7 0.14 ${getDayHue(dayIndex)})`,
                                    backgroundColor: `oklch(0.7 0.14 ${getDayHue(dayIndex)})`,
                                  }
                                  : undefined
                              }
                            />

                            <ItineraryEventCard
                              event={event}
                              isSelected={isSelected}
                              onSelect={selectEvent}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
