"use client";

import { Bookmark, Calendar } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ItineraryPanel } from "@/components/itinerary/itinerary-rail";
import { SavedLocationsPanel } from "@/components/saved-locations-rail";

type Tab = "itinerary" | "saved";

export function MapRailTabs({
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

  const activeTab: Tab | null =
    searchParams.get("itinerary") === "1"
      ? "itinerary"
      : searchParams.get("saved") === "1"
        ? "saved"
        : null;

  const setParams = (next: URLSearchParams) => {
    router.replace(`/dashboard?${next.toString()}`);
  };

  const toggleTab = (tab: Tab) => {
    const next = new URLSearchParams(searchParams.toString());
    if (activeTab === tab) {
      next.delete("itinerary");
      next.delete("saved");
      next.delete("event");
    } else {
      next.delete("itinerary");
      next.delete("saved");
      next.delete("event");
      next.set(tab === "itinerary" ? "itinerary" : "saved", "1");
    }
    setParams(next);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-auto absolute left-4 top-4 flex flex-col gap-2">
        {/* Tab buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={activeTab === "itinerary" ? "default" : "secondary"}
            className={cn(
              "rounded-2xl shadow-lg backdrop-blur gap-1.5",
              activeTab !== "itinerary" && "bg-background/80",
            )}
            onClick={() => toggleTab("itinerary")}
          >
            <Calendar className="size-4" />
            Itinerary
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === "saved" ? "default" : "secondary"}
            className={cn(
              "rounded-2xl shadow-lg backdrop-blur gap-1.5",
              activeTab !== "saved" && "bg-background/80",
            )}
            onClick={() => toggleTab("saved")}
          >
            <Bookmark className="size-4" />
            Saved
          </Button>
        </div>

        {/* Active panel */}
        {activeTab === "itinerary" && (
          <ItineraryPanel
            tripId={tripId}
            startDate={startDate}
            endDate={endDate}
          />
        )}
        {activeTab === "saved" && <SavedLocationsPanel tripId={tripId} />}
      </div>
    </div>
  );
}
