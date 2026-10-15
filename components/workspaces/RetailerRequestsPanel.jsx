"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, MapPin, Phone, User, X } from "lucide-react";
import SectionCard from "@/components/layout/SectionCard";
import { useToast } from "@/components/ui/ToastProvider";
import { apiEndpoints, apiFetch, invalidateApiCache } from "@/lib/api";

const FILTERS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "", label: "All" }
];

const STATUS_PILL = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  WITHDRAWN: "border-slate-200 bg-slate-100 text-slate-500"
};

const formatPhone = (value) => {
  if (!value && value !== 0) return null;
  const raw = String(value).replace(/\D/g, "");
  return raw.length === 10 ? `${raw.slice(0, 5)} ${raw.slice(5)}` : raw || null;
};

export default function RetailerRequestsPanel() {
  const { notify } = useToast();
  const [status, setStatus] = useState("PENDING");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = status ? `?status=${status}` : "";
      const response = await apiFetch(`${apiEndpoints.retailerRequests.list}${query}`);
      setRequests(Array.isArray(response) ? response : []);
      setError("");
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to load retailer requests.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (request, action, reviewNote) => {
    setBusyId(request.id);
    try {
      await apiFetch(apiEndpoints.retailerRequests[action](request.id), {
        method: "POST",
        body: JSON.stringify({ note: reviewNote || null })
      });
      notify(action === "approve" ? `${request.name} approved.` : `${request.name} rejected.`);
      setRejectingId(null);
      setNote("");
      // Approval adds a retailer, so the directory's cached lookups are now stale.
      invalidateApiCache(apiEndpoints.admin.lookups);
      await load();
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to record that decision.");
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === "PENDING").length,
    [requests]
  );

  return (
    <SectionCard
      title="Retailer Requests"
      subtitle={
        status === "PENDING"
          ? `${pendingCount} awaiting your review`
          : `${requests.length} ${status ? status.toLowerCase() : "total"}`
      }
      actions={
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => {
            const isActive = status === filter.value;
            return (
              <button
                key={filter.label}
                type="button"
                onClick={() => setStatus(filter.value)}
                className={`cursor-pointer rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      }
    >
      {error ? (
        <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
      ) : null}

      {loading ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
          Loading requests…
        </p>
      ) : requests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
          {status === "PENDING" ? "Nothing waiting for review." : "No requests here."}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {requests.map((request) => {
            const phone = formatPhone(request.mobile_number);
            const address = [request.address_line1, request.address_line2, request.city, request.state, request.pincode]
              .filter(Boolean)
              .join(", ");
            const isPending = request.status === "PENDING";
            return (
              <li key={request.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{request.name}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                      <User className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      Requested by {request.requested_by_name || `employee #${request.requested_by_employee_id}`}
                    </p>
                    {address ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                        <span>{address}</span>
                      </p>
                    ) : null}
                    {phone ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                        <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                        <span className="tabular-nums">{phone}</span>
                      </p>
                    ) : null}
                    {request.gst_number ? (
                      <p className="mt-0.5 text-sm text-slate-500">GST {request.gst_number}</p>
                    ) : null}
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      STATUS_PILL[request.status] || STATUS_PILL.PENDING
                    }`}
                  >
                    {request.status}
                  </span>
                </div>

                {request.review_note ? (
                  <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-semibold">Note:</span> {request.review_note}
                  </p>
                ) : null}

                {isPending && rejectingId === request.id ? (
                  <div className="mt-3 space-y-2">
                    <label htmlFor={`note-${request.id}`} className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      Reason for rejection
                    </label>
                    <input
                      id={`note-${request.id}`}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Tell the salesman why"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-800 focus:border-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/25"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => decide(request, "reject", note)}
                        disabled={busyId === request.id}
                        className="h-11 cursor-pointer rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-40"
                      >
                        Confirm rejection
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingId(null);
                          setNote("");
                        }}
                        className="h-11 cursor-pointer rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {isPending && rejectingId !== request.id ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => decide(request, "approve")}
                      disabled={busyId === request.id}
                      className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
                    >
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                      {busyId === request.id ? "Approving…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(request.id);
                        setNote("");
                      }}
                      disabled={busyId === request.id}
                      className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                    >
                      <X className="h-4 w-4" strokeWidth={2.5} />
                      Reject
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
