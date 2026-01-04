"use client";

import L from "leaflet";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { useMapStore } from "@/lib/map-store";

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

function MapController({ places }: { places: any[] }) {
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

  useEffect(() => {
    fixLeafletIcons();
  }, []);

  const places = useMemo(() => {
    const list = [
      ...(activeResearch?.places ?? []),
      ...pinnedResearch.flatMap((layer) => layer.places),
    ];
    const byId = new Map(list.map((place) => [place.googlePlaceId, place]));
    return Array.from(byId.values());
  }, [activeResearch, pinnedResearch]);

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
        <MapController places={places} />
        {places.map((place, index) => (
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
