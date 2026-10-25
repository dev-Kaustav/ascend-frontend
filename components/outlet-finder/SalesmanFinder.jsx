"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import RouteView from "@/components/outlet-finder/RouteView";
import useOrderFormLookups from "@/lib/hooks/useOrderFormLookups";
import { getCoords, haversineKm, mapsUrl } from "@/lib/geo";
import { fingerprintOutlets, optimizeRoute } from "@/lib/route";

// The salesman's Find tab: their own outlets, nearest first, instead of typing outlet IDs. Tap
// Navigate for one shop, or tick several and plan a route through them.
const hasPin = (retailer) => retailer.latitude != null && retailer.longitude != null;

const placeOf = (retailer) =>
  [retailer.address_line1, retailer.address_line2, retailer.city].filter(Boolean).join(", ");

export default function SalesmanFinder() {
  const { retailers, loading, error } = useOrderFormLookups({ errorMessage: "Unable to load your outlets." });
  const [userPos, setUserPos] = useState(null);
  const [posError, setPosError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [route, setRoute] = useState(null);
  const [planning, setPlanning] = useState(false);

  const locate = useCallback(async () => {
    setPosError("");
    try {
      const coords = await getCoords();
      setUserPos({ lat: coords.latitude, lng: coords.longitude });
    } catch (err) {
      setPosError(err?.message || "Couldn't get your location.");
    }
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  const rows = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (retailers || [])
      .filter((r) => {
        if (!tokens.length) return true;
        const haystack = [r.name, r.address_line1, r.city, r.mobile_number].filter(Boolean).join(" ").toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      })
      .map((r) => ({
        ...r,
        distanceKm: userPos && hasPin(r) ? haversineKm(userPos.lat, userPos.lng, r.latitude, r.longitude) : null
      }))
      // Nearest first; shops without a saved pin go last, alphabetically.
      .sort((a, b) => {
        if (a.distanceKm === null || b.distanceKm === null) {
          if (a.distanceKm !== b.distanceKm) return a.distanceKm === null ? 1 : -1;
          return (a.name || "").localeCompare(b.name || "");
        }
        return a.distanceKm - b.distanceKm;
      });
  }, [retailers, search, userPos]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const planRoute = async () => {
    if (!userPos || planning) return;
    setPlanning(true);
    try {
      const outlets = (retailers || [])
        .filter((r) => selected.has(r.id) && hasPin(r))
        .map((r) => ({
          external_id: r.external_id || `#${r.id}`,
          name: r.name,
          address: placeOf(r) || null,
          latitude: r.latitude,
          longitude: r.longitude
        }));
      setRoute({ outlets: await optimizeRoute(userPos.lat, userPos.lng, outlets), userPos });
    } finally {
      setPlanning(false);
    }
  };

  const fingerprint = useMemo(() => (route ? fingerprintOutlets(route.outlets) : ""), [route]);

  if (route) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setRoute(null)}
          className="inline-flex h-11 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600"
        >
          ← Back to list
        </button>
        <RouteView key={fingerprint} outlets={route.outlets} userPos={route.userPos} allowRemove allowDelivery={false} />
      </div>
    );
  }

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">Loading your outlets…</div>;
  }
  if (error) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">{error}</div>;
  }

  return (
    <div className="space-y-3 pb-20">
      <input
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search your outlets"
        aria-label="Search your outlets"
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-800 placeholder:text-slate-400 focus:border-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/25"
      />
      {posError ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {posError} Without it the list can&apos;t be sorted by distance.{" "}
          <button type="button" onClick={locate} className="cursor-pointer font-semibold underline">
            Retry
          </button>
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
          {(retailers || []).length === 0 ? "No outlets yet. Add retailers from the Retailers tab." : "No outlets match that search."}
        </p>
      ) : null}
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const place = placeOf(r);
          const pinned = hasPin(r);
          return (
            <li key={r.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                disabled={!pinned}
                onChange={() => toggle(r.id)}
                aria-label={`Add ${r.name} to route`}
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[#7c3aed] disabled:cursor-not-allowed"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{r.name}</p>
                {place ? (
                  <p className="mt-0.5 flex items-start gap-1.5 text-sm text-slate-500">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    <span>{place}</span>
                  </p>
                ) : null}
                <p className={`mt-0.5 text-xs ${pinned ? "text-slate-500" : "text-amber-600"}`}>
                  {!pinned ? "No location saved" : r.distanceKm !== null ? `${r.distanceKm.toFixed(1)} km away` : null}
                </p>
              </div>
              <a
                href={mapsUrl(r)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600"
              >
                <Navigation className="h-3.5 w-3.5" strokeWidth={2} />
                Navigate
              </a>
            </li>
          );
        })}
      </ul>
      {selected.size > 0 ? (
        <div className="fixed inset-x-4 bottom-[calc(var(--field-nav-height)+env(safe-area-inset-bottom,0px)+12px)] z-20 lg:static lg:inset-auto">
          <button
            type="button"
            onClick={planRoute}
            disabled={!userPos || planning}
            className="h-12 w-full cursor-pointer rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-slate-700 disabled:opacity-40"
          >
            {planning ? "Planning…" : !userPos ? "Waiting for your location…" : `Plan route (${selected.size})`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
