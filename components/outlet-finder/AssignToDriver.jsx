"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiEndpoints } from "@/lib/api";

export default function AssignToDriver({ outlets, onAssigned }) {
  const [drivers, setDrivers] = useState([]);
  const [driverId, setDriverId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    apiFetch(apiEndpoints.admin.drivers)
      .then((d) => setDrivers(d || []))
      .catch(() => setDrivers([]));
  }, []);

  async function assign() {
    if (!driverId || !outlets.length) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch(apiEndpoints.outletFinder.assignments, {
        method: "POST",
        body: JSON.stringify({
          driver_employee_id: Number(driverId),
          external_ids: outlets.map((o) => o.external_id),
          note: note.trim() || null,
        }),
      });
      const driver = drivers.find((d) => d.id === Number(driverId));
      setMsg({ type: "ok", text: `Assigned ${res.total_count} outlets to ${driver?.name || "driver"}.` });
      setNote("");
      onAssigned?.(res);
    } catch (e) {
      setMsg({ type: "err", text: e.message || "Could not assign." });
    } finally {
      setBusy(false);
    }
  }

  if (!outlets.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <p className="text-sm font-medium text-slate-700">Assign these {outlets.length} outlets to a driver</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        >
          <option value="">Select driver…</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.email})
            </option>
          ))}
        </select>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
        <button
          onClick={assign}
          disabled={busy || !driverId}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          {busy ? "Assigning…" : "Assign to driver"}
        </button>
      </div>
      {msg && (
        <p className={`text-sm ${msg.type === "ok" ? "text-emerald-700" : "text-rose-600"}`}>{msg.text}</p>
      )}
    </div>
  );
}
