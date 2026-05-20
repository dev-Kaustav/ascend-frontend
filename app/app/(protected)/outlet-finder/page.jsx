"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiEndpoints } from "@/lib/api";
import dynamic from "next/dynamic";
import RouteLauncher from "@/components/outlet-finder/RouteLauncher";
import RouteStops from "@/components/outlet-finder/RouteStops";
import { haversineKm } from "@/lib/geo";

const OutletMap = dynamic(() => import("@/components/outlet-finder/OutletMap"), { ssr: false });

const MAPS_BATCH_SIZE = 9;
const LEG_STORAGE_PREFIX = "outletFinder.legIndex.";
const DELIVERY_STORAGE_PREFIX = "outletFinder.deliveries.";

function recomputeDistances(outlets, userLat, userLng) {
  let curLat = userLat;
  let curLng = userLng;
  return outlets.map((o) => {
    const d = haversineKm(curLat, curLng, o.latitude, o.longitude);
    curLat = o.latitude;
    curLng = o.longitude;
    return { ...o, distFromPrev: d };
  });
}

async function optimizeWithOSRM(userLat, userLng, outlets) {
  const coords = [[userLng, userLat], ...outlets.map((o) => [o.longitude, o.latitude])];
  const coordStr = coords.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/trip/v1/driving/${coordStr}?source=first&roundtrip=false&annotations=distance,duration`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("OSRM request failed");
  const data = await res.json();
  if (data.code !== "Ok") throw new Error("OSRM returned error: " + data.code);

  const waypoints = data.waypoints;
  const outletWaypoints = waypoints.slice(1);
  const sorted = [...outlets];
  outletWaypoints.forEach((wp, inputIdx) => {
    sorted[wp.waypoint_index - 1] = outlets[inputIdx];
  });

  return recomputeDistances(sorted, userLat, userLng);
}

function greedyNearest(userLat, userLng, outlets) {
  const pool = [...outlets];
  const sorted = [];
  let curLat = userLat;
  let curLng = userLng;
  while (pool.length) {
    let nearestIdx = 0;
    let minDist = Infinity;
    pool.forEach((o, i) => {
      const d = haversineKm(curLat, curLng, o.latitude, o.longitude);
      if (d < minDist) { minDist = d; nearestIdx = i; }
    });
    const chosen = pool.splice(nearestIdx, 1)[0];
    sorted.push({ ...chosen, distFromPrev: minDist });
    curLat = chosen.latitude;
    curLng = chosen.longitude;
  }
  return sorted;
}

function buildLegs(userPos, outlets, batchSize = MAPS_BATCH_SIZE) {
  if (!userPos || !outlets.length) return [];
  const legs = [];
  let originStop = { latitude: userPos.lat, longitude: userPos.lng, name: "Your location" };

  for (let i = 0; i < outlets.length; i += batchSize) {
    const batch = outlets.slice(i, i + batchSize);
    const destination = batch[batch.length - 1];
    const waypoints = batch.slice(0, -1);
    // distFromPrev on each stop chains from userPos through every outlet; sum within the batch.
    const legDistance = batch.reduce((acc, stop) => acc + (stop.distFromPrev ?? 0), 0);

    legs.push({
      origin: originStop,
      destination,
      waypoints,
      stops: batch,
      distanceKm: legDistance,
    });
    originStop = destination;
  }
  return legs;
}

function buildMapsUrl({ origin, destination, waypoints }) {
  const coord = (s) => `${s.latitude},${s.longitude}`;
  const params = new URLSearchParams({
    api: "1",
    origin: coord(origin),
    destination: coord(destination),
    travelmode: "driving",
  });
  if (waypoints.length) {
    params.set("waypoints", waypoints.map(coord).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function fingerprintOutlets(outlets) {
  return outlets.map((o) => o.external_id).join(",");
}

export default function OutletFinderPage() {
  const [input, setInput] = useState("");
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState({ missingCoords: [], notFound: [] });
  const [showMap, setShowMap] = useState(false);
  const [userPos, setUserPos] = useState(null);
  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const [deliveryStates, setDeliveryStates] = useState({});

  const legs = useMemo(() => buildLegs(userPos, outlets), [userPos, outlets]);
  const fingerprint = useMemo(() => fingerprintOutlets(outlets), [outlets]);
  const storageKey = fingerprint ? LEG_STORAGE_PREFIX + fingerprint : null;
  const deliveryStorageKey = fingerprint ? DELIVERY_STORAGE_PREFIX + fingerprint : null;

  // Restore leg progress when the outlet set changes
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey);
    const parsed = stored ? parseInt(stored, 10) : 0;
    setCurrentLegIndex(Number.isFinite(parsed) ? Math.min(parsed, Math.max(0, legs.length - 1)) : 0);
  }, [storageKey, legs.length]);

  // Restore delivery states when the outlet set changes
  useEffect(() => {
    if (!deliveryStorageKey || typeof window === "undefined") {
      setDeliveryStates({});
      return;
    }
    const stored = window.localStorage.getItem(deliveryStorageKey);
    try {
      setDeliveryStates(stored ? JSON.parse(stored) : {});
    } catch {
      setDeliveryStates({});
    }
  }, [deliveryStorageKey]);

  function updateDeliveryState(externalId, next) {
    setDeliveryStates((prev) => {
      const updated = { ...prev };
      if (next === null) {
        delete updated[externalId];
      } else {
        updated[externalId] = next;
      }
      if (deliveryStorageKey && typeof window !== "undefined") {
        if (Object.keys(updated).length === 0) {
          window.localStorage.removeItem(deliveryStorageKey);
        } else {
          window.localStorage.setItem(deliveryStorageKey, JSON.stringify(updated));
        }
      }
      return updated;
    });
  }

  function handleCoordsUpdated(externalId, lat, lng) {
    setOutlets((prev) =>
      prev.map((o) =>
        o.external_id === externalId ? { ...o, latitude: lat, longitude: lng } : o
      )
    );
  }

  function persistLegIndex(idx) {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, String(idx));
  }

  function clearLegProgress() {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.removeItem(storageKey);
  }

  function advanceLeg() {
    setCurrentLegIndex((prev) => {
      const next = Math.min(prev + 1, legs.length);
      persistLegIndex(next);
      return next;
    });
  }

  function resetLegs() {
    setCurrentLegIndex(0);
    clearLegProgress();
  }

  async function findOutlets() {
    const ids = input.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    if (!ids.length) return;

    setLoading(true);
    setError("");
    setWarnings({ missingCoords: [], notFound: [] });
    setShowMap(false);

    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;
      setUserPos({ lat: userLat, lng: userLng });

      const data = await apiFetch(apiEndpoints.outletFinder.retailersLookup, {
        method: "POST",
        body: JSON.stringify({ external_ids: ids }),
      });

      setWarnings({
        missingCoords: data.missing_coords || [],
        notFound: data.not_found || [],
      });

      if (!data.found?.length) {
        setOutlets([]);
        setError("No outlets with coordinates found for those IDs.");
        return;
      }

      let sorted;
      try {
        sorted = await optimizeWithOSRM(userLat, userLng, data.found);
      } catch {
        sorted = greedyNearest(userLat, userLng, data.found);
      }

      setOutlets(sorted);
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function removeOutlet(index) {
    setOutlets((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (!userPos) return next;
      return recomputeDistances(next, userPos.lat, userPos.lng);
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Outlet Finder</h1>
          <p className="text-sm text-slate-500 mt-0.5">Plan a route across outlet IDs</p>
        </div>
        {outlets.length > 0 && (
          <button
            onClick={() => setShowMap((v) => !v)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            {showMap ? "Hide Map" : "Show Map"}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <label className="text-sm font-medium text-slate-700">Enter Outlet IDs</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && findOutlets()}
            placeholder="e.g. 707811, 390495"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
          />
          <button
            onClick={findOutlets}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            {loading ? "Optimizing..." : "Find & Route"}
          </button>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {warnings.notFound.length > 0 && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <span className="font-medium">Not in system:</span> {warnings.notFound.join(", ")}
          </p>
        )}
        {warnings.missingCoords.length > 0 && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <span className="font-medium">No coordinates set:</span>{" "}
            {warnings.missingCoords.map((r) => `${r.external_id} (${r.name})`).join(", ")}
          </p>
        )}
      </div>

      {/* Map */}
      {showMap && outlets.length > 0 && userPos && (
        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm" style={{ height: 320 }}>
          <OutletMap userPos={userPos} outlets={outlets} />
        </div>
      )}

      {/* Outlet cards */}
      {outlets.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">
            {outlets.length} outlet{outlets.length !== 1 ? "s" : ""} — optimized route
          </p>

          <RouteStops
            outlets={outlets}
            userPos={userPos}
            deliveryStates={deliveryStates}
            onDeliveryChange={updateDeliveryState}
            onCoordsUpdated={handleCoordsUpdated}
            onRemove={removeOutlet}
          />
        </div>
      )}

      {/* Driver launcher — sticky-feeling primary CTA */}
      {legs.length > 0 && (
        <RouteLauncher
          legs={legs}
          currentLegIndex={currentLegIndex}
          buildMapsUrl={buildMapsUrl}
          onAdvance={advanceLeg}
          onReset={resetLegs}
        />
      )}
    </div>
  );
}
