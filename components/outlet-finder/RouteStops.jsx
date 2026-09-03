"use client";

import { useEffect, useState } from "react";
import { haversineKm } from "@/lib/geo";
import MarkDeliveredButton from "@/components/outlet-finder/MarkDeliveredButton";

const OUTLET_NEAR_M = 150;

function firstUndeliveredId(outlets, deliveryStates) {
  const next = outlets.find((o) => deliveryStates[o.external_id]?.status !== "delivered");
  return next ? next.external_id : null;
}

function formatTime(iso) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function RouteStops({
  outlets,
  userPos,
  deliveryStates,
  onDeliveryChange,
  onCoordsUpdated,
  onRemove,
}) {
  // Focus is derived, not stored: a tap on a stop overrides it, and the override falls away
  // once that stop leaves the route. Mirroring this into state via an effect re-rendered
  // every time the route or delivery state changed.
  const [focusOverride, setFocusOverride] = useState(null);
  const focusedId =
    focusOverride && outlets.some((o) => o.external_id === focusOverride)
      ? focusOverride
      : firstUndeliveredId(outlets, deliveryStates);

  // Keyed to the stop it was taken for, so a stale reading is never shown against a new
  // focus and the effect never has to clear it synchronously.
  const [gpsReading, setGpsReading] = useState(null);
  const focusPos = gpsReading && gpsReading.id === focusedId ? gpsReading.pos : null;

  // Read GPS once whenever focus changes, for the proximity hint.
  useEffect(() => {
    if (!focusedId || typeof navigator === "undefined" || !navigator.geolocation) return undefined;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled) {
          setGpsReading({ id: focusedId, pos: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
        }
      },
      () => {
        if (!cancelled) setGpsReading({ id: focusedId, pos: null });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
    return () => {
      cancelled = true;
    };
  }, [focusedId]);

  function proximityFor(outlet) {
    if (!focusPos || outlet.latitude == null || outlet.longitude == null) {
      return { distanceM: null, isFar: true };
    }
    const distanceM = haversineKm(focusPos.lat, focusPos.lng, outlet.latitude, outlet.longitude) * 1000;
    return { distanceM, isFar: distanceM > OUTLET_NEAR_M };
  }

  function handleDelivery(externalId, next) {
    onDeliveryChange(externalId, next);
    // Auto-advance focus to the next undelivered stop on successful delivery.
    if (next?.status === "delivered") {
      const remaining = outlets.filter(
        (o) => o.external_id !== externalId && deliveryStates[o.external_id]?.status !== "delivered"
      );
      setFocusOverride(remaining.length ? remaining[0].external_id : null);
    }
  }

  return (
    <div className="space-y-3">
      {outlets.map((outlet, index) => {
        const dstate = deliveryStates[outlet.external_id];
        const delivered = dstate?.status === "delivered";
        const focused = outlet.external_id === focusedId;

        // Collapsed (not focused): compact tappable row.
        if (!focused) {
          return (
            <button
              key={outlet.external_id}
              onClick={() => setFocusOverride(outlet.external_id)}
              className="w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex items-center gap-3 active:bg-slate-50 transition-colors cursor-pointer"
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  delivered ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
                }`}
              >
                {delivered ? "✓" : index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-semibold truncate ${delivered ? "text-slate-500" : "text-slate-900"}`}>
                  {outlet.name}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {delivered
                    ? `Delivered ${formatTime(dstate.time)}`
                    : `ID ${outlet.external_id} · ${outlet.distFromOrigin.toFixed(1)} km`}
                </p>
              </div>
              <span aria-hidden className="shrink-0 text-slate-300 text-lg">›</span>
            </button>
          );
        }

        // Expanded (focused): full card with the single Mark Delivered action.
        return (
          <div
            key={outlet.external_id}
            className={`rounded-xl border bg-white p-4 shadow-sm flex items-start gap-3 ${
              delivered ? "border-l-4 border-l-emerald-500 border-slate-200" : "border-slate-200"
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold mt-0.5 ${
                delivered ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
              }`}
            >
              {delivered ? "✓" : index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold text-slate-900 leading-tight">{outlet.name}</p>
              <p className="text-xs text-slate-400 mt-1">ID: {outlet.external_id}</p>
              {outlet.address && <p className="text-xs text-slate-500 mt-0.5">{outlet.address}</p>}
              <p className="text-xs text-slate-600 mt-1">
                <span className="font-medium">From start:</span>{" "}
                {outlet.distFromOrigin.toFixed(2)} km
              </p>
              <a
                href={`https://www.google.com/maps?q=${outlet.latitude},${outlet.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-1.5 text-xs font-medium text-indigo-600 hover:underline"
              >
                Open in Maps →
              </a>
              <MarkDeliveredButton
                outlet={outlet}
                state={dstate}
                proximity={delivered ? null : proximityFor(outlet)}
                onChange={(next) => handleDelivery(outlet.external_id, next)}
                onCoordsUpdated={onCoordsUpdated}
              />
            </div>
            {onRemove && (
              <button
                onClick={() => onRemove(index)}
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors text-lg leading-none cursor-pointer"
                aria-label="Remove outlet"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
