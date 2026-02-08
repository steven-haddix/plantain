"use client";

import L from "leaflet";
import { Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import useSWR from "swr";
import type { ItineraryEventsResponse } from "@/components/itinerary/types";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/fetcher";
import { type MapPlace, useMapStore } from "@/lib/map-store";
import { useAppStore } from "@/lib/store";
import { getDayHue } from "./itinerary/utils";

// Fix for default marker icon missing in Leaflet + Next.js
// We do this inside the component to ensure it only runs on client
const fixLeafletIcons = () => {
  // @ts-expect-error Leaflet's private icon url getter isn't in the public types.
  delete L.Icon.Default.prototype._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL(
      "leaflet/dist/images/marker-icon-2x.png",
      import.meta.url,
    ).toString(),
    iconUrl: new URL(
      "leaflet/dist/images/marker-icon.png",
      import.meta.url,
    ).toString(),
    shadowUrl: new URL(
      "leaflet/dist/images/marker-shadow.png",
      import.meta.url,
    ).toString(),
  });
};

/**
 * Create a day-specific marker icon with dynamic color based on day index.
 * Uses CSS custom property for the hue to enable smooth theming.
 */
function createDayMarkerIcon(dayIndex: number) {
  const hue = getDayHue(dayIndex);
  return L.divIcon({
    className: "itinerary-marker",
    html: `<div class="itinerary-marker__dot" style="--itinerary-day-hue: ${hue}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -8],
  });
}

function MapController({ places }: { places: MapPlace[] }) {
  const map = useMap();
  const selectedPlaceId = useMapStore((state) => state.selectedPlaceId);
  const activeTrip = useAppStore((state) => state.activeTrip);
  const hasAutoCenteredForTripRef = useRef(false);
  const lastTripIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (activeTrip?.id !== lastTripIdRef.current) {
      lastTripIdRef.current = activeTrip?.id;
      hasAutoCenteredForTripRef.current = false;
    }

    if (!selectedPlaceId) {
      // Auto-center only once when a trip first loads with no place selected.
      if (
        activeTrip?.destinationLocation &&
        !hasAutoCenteredForTripRef.current
      ) {
        map.flyTo(
          [
            activeTrip.destinationLocation.latitude,
            activeTrip.destinationLocation.longitude,
          ],
          12, // Zoom level for a city/region overview
          { animate: true, duration: 1.5 },
        );
        hasAutoCenteredForTripRef.current = true;
      }
      return;
    }

    const place = places.find((p) => p.googlePlaceId === selectedPlaceId);
    if (place) {
      map.flyTo([place.latitude, place.longitude], 16, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [
    map,
    selectedPlaceId,
    places,
    activeTrip?.destinationLocation,
    activeTrip?.id,
  ]);

  return null;
}

export default function MapView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pinnedResearch = useMapStore((state) => state.pinnedResearch);
  const accumulatedSearchPlaces = useMapStore(
    (state) => state.accumulatedSearchPlaces,
  );
  const clearAllSearchResults = useMapStore(
    (state) => state.clearAllSearchResults,
  );
  const selectPlace = useMapStore((state) => state.selectPlace);
  const activeTrip = useAppStore((state) => state.activeTrip);
  const placeParam = searchParams.get("place");

  useEffect(() => {
    fixLeafletIcons();
  }, []);

  useEffect(() => {
    selectPlace(placeParam ?? undefined);
  }, [placeParam, selectPlace]);

  // Combine accumulated search places with pinned research places
  const researchPlaces = useMemo(() => {
    const list = [
      ...accumulatedSearchPlaces,
      ...pinnedResearch.flatMap((layer) => layer.places),
    ];
    const byId = new Map(list.map((place) => [place.googlePlaceId, place]));
    return Array.from(byId.values());
  }, [accumulatedSearchPlaces, pinnedResearch]);

  const { data: itineraryData } = useSWR<ItineraryEventsResponse>(
    activeTrip?.id
      ? `/api/trips/${encodeURIComponent(activeTrip.id)}/itinerary`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const itineraryPlaces = useMemo(() => {
    const byId = new Map<string, MapPlace>();
    for (const event of itineraryData?.events ?? []) {
      if (!event.placeGooglePlaceId) continue;
      if (event.placeLatitude === null || event.placeLongitude === null)
        continue;
      if (byId.has(event.placeGooglePlaceId)) continue;
      byId.set(event.placeGooglePlaceId, {
        googlePlaceId: event.placeGooglePlaceId,
        name: event.placeName ?? event.customTitle ?? "Itinerary stop",
        address: event.placeAddress ?? undefined,
        latitude: event.placeLatitude,
        longitude: event.placeLongitude,
        dayIndex: event.dayIndex,
      });
    }
    return Array.from(byId.values());
  }, [itineraryData]);

  // Create day-specific marker icons (memoized per day)
  const dayMarkerIcons = useMemo(() => {
    const icons = new Map<number, ReturnType<typeof createDayMarkerIcon>>();
    for (const place of itineraryPlaces) {
      if (place.dayIndex !== undefined && !icons.has(place.dayIndex)) {
        icons.set(place.dayIndex, createDayMarkerIcon(place.dayIndex));
      }
    }
    return icons;
  }, [itineraryPlaces]);

  const selectablePlaces = useMemo(() => {
    const byId = new Map<string, MapPlace>();
    for (const place of [...researchPlaces, ...itineraryPlaces]) {
      if (!byId.has(place.googlePlaceId)) {
        byId.set(place.googlePlaceId, place);
      }
    }
    return Array.from(byId.values());
  }, [researchPlaces, itineraryPlaces]);

  const handleClearResults = () => {
    if (confirm("Clear all search results from the map?")) {
      clearAllSearchResults();
    }
  };

  const hasSearchResults = accumulatedSearchPlaces.length > 0;

  return (
    <div className="relative h-full w-full z-0">
      {hasSearchResults && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000]">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleClearResults}
            className="shadow-lg gap-1.5"
          >
            <Trash2 className="size-3.5" />
            Clear {accumulatedSearchPlaces.length} result
            {accumulatedSearchPlaces.length !== 1 ? "s" : ""}
          </Button>
        </div>
      )}
      <MapContainer
        center={[51.505, -0.09]}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
        />
        <MapController places={selectablePlaces} />
        {itineraryPlaces.map((place) => {
          // Get the day-specific icon, fall back to day 0 icon if no dayIndex
          const dayIndex = place.dayIndex ?? 0;
          const icon = dayMarkerIcons.get(dayIndex) ?? dayMarkerIcons.get(0);

          return (
            <Marker
              key={`itinerary-${place.googlePlaceId}`}
              position={[place.latitude, place.longitude]}
              icon={icon}
              zIndexOffset={500}
              eventHandlers={{
                click: () => {
                  selectPlace(place.googlePlaceId);
                  const next = new URLSearchParams(searchParams.toString());
                  next.set("place", place.googlePlaceId);
                  router.replace(`/dashboard?${next.toString()}`);
                },
              }}
            >
              <Popup>
                <div className="text-sm font-medium">{place.name}</div>
                {place.address ? (
                  <div className="text-xs text-muted-foreground">
                    {place.address}
                  </div>
                ) : null}
                {place.dayIndex !== undefined && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Day {place.dayIndex + 1}
                  </div>
                )}
              </Popup>
            </Marker>
          );
        })}
        {researchPlaces.map((place, index) => (
          <Marker
            key={`${place.googlePlaceId ?? "place"}-${index}`}
            position={[place.latitude, place.longitude]}
            eventHandlers={{
              click: () => {
                selectPlace(place.googlePlaceId);
                const next = new URLSearchParams(searchParams.toString());
                next.set("place", place.googlePlaceId);
                router.replace(`/dashboard?${next.toString()}`);
              },
            }}
          >
            <Popup>
              <div className="text-sm font-medium">{place.name}</div>
              <div className="text-xs text-muted-foreground">
                {place.address}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
