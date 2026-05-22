"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import RouteLauncher from "@/components/outlet-finder/RouteLauncher";
import RouteStops from "@/components/outlet-finder/RouteStops";
import { buildLegs, buildMapsUrl, fingerprintOutlets, recomputeDistances } from "@/lib/route";

const OutletMap = dynamic(() => import("@/components/outlet-finder/OutletMap"), { ssr: false });

const LEG_STORAGE_PREFIX = "outletFinder.legIndex.";
const DELIVERY_STORAGE_PREFIX = "outletFinder.deliveries.";

export default function RouteView({ outlets: initialOutlets, userPos, allowRemove = false }) {
  const [outlets, setOutlets] = useState(initialOutlets);
  const [showMap, setShowMap] = useState(false);
  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const [deliveryStates, setDeliveryStates] = useState({});

  const legs = useMemo(() => buildLegs(userPos, outlets), [userPos, outlets]);
  const fingerprint = useMemo(() => fingerprintOutlets(outlets), [outlets]);
  const legStorageKey = fingerprint ? LEG_STORAGE_PREFIX + fingerprint : null;
  const deliveryStorageKey = fingerprint ? DELIVERY_STORAGE_PREFIX + fingerprint : null;

  useEffect(() => {
    if (!legStorageKey || typeof window === "undefined") return;
    const stored = window.localStorage.getItem(legStorageKey);
    const parsed = stored ? parseInt(stored, 10) : 0;
    setCurrentLegIndex(Number.isFinite(parsed) ? Math.min(parsed, Math.max(0, legs.length - 1)) : 0);
  }, [legStorageKey, legs.length]);

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
      prev.map((o) => (o.external_id === externalId ? { ...o, latitude: lat, longitude: lng } : o))
    );
  }

  function advanceLeg() {
    setCurrentLegIndex((prev) => {
      const next = Math.min(prev + 1, legs.length);
      if (legStorageKey && typeof window !== "undefined") {
        window.localStorage.setItem(legStorageKey, String(next));
      }
      return next;
    });
  }

  function resetLegs() {
    setCurrentLegIndex(0);
    if (legStorageKey && typeof window !== "undefined") {
      window.localStorage.removeItem(legStorageKey);
    }
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
          currentLegIndex={currentLegIndex}
          buildMapsUrl={buildMapsUrl}
          onAdvance={advanceLeg}
          onReset={resetLegs}
        />
      )}
    </div>
  );
}
