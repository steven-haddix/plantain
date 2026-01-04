"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchPlaceDetails, placeDetailsUrl } from "@/lib/place-details";

export function PlaceDetailsPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeId = searchParams.get("place") ?? undefined;

  const { data, error, isLoading } = useSWR(
    placeId ? placeDetailsUrl(placeId) : null,
    fetchPlaceDetails,
    { revalidateOnFocus: false },
  );

  const place = data?.place;

  if (!placeId) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-auto absolute right-4 top-4 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border bg-background/90 backdrop-blur shadow-lg">
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

        <div className="space-y-3 p-4">
          {error ? (
            <div className="text-sm text-destructive">
              Failed to load place details.
            </div>
          ) : null}

          {place?.photos?.[0]?.url ? (
            <Image
              alt={place?.name || "Place photo"}
              src={place.photos[0].url}
              width={640}
              height={360}
              className="h-40 w-full rounded-xl object-cover"
            />
          ) : null}

          {place?.address ? (
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                Address
              </div>
              <div className="text-sm">{place.address}</div>
            </div>
          ) : null}

          <div className="text-xs text-muted-foreground">
            ID: <span className="font-mono">{placeId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
