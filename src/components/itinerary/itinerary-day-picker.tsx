"use client";

import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
} from "date-fns";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  return Math.max(1, differenceInCalendarDays(end, start) + 1);
}

export function ItineraryDayPicker({
  startDate,
  endDate,
  maxDayIndex,
  selectedDayIndex,
  onSelect,
}: {
  startDate?: string | null;
  endDate?: string | null;
  maxDayIndex: number;
  selectedDayIndex: number;
  onSelect: (dayIndex: number) => void;
}) {
  const dayCount = getTripDayCount({
    startDate,
    endDate,
    fallbackDays: Math.max(1, maxDayIndex + 1),
  });

  const start = startDate ? parseISO(startDate) : null;
  const hasValidStart = Boolean(start && isValid(start));

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
        <Calendar className="size-3.5" />
        Day
      </div>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {Array.from({ length: dayCount }).map((_, idx) => {
          const isActive = idx === selectedDayIndex;
          const label = hasValidStart
            ? format(addDays(start as Date, idx), "EEE, MMM d")
            : `Day ${idx + 1}`;
          const key = hasValidStart
            ? format(addDays(start as Date, idx), "yyyy-MM-dd")
            : `day-${idx + 1}`;

          return (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={isActive ? "default" : "secondary"}
              className={cn(
                "h-7 shrink-0 rounded-full px-2.5 text-xs",
                !isActive && "bg-muted/50",
              )}
              onClick={() => onSelect(idx)}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
