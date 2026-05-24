"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import RouteLauncher from "@/components/outlet-finder/RouteLauncher";
import RouteStops from "@/components/outlet-finder/RouteStops";
import { buildLegs, buildMapsUrl, fingerprintOutlets, recomputeDistances } from "@/lib/route";

const OutletMap = dynamic(() => import("@/components/outlet-finder/OutletMap"), { ssr: false });

const LEG_STORAGE_PREFIX = "outletFinder.legIndex.";
const LAUNCHED_STORAGE_PREFIX = "outletFinder.launchedLegs.";
const DELIVERY_STORAGE_PREFIX = "outletFinder.deliveries.";

export default function RouteView({ outlets: initialOutlets, userPos, allowRemove = false }) {
  const [outlets, setOutlets] = useState(initialOutlets);
  const [showMap, setShowMap] = useState(false);
  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const [launchedLegs, setLaunchedLegs] = useState([]);
  const [deliveryStates, setDeliveryStates] = useState({});

  const legs = useMemo(() => buildLegs(userPos, outlets), [userPos, outlets]);
  const fingerprint = useMemo(() => fingerprintOutlets(outlets), [outlets]);
  const legStorageKey = fingerprint ? LEG_STORAGE_PREFIX + fingerprint : null;
  const launchedStorageKey = fingerprint ? LAUNCHED_STORAGE_PREFIX + fingerprint : null;
  const deliveryStorageKey = fingerprint ? DELIVERY_STORAGE_PREFIX + fingerprint : null;

  useEffect(() => {
    if (!legStorageKey || typeof window === "undefined") return;
    const stored = window.localStorage.getItem(legStorageKey);
    const parsed = stored ? parseInt(stored, 10) : 0;
    setCurrentLegIndex(Number.isFinite(parsed) ? Math.min(parsed, Math.max(0, legs.length - 1)) : 0);
  }, [legStorageKey, legs.length]);

  useEffect(() => {
    if (!launchedStorageKey || typeof window === "undefined") {
      setLaunchedLegs([]);
      return;
    }
    const stored = window.localStorage.getItem(launchedStorageKey);
    try {
      const parsed = stored ? JSON.parse(stored) : [];
      setLaunchedLegs(Array.isArray(parsed) ? parsed.filter((i) => i < legs.length) : []);
    } catch {
      setLaunchedLegs([]);
    }
  }, [launchedStorageKey, legs.length]);

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

  function persistLegIndex(i) {
    if (legStorageKey && typeof window !== "undefined") {
      window.localStorage.setItem(legStorageKey, String(i));
    }
  }

  function selectLeg(i) {
    setCurrentLegIndex(i);
    persistLegIndex(i);
  }

  function markLaunched(i) {
    setLaunchedLegs((prev) => {
      const next = prev.includes(i) ? prev : [...prev, i];
      if (launchedStorageKey && typeof window !== "undefined") {
        window.localStorage.setItem(launchedStorageKey, JSON.stringify(next));
      }
      // Advance selection to the next leg not yet launched (fall back to i + 1).
      const upcoming = legs.findIndex((_, idx) => idx > i && !next.includes(idx));
      const target = upcoming !== -1 ? upcoming : Math.min(i + 1, legs.length - 1);
      setCurrentLegIndex(target);
      persistLegIndex(target);
      return next;
    });
  }

  function resetLegs() {
    setCurrentLegIndex(0);
    setLaunchedLegs([]);
    if (legStorageKey && typeof window !== "undefined") {
      window.localStorage.removeItem(legStorageKey);
    }
    if (launchedStorageKey && typeof window !== "undefined") {
      window.localStorage.removeItem(launchedStorageKey);
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
