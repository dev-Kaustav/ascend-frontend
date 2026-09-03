"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import RouteLauncher from "@/components/outlet-finder/RouteLauncher";
import RouteStops from "@/components/outlet-finder/RouteStops";
import { buildLegs, buildMapsUrl, fingerprintOutlets, recomputeDistances } from "@/lib/route";
import useStoredValue, { writeStored } from "@/lib/hooks/useStoredValue";

const OutletMap = dynamic(() => import("@/components/outlet-finder/OutletMap"), { ssr: false });

const LEG_STORAGE_PREFIX = "outletFinder.legIndex.";
const LAUNCHED_STORAGE_PREFIX = "outletFinder.launchedLegs.";
const DELIVERY_STORAGE_PREFIX = "outletFinder.deliveries.";

export default function RouteView({ outlets: initialOutlets, userPos, allowRemove = false }) {
  const [outlets, setOutlets] = useState(initialOutlets);
  const [showMap, setShowMap] = useState(false);

  const legs = useMemo(() => buildLegs(userPos, outlets), [userPos, outlets]);
  const fingerprint = useMemo(() => fingerprintOutlets(outlets), [outlets]);
  const legStorageKey = fingerprint ? LEG_STORAGE_PREFIX + fingerprint : null;
  const launchedStorageKey = fingerprint ? LAUNCHED_STORAGE_PREFIX + fingerprint : null;
  const deliveryStorageKey = fingerprint ? DELIVERY_STORAGE_PREFIX + fingerprint : null;

  // These three were mirrored into state by effects that read localStorage and called
  // setState — a render with the default followed immediately by a render with the stored
  // value, on every key change. localStorage is now the source of truth and the values are
  // derived from it during render; writes notify the store, so React re-renders on its own.
  const storedLeg = useStoredValue(legStorageKey);
  const storedLaunched = useStoredValue(launchedStorageKey);
  const storedDeliveries = useStoredValue(deliveryStorageKey);

  const currentLegIndex = useMemo(() => {
    const parsed = storedLeg ? parseInt(storedLeg, 10) : 0;
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(Math.max(parsed, 0), Math.max(0, legs.length - 1));
  }, [storedLeg, legs.length]);

  const launchedLegs = useMemo(() => {
    if (!storedLaunched) return [];
    try {
      const parsed = JSON.parse(storedLaunched);
      return Array.isArray(parsed) ? parsed.filter((i) => i < legs.length) : [];
    } catch {
      return [];
    }
  }, [storedLaunched, legs.length]);

  const deliveryStates = useMemo(() => {
    if (!storedDeliveries) return {};
    try {
      return JSON.parse(storedDeliveries) || {};
    } catch {
      return {};
    }
  }, [storedDeliveries]);

  function updateDeliveryState(externalId, next) {
    const updated = { ...deliveryStates };
    if (next === null) {
      delete updated[externalId];
    } else {
      updated[externalId] = next;
    }
    writeStored(deliveryStorageKey, Object.keys(updated).length === 0 ? null : JSON.stringify(updated));
  }

  function handleCoordsUpdated(externalId, lat, lng) {
    setOutlets((prev) =>
      prev.map((o) => (o.external_id === externalId ? { ...o, latitude: lat, longitude: lng } : o))
    );
  }

  function persistLegIndex(i) {
    writeStored(legStorageKey, String(i));
  }

  function selectLeg(i) {
    persistLegIndex(i);
  }

  function markLaunched(i) {
    const next = launchedLegs.includes(i) ? launchedLegs : [...launchedLegs, i];
    writeStored(launchedStorageKey, JSON.stringify(next));
    // Advance selection to the next leg not yet launched (fall back to i + 1).
    const upcoming = legs.findIndex((_, idx) => idx > i && !next.includes(idx));
    const target = upcoming !== -1 ? upcoming : Math.min(i + 1, legs.length - 1);
    persistLegIndex(target);
  }

  function resetLegs() {
    writeStored(legStorageKey, null);
    writeStored(launchedStorageKey, null);
  }

  function removeOutlet(index) {
    if (!allowRemove) return;
    setOutlets((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (!userPos) return next;
      return recomputeDistances(next, userPos.lat, userPos.lng);
    });
  }

  if (!outlets.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          {outlets.length} outlet{outlets.length !== 1 ? "s" : ""} — optimized route
        </p>
        <button
          onClick={() => setShowMap((v) => !v)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          {showMap ? "Hide Map" : "Show Map"}
        </button>
      </div>

      {showMap && userPos && (
        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm" style={{ height: 320 }}>
          <OutletMap userPos={userPos} outlets={outlets} />
        </div>
      )}

      <RouteStops
        outlets={outlets}
        userPos={userPos}
        deliveryStates={deliveryStates}
        onDeliveryChange={updateDeliveryState}
        onCoordsUpdated={handleCoordsUpdated}
        onRemove={allowRemove ? removeOutlet : null}
      />

      {legs.length > 0 && (
        <RouteLauncher
          legs={legs}
          selectedIndex={Math.min(currentLegIndex, legs.length - 1)}
          launchedLegs={launchedLegs}
          buildMapsUrl={buildMapsUrl}
          onSelect={selectLeg}
          onLaunched={markLaunched}
          onReset={resetLegs}
        />
      )}
    </div>
  );
}
