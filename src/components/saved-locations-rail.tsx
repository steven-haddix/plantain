"use client";

import { MapPin, Star, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";
import { getSavedLocations, toggleSavedLocation } from "@/app/actions/trips";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMapStore } from "@/lib/map-store";

export function SavedLocationsPanel({ tripId }: { tripId: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectPlace = useMapStore((state) => state.selectPlace);
    const [removeTarget, setRemoveTarget] = useState<{
        id: string;
        name: string;
        googlePlaceId: string;
    } | null>(null);
    const [isPending, startTransition] = useTransition();

    // SWR fetcher wrapper for server action
    const fetcher = async () => getSavedLocations(tripId);

    const { data: locations, isLoading } = useSWR(
        tripId ? ["saved-locations", tripId] : null,
        fetcher
    );

    const setParams = (next: URLSearchParams) => {
        router.replace(`/dashboard?${next.toString()}`);
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

    const handleRemove = () => {
        if (!removeTarget) return;
        startTransition(async () => {
            try {
                await toggleSavedLocation(tripId, {
                    googlePlaceId: removeTarget.googlePlaceId,
                });
                mutate(["saved-locations", tripId]);
                toast.success(`Removed "${removeTarget.name}"`);
            } catch {
                toast.error("Failed to remove location");
            } finally {
                setRemoveTarget(null);
            }
        });
    };

    return (
        <>
            <div className="w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-background/90 backdrop-blur shadow-lg">
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
                            {locations?.map((item) => {
                                const details = item.place.details as Record<string, unknown> | null;
                                const name = (details?.name as string) || "Unknown Place";
                                const address = (details?.address as string) || "";
                                const rating = typeof details?.rating === "number" ? details.rating : null;
                                const reviewsCount = typeof details?.reviewsCount === "number" ? details.reviewsCount : null;
                                const priceText = (details?.priceText as string) || "";
                                const category = (item.place.category as string) || (details?.category as string) || "";

                                return (
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
                                                {name}
                                            </div>
                                            {address && (
                                                <div className="mt-1 text-sm text-muted-foreground line-clamp-1">
                                                    {address}
                                                </div>
                                            )}
                                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                                {category && (
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                        {category}
                                                    </Badge>
                                                )}
                                                {rating !== null && (
                                                    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                                                        <Star className="size-3 fill-amber-400 text-amber-400" />
                                                        {rating.toFixed(1)}
                                                    </span>
                                                )}
                                                {reviewsCount !== null && (
                                                    <span className="text-xs text-muted-foreground">
                                                        ({reviewsCount.toLocaleString()})
                                                    </span>
                                                )}
                                                {priceText && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {priceText}
                                                    </span>
                                                )}
                                            </div>
                                            {item.note && (
                                                <div className="mt-2 text-xs text-muted-foreground italic bg-muted/50 p-2 rounded">
                                                    "{item.note}"
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setRemoveTarget({
                                                    id: item.id,
                                                    name,
                                                    googlePlaceId: item.place.googlePlaceId,
                                                });
                                            }}
                                            aria-label={`Remove ${name}`}
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>
            </div>

            <AlertDialog
                open={removeTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setRemoveTarget(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove saved location?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove <span className="font-medium text-foreground">{removeTarget?.name}</span> from your saved locations.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemove}
                            disabled={isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isPending ? "Removing..." : "Remove"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
