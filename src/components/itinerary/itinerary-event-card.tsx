"use client";

import { MapPin, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ItineraryEventListItem } from "./types";
import { eventDisplayTitle } from "./utils";

const statusVariant = (status: ItineraryEventListItem["status"]) => {
  switch (status) {
    case "confirmed":
      return "default";
    case "canceled":
      return "destructive";
    default:
      return "secondary";
  }
};

export function ItineraryEventCard({
  event,
  isSelected,
  onSelect,
}: {
  event: ItineraryEventListItem;
  isSelected: boolean;
  onSelect: (event: ItineraryEventListItem) => void;
}) {
  const title = eventDisplayTitle(event);
  const Icon = event.placeGooglePlaceId ? MapPin : Sparkles;

  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className={cn(
        "group relative flex min-w-0 w-full flex-col gap-3 rounded-xl border bg-background/70 p-3 text-left backdrop-blur transition-all hover:bg-accent/50 hover:shadow-sm",
        isSelected && "border-primary/50 ring-1 ring-primary/20",
      )}
    >
      <div className="flex min-w-0 w-full items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground/90">{title}</div>
            {event.placeAddress ? (
              <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {event.placeAddress}
              </div>
            ) : null}

            {/* Optional time/bucket display since we removed headers */}
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {event.bucket}
              </span>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        {event.status !== "proposed" || event.isOptional ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            {event.status !== "proposed" && (
              <Badge variant={statusVariant(event.status)} className="h-5 px-1.5 text-[10px] capitalize">
                {event.status}
              </Badge>
            )}
            {event.isOptional ? (
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Optional
              </span>
            ) : null}
          </div>
        ) : null}

      </div>
    </button>
  );
}
