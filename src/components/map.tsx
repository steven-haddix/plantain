"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";

// Fix for default marker icon missing in Leaflet + Next.js
// We do this inside the component to ensure it only runs on client
const fixLeafletIcons = () => {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;

    L.Icon.Default.mergeOptions({
        iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString(),
        iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
        shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
    });
};

export default function Map() {
    useEffect(() => {
        fixLeafletIcons();
    }, []);

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
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
            </MapContainer>
        </div>
    );
}
