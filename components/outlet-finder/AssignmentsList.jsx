"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiEndpoints } from "@/lib/api";

export default function AssignmentsList({ refreshKey }) {
  const [jobs, setJobs] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Flip back to loading when the caller asks for a refresh. Adjusting state during render
  // is React's documented pattern for reacting to a changed prop; doing it in an effect
  // would render once with stale data before the spinner appeared.
  const [loadedKey, setLoadedKey] = useState(refreshKey);
  if (loadedKey !== refreshKey) {
    setLoadedKey(refreshKey);
    setLoading(true);
  }

  useEffect(() => {
    let cancelled = false;
    apiFetch(apiEndpoints.outletFinder.assignments)
      .then((d) => { if (!cancelled) setJobs(d || []); })
      .catch(() => { if (!cancelled) setJobs([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 cursor-pointer"
      >
        <span>Assigned jobs {jobs.length ? `(${jobs.length})` : ""}</span>
        <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {loading && <p className="px-4 py-3 text-sm text-slate-400">Loading…</p>}
          {!loading && !jobs.length && <p className="px-4 py-3 text-sm text-slate-400">No jobs yet.</p>}
          {jobs.map((j) => (
            <div key={j.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{j.driver_name || `Driver #${j.driver_employee_id}`}</p>
                <p className="text-xs text-slate-400">
                  {new Date(j.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  {j.note ? ` · ${j.note}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate-600">{j.delivered_count}/{j.total_count} done</span>
                <span
                  className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                    j.status === "ACCEPTED"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {j.status === "ACCEPTED" ? "Accepted" : "Pending"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
