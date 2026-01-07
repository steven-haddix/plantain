"use client";

import { Bookmark, MapPin, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import useSWR from "swr";
import { getSavedLocations } from "@/app/actions/trips";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useMapStore } from "@/lib/map-store";

export function SavedLocationsRail({ tripId }: { tripId: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectPlace = useMapStore((state) => state.selectPlace);

    const isOpen = searchParams.get("saved") === "1";

    // SWR fetcher wrapper for server action
    const fetcher = async () => getSavedLocations(tripId);

    const { data: locations, isLoading } = useSWR(
        tripId && isOpen ? ["saved-locations", tripId] : null,
        fetcher
    );

    const setParams = (next: URLSearchParams) => {
        router.replace(`/dashboard?${next.toString()}`);
    };

    const open = () => {
        const next = new URLSearchParams(searchParams.toString());
        next.set("saved", "1");
        // Mutual exclusivity: close itinerary if open
        next.delete("itinerary");
        next.delete("event");
        setParams(next);
    };

    const close = () => {
        const next = new URLSearchParams(searchParams.toString());
        next.delete("saved");
        setParams(next);
    };

    const handleSelectPlace = (googlePlaceId: string) => {
        selectPlace(googlePlaceId);
        const next = new URLSearchParams(searchParams.toString());
        next.set("place", googlePlaceId);
        setParams(next);
    };

    return (
        <div className="pointer-events-none absolute inset-0 z-10 w-full h-full">
            <div className="pointer-events-auto absolute left-4 top-16">
                {!isOpen ? (
                    <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="size-10 rounded-2xl bg-background/80 backdrop-blur shadow-lg mt-2"
                        onClick={open}
                        aria-label="Open saved locations"
                    >
                        <Bookmark className="size-5" />
                    </Button>
                ) : (
                    <div className="w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-background/90 backdrop-blur shadow-lg mt-0">
                        <div className="flex items-center justify-between gap-3 border-b p-4 bg-background/50">
                            <div>
                                <div className="text-sm text-muted-foreground">Trip</div>
                                <div className="text-base font-semibold">Saved Locations</div>
                            </div>
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={close}
                                aria-label="Close saved locations"
                                className="hover:bg-muted"
                            >
                                <X className="size-4" />
                            </Button>
                        </div>

                        <div className="relative">
                            {isLoading ? (
                                <div className="p-8 text-center text-sm text-muted-foreground">
                                    Loading saved places...
                                </div>
                            ) : null}

                            {!isLoading && locations?.length === 0 ? (
                                <div className="p-8 text-center text-sm text-muted-foreground">
                                    No saved locations yet.
                                </div>
                            ) : null}

                            <ScrollArea className="flex h-[min(600px,calc(100vh-14rem))]">
                                <div className="p-4 space-y-4">
                                    {locations?.map((item) => (
                                        <div
                                            key={item.id}
                                            className="group relative flex gap-3 rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-accent/50 cursor-pointer"
                                            onClick={() => handleSelectPlace(item.place.googlePlaceId)}
                                        >
                                            <div className="shrink-0 pt-0.5">
                                                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                    <MapPin className="size-4" />
                                                </div>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium leading-none">
                                                    {item.place.details?.name as string || "Unknown Place"}
                                                </div>
                                                <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                                    {item.place.details?.formatted_address as string || ""}
                                                </div>
                                                {item.note && (
                                                    <div className="mt-2 text-xs text-muted-foreground italic bg-muted/50 p-2 rounded">
                                                        "{item.note}"
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
