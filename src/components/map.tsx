"use client";

import L from "leaflet";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import useSWR from "swr";
import { useMapStore, type MapPlace } from "@/lib/map-store";
import { useAppStore } from "@/lib/store";
import { fetcher } from "@/lib/fetcher";
import type { ItineraryEventsResponse } from "@/components/itinerary/types";

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

function MapController({ places }: { places: MapPlace[] }) {
  const map = useMap();
  const selectedPlaceId = useMapStore((state) => state.selectedPlaceId);

  useEffect(() => {
    if (!selectedPlaceId) return;

    const place = places.find((p) => p.googlePlaceId === selectedPlaceId);
    if (place) {
      map.flyTo([place.latitude, place.longitude], 16, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [map, selectedPlaceId, places]);

  return null;
}

export default function MapView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeResearch = useMapStore((state) => state.activeResearch);
  const pinnedResearch = useMapStore((state) => state.pinnedResearch);
  const selectPlace = useMapStore((state) => state.selectPlace);
  const activeTrip = useAppStore((state) => state.activeTrip);
  const placeParam = searchParams.get("place");

  useEffect(() => {
    fixLeafletIcons();
  }, []);

  useEffect(() => {
    selectPlace(placeParam ?? undefined);
  }, [placeParam, selectPlace]);

  const researchPlaces = useMemo(() => {
    const list = [
      ...(activeResearch?.places ?? []),
      ...pinnedResearch.flatMap((layer) => layer.places),
    ];
    const byId = new Map(list.map((place) => [place.googlePlaceId, place]));
    return Array.from(byId.values());
  }, [activeResearch, pinnedResearch]);

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
      if (event.placeLatitude === null || event.placeLongitude === null) continue;
      if (byId.has(event.placeGooglePlaceId)) continue;
      byId.set(event.placeGooglePlaceId, {
        googlePlaceId: event.placeGooglePlaceId,
        name: event.placeName ?? event.customTitle ?? "Itinerary stop",
        address: event.placeAddress ?? undefined,
        latitude: event.placeLatitude,
        longitude: event.placeLongitude,
      });
    }
    return Array.from(byId.values());
  }, [itineraryData]);

  const selectablePlaces = useMemo(() => {
    const byId = new Map<string, MapPlace>();
    for (const place of [...researchPlaces, ...itineraryPlaces]) {
      if (!byId.has(place.googlePlaceId)) {
        byId.set(place.googlePlaceId, place);
      }
    }
    return Array.from(byId.values());
  }, [researchPlaces, itineraryPlaces]);

  const itineraryMarkerIcon = useMemo(
    () =>
      L.divIcon({
        className: "itinerary-marker",
        html: '<div class="itinerary-marker__dot"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -8],
      }),
    [],
  );

  return (
    <div className="h-full w-full relative z-0">
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
        {itineraryPlaces.map((place) => (
          <Marker
            key={`itinerary-${place.googlePlaceId}`}
            position={[place.latitude, place.longitude]}
            icon={itineraryMarkerIcon}
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
            </Popup>
          </Marker>
        ))}
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
