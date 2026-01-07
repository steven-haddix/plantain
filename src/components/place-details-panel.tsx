"use client";

import { MapPin, X } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { fetchPlaceDetails, fetchPlacePhotos, placeDetailsUrl, placePhotosUrl, type PlacePhoto } from "@/lib/place-details";

export function PlaceDetailsPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeId = searchParams.get("place") ?? undefined;

  const { data, error, isLoading } = useSWR(
    placeId ? placeDetailsUrl(placeId) : null,
    fetchPlaceDetails,
    { revalidateOnFocus: false },
  );

  const { data: photosData, isLoading: isLoadingPhotos } = useSWR(
    placeId ? placePhotosUrl(placeId) : null,
    fetchPlacePhotos,
    { revalidateOnFocus: false },
  );

  const place = data?.place;
  const photos = photosData?.photos || (place?.photos ? place.photos : []);

  if (!placeId) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-auto absolute right-4 top-4 w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl border bg-background/90 backdrop-blur shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground">Place</div>
            <div className="mt-1 truncate text-base font-semibold">
              {isLoading ? "Loading…" : place?.name || "Unknown place"}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {place?.category ? (
                <Badge variant="secondary">{place.category}</Badge>
              ) : null}
              {typeof place?.rating === "number" ? (
                <Badge variant="outline">{place.rating.toFixed(1)} ★</Badge>
              ) : null}
              {typeof place?.reviewsCount === "number" ? (
                <span className="text-xs text-muted-foreground">
                  {place.reviewsCount.toLocaleString()} reviews
                </span>
              ) : null}
            </div>
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              const next = new URLSearchParams(searchParams.toString());
              next.delete("place");
              router.replace(`/dashboard?${next.toString()}`);
            }}
            aria-label="Close place details"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 p-4">
          {error ? (
            <div className="text-sm text-destructive">
              Failed to load place details.
            </div>
          ) : null}

          <div className="relative">
            {isLoadingPhotos ? (
              <div className="flex w-full gap-2 overflow-hidden">
                <Skeleton className="aspect-[16/10] h-48 w-full flex-none rounded-xl" />
                <Skeleton className="aspect-[16/10] h-48 w-20 flex-none rounded-xl" />
              </div>
            ) : photos.length > 0 ? (
              <Carousel className="group w-full">
                <CarouselContent className="-ml-2">
                  {photos.map((photo: PlacePhoto, idx: number) => (
                    <CarouselItem key={photo.id || idx} className="pl-2">
                      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted">
                        <Image
                          alt={`${place?.name || "Place"} photo ${idx + 1}`}
                          src={photo.url}
                          fill
                          className="object-cover transition-transform hover:scale-105"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {photos.length > 1 && (
                  <>
                    <CarouselPrevious variant="secondary" className="left-2 top-1/2 -translate-y-1/2 bg-background/60 opacity-0 shadow-md transition-opacity group-hover:opacity-100 disabled:opacity-0" />
                    <CarouselNext variant="secondary" className="right-2 top-1/2 -translate-y-1/2 bg-background/60 opacity-0 shadow-md transition-opacity group-hover:opacity-100 disabled:opacity-0" />
                  </>
                )}
              </Carousel>
            ) : place?.photos?.[0]?.url ? (
              <Image
                alt={place?.name || "Place photo"}
                src={place.photos[0].url}
                width={640}
                height={360}
                className="h-48 w-full rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-48 w-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
                No photos available
              </div>
            )}
          </div>

          {place?.address || placeId ? (
            <div className="flex items-center justify-between gap-4">
              {place?.address && (
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground">
                    Address
                  </div>
                  <div className="truncate text-sm">{place.address}</div>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 text-xs"
                onClick={() => {
                  const query = encodeURIComponent(place?.name || placeId);
                  const url = `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${placeId}`;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
              >
                <MapPin className="size-3.5" />
                Google Map
              </Button>
            </div>
          ) : null}

          <div className="text-[10px] text-muted-foreground/50">
            ID: <span className="font-mono">{placeId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
