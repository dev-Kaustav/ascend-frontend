"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons broken by webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const userIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: "hue-rotate-[120deg]", // green tint for user marker
});

function FitBounds({ userPos, outlets }) {
  const map = useMap();
  useEffect(() => {
    const points = [
      [userPos.lat, userPos.lng],
      ...outlets.map((o) => [o.latitude, o.longitude]),
    ];
    if (points.length > 1) {
      map.fitBounds(points, { padding: [32, 32] });
    }
  }, [map, userPos, outlets]);
  return null;
}

export default function OutletMap({ userPos, outlets }) {
  return (
    <MapContainer
      center={[userPos.lat, userPos.lng]}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FitBounds userPos={userPos} outlets={outlets} />

      <Marker position={[userPos.lat, userPos.lng]} icon={userIcon}>
        <Popup>You are here</Popup>
      </Marker>

      {outlets.map((outlet, index) => (
        <Marker key={outlet.external_id} position={[outlet.latitude, outlet.longitude]}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{index + 1}. {outlet.name}</p>
              {outlet.address && <p className="text-slate-500 text-xs mt-0.5">{outlet.address}</p>}
              <a
                href={`https://www.google.com/maps?q=${outlet.latitude},${outlet.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 text-xs mt-1 inline-block"
              >
                Open in Maps →
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
