"use client";

import { useMemo, useState } from "react";
import { apiFetch, apiEndpoints } from "@/lib/api";
import { fingerprintOutlets, getCurrentPos, optimizeRoute } from "@/lib/route";
import RouteView from "@/components/outlet-finder/RouteView";
import AssignToDriver from "@/components/outlet-finder/AssignToDriver";
import AssignmentsList from "@/components/outlet-finder/AssignmentsList";

export default function ManualFinder({ assignable = false }) {
  const [input, setInput] = useState("");
  const [route, setRoute] = useState(null); // { outlets, userPos }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState({ missingCoords: [], notFound: [] });
  const [assignedKey, setAssignedKey] = useState(0);

  async function findOutlets() {
    const ids = input.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    if (!ids.length) return;

    setLoading(true);
    setError("");
    setWarnings({ missingCoords: [], notFound: [] });

    try {
      const pos = await getCurrentPos();
      const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };

      const data = await apiFetch(apiEndpoints.outletFinder.retailersLookup, {
        method: "POST",
        body: JSON.stringify({ external_ids: ids }),
      });

      setWarnings({
        missingCoords: data.missing_coords || [],
        notFound: data.not_found || [],
      });

      if (!data.found?.length) {
        setRoute(null);
        setError("No outlets with coordinates found for those IDs.");
        return;
      }

      const optimized = await optimizeRoute(userPos.lat, userPos.lng, data.found);
      setRoute({ outlets: optimized, userPos });
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const fingerprint = useMemo(() => (route ? fingerprintOutlets(route.outlets) : ""), [route]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <label className="text-sm font-medium text-slate-700">Enter Outlet IDs</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && findOutlets()}
            placeholder="e.g. 707811, 390495"
            aria-label="Outlet IDs"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
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

      {route && (
        <>
          {assignable && (
            <AssignToDriver outlets={route.outlets} onAssigned={() => setAssignedKey((k) => k + 1)} />
          )}
          <RouteView key={fingerprint} outlets={route.outlets} userPos={route.userPos} allowRemove />
        </>
      )}

      {assignable && <AssignmentsList refreshKey={assignedKey} />}
    </div>
  );
}
