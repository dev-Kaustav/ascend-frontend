"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiEndpoints } from "@/lib/api";
import { getCurrentPos, optimizeRoute } from "@/lib/route";
import RouteView from "@/components/outlet-finder/RouteView";

function jobOutlets(job) {
  // Only outlets with coordinates can be routed.
  return job.items
    .filter((i) => i.latitude != null && i.longitude != null)
    .map((i) => ({
      external_id: i.external_id,
      name: i.name,
      address: i.address,
      latitude: i.latitude,
      longitude: i.longitude,
    }));
}

export default function DriverJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeJobId, setActiveJobId] = useState(null);
  const [route, setRoute] = useState(null); // { jobId, outlets, userPos }
  const [routing, setRouting] = useState(false);
  const [accepting, setAccepting] = useState(null);

  function load() {
    setLoading(true);
    apiFetch(apiEndpoints.outletFinder.assignmentsMine)
      .then((d) => {
        setJobs(d || []);
        setError("");
      })
      .catch((e) => setError(e.message || "Could not load your jobs."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function startRoute(job) {
    setRouting(true);
    setError("");
    try {
      const outlets = jobOutlets(job);
      if (!outlets.length) {
        setError("This job has no outlets with locations yet.");
        return;
      }
      const pos = await getCurrentPos();
      const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const optimized = await optimizeRoute(userPos.lat, userPos.lng, outlets);
      setRoute({ jobId: job.id, outlets: optimized, userPos });
      setActiveJobId(job.id);
    } catch (e) {
      setError(e.message || "Couldn't start the route. Allow location and try again.");
    } finally {
      setRouting(false);
    }
  }

  async function accept(job) {
    setAccepting(job.id);
    try {
      await apiFetch(apiEndpoints.outletFinder.assignmentAccept(job.id), { method: "POST" });
      load();
    } catch (e) {
      setError(e.message || "Couldn't accept the job.");
    } finally {
      setAccepting(null);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading your jobs…</p>;

  const pending = jobs.filter((j) => j.status !== "ACCEPTED");
  const accepted = jobs.filter((j) => j.status === "ACCEPTED");

  // If a route is active, show it.
  if (route) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setRoute(null); setActiveJobId(null); load(); }}
          className="text-sm font-medium text-indigo-600 hover:underline cursor-pointer"
        >
          ← Back to my jobs
        </button>
        <RouteView outlets={route.outlets} userPos={route.userPos} allowRemove={false} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>}

      {!jobs.length && (
        <p className="text-sm text-slate-500">No jobs assigned to you yet. Check back soon.</p>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">New jobs</p>
          {pending.map((j) => (
            <div key={j.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <p className="text-xl font-bold text-slate-900">{j.total_count} outlets to deliver</p>
              {j.note && <p className="text-sm text-slate-500">{j.note}</p>}
              <button
                onClick={() => accept(j)}
                disabled={accepting === j.id}
                className="w-full min-h-[56px] rounded-xl bg-emerald-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
              >
                {accepting === j.id ? "Accepting…" : "Accept Job"}
              </button>
            </div>
          ))}
        </div>
      )}

      {accepted.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">Accepted jobs</p>
          {accepted.map((j) => (
            <div key={j.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold text-slate-900">{j.total_count} outlets</p>
                <span className="text-sm text-slate-600">{j.delivered_count}/{j.total_count} done</span>
              </div>
              {j.note && <p className="text-sm text-slate-500">{j.note}</p>}
              <button
                onClick={() => startRoute(j)}
                disabled={routing}
                className="w-full min-h-[56px] rounded-xl bg-indigo-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
              >
                {routing && activeJobId === j.id ? "Starting…" : "Start Route"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
