"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, MapPin, Navigation, Pencil, Phone, Plus, X } from "lucide-react";
import SectionCard from "@/components/layout/SectionCard";
import { useToast } from "@/components/ui/ToastProvider";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatAccuracy, getCoords, mapsUrl } from "@/lib/geo";
import { loadMaps, normalizePlaceAddress, reverseGeocode } from "@/lib/store/maps.mjs";
import useOrderFormLookups from "@/lib/hooks/useOrderFormLookups";
import { INDIAN_STATES } from "@/lib/states";

// A salesman works this screen on a phone in a market: card list, no horizontal scroll, 44px
// targets, 16px inputs (which also stops iOS zooming the page when a field takes focus).
const FIELD_CLASSNAME =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-800 transition-colors placeholder:text-slate-400 focus:border-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/25";

const BLANK = {
  name: "",
  mobile_number: "",
  address_line1: "",
  city: "",
  state: "",
  pincode: "",
  gst_number: "",
  // Numbers, not strings, unlike every other field here — they come straight off the device
  // rather than a keyboard, and the API takes floats.
  latitude: null,
  longitude: null,
  accuracy_m: null
};

const asText = (value) => (value === null || value === undefined ? "" : String(value));
const orNull = (value) => (value === "" || value === undefined ? null : value);
const numOrNull = (value) => (value === "" || value === null || value === undefined ? null : Number(value));

const formatPhone = (value) => {
  if (!value && value !== 0) return null;
  const raw = String(value).replace(/\D/g, "");
  return raw.length === 10 ? `${raw.slice(0, 5)} ${raw.slice(5)}` : raw || null;
};

// Text on every pill, never colour alone — the status has to survive a greyscale screen or a
// colour-blind reader.
const STATUS_PILL = {
  PENDING: { label: "Pending approval", icon: Clock, className: "border-amber-200 bg-amber-50 text-amber-700" },
  REJECTED: { label: "Rejected", icon: X, className: "border-rose-200 bg-rose-50 text-rose-700" },
  WITHDRAWN: { label: "Withdrawn", icon: X, className: "border-slate-200 bg-slate-100 text-slate-500" }
};

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
      {children}
    </label>
  );
}

const DETECT_TEXT = {
  finding: "Finding your location…",
  found: "Address filled from your location",
  "no-address": "Location saved, but no address was found. Type the address.",
  failed: "Couldn't get your location. Type the address, or retry at the shop."
};

function DetectStatus({ detect, accuracy, onRetry }) {
  const precision = detect === "found" ? formatAccuracy(accuracy) : null;
  return (
    <p
      role="status"
      className={`flex items-start gap-1.5 text-sm ${detect === "failed" ? "text-amber-700" : "text-slate-500"}`}
    >
      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span>
        {DETECT_TEXT[detect]}
        {precision ? ` (${precision})` : ""}
        {detect !== "finding" ? (
          <>
            {" · "}
            <button type="button" onClick={onRetry} className="cursor-pointer font-semibold text-[#6d28d9] underline">
              Retry
            </button>
          </>
        ) : null}
      </span>
    </p>
  );
}

export default function MyRetailersPanel() {
  // The backend scopes this to retailers actually assigned to this salesman, which is exactly
  // the set they can book orders against — including ones they just added themselves.
  const { retailers, loading, error, refreshLookups } = useOrderFormLookups({
    errorMessage: "Unable to load your retailers."
  });
  const { notify } = useToast();
  const [requests, setRequests] = useState([]);
  const [requestsError, setRequestsError] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  // Where the new shop is, read from the phone the moment the form opens: "finding" | "found" |
  // "no-address" (a fix but Google had no address) | "failed" | null.
  const [detect, setDetect] = useState(null);
  const detectRun = useRef(0);
  // Fields the salesman has typed into: a slow address lookup must never overwrite them.
  const touched = useRef(new Set());

  const loadRequests = useCallback(async () => {
    try {
      const response = await apiFetch(apiEndpoints.retailerRequests.list);
      setRequests(Array.isArray(response) ? response : []);
      setRequestsError("");
    } catch (err) {
      setRequestsError(err?.payload?.detail || err?.message || "Unable to load your requests.");
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Only pending and rejected requests are worth showing: an approved one has already become a
  // real outlet in the list above, so rendering both would double it.
  const openRequests = useMemo(
    () => requests.filter((request) => request.status !== "APPROVED"),
    [requests]
  );

  const matches = useCallback(
    (row) => {
      const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!tokens.length) return true;
      const haystack = [row.name, row.city, row.mobile_number, row.gst_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    },
    [search]
  );

  const visibleRetailers = useMemo(() => (retailers || []).filter(matches), [retailers, matches]);
  const visibleRequests = useMemo(() => openRequests.filter(matches), [openRequests, matches]);

  const detectLocation = async () => {
    const run = ++detectRun.current;
    setDetect("finding");
    let coords;
    try {
      coords = await getCoords();
    } catch {
      if (run === detectRun.current) setDetect("failed");
      return;
    }
    if (run !== detectRun.current) return;
    setDraft((prev) => prev && { ...prev, ...coords });
    try {
      const result = await reverseGeocode({ maps: await loadMaps(), coords });
      if (run !== detectRun.current) return;
      if (!result) {
        setDetect("no-address");
        return;
      }
      const place = normalizePlaceAddress(result, INDIAN_STATES, { source: "detect", location: coords });
      const filled = { address_line1: place.line1, city: place.city, state: place.state, pincode: place.pincode };
      setDraft((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        for (const [field, value] of Object.entries(filled)) {
          if (value && !touched.current.has(field)) next[field] = value;
        }
        return next;
      });
      setDetect("found");
    } catch {
      // The fix is real even when the address lookup is not: keep the pin, type the address.
      if (run === detectRun.current) setDetect("no-address");
    }
  };

  const startCreate = () => {
    setDraft({ ...BLANK });
    setEditingId(null);
    setFormError("");
    touched.current = new Set();
    detectLocation();
  };

  const startEdit = (request) => {
    setDraft({
      ...Object.fromEntries(Object.keys(BLANK).map((key) => [key, asText(request[key])])),
      // Kept numeric: asText would turn these into strings the capture button cannot format
      // and the API would reject. accuracy_m is not stored on the request — a re-opened draft
      // shows the pin without claiming a precision we no longer know.
      latitude: request.latitude ?? null,
      longitude: request.longitude ?? null,
      accuracy_m: null
    });
    setEditingId(request.id);
    setFormError("");
  };

  const cancel = () => {
    detectRun.current += 1;
    setDetect(null);
    setDraft(null);
    setEditingId(null);
    setFormError("");
  };

  const setField = (field, value) => {
    touched.current.add(field);
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setFormError("");
    const body = {
      name: draft.name,
      mobile_number: numOrNull(draft.mobile_number),
      address_line1: orNull(draft.address_line1),
      city: orNull(draft.city),
      state: orNull(draft.state),
      pincode: numOrNull(draft.pincode),
      gst_number: orNull(draft.gst_number),
      latitude: draft.latitude ?? null,
      longitude: draft.longitude ?? null
    };
    try {
      await apiFetch(
        editingId ? apiEndpoints.retailerRequests.update(editingId) : apiEndpoints.retailerRequests.create,
        { method: editingId ? "PATCH" : "POST", body: JSON.stringify(body) }
      );
      // Without an edit id this creates the retailer outright (approval workflow disabled), so
      // the order picker has to be refreshed for the new outlet to be bookable.
      notify(editingId ? "Request updated." : "Retailer added. You can book orders for it now.");
      cancel();
      await Promise.all([loadRequests(), refreshLookups()]);
    } catch (err) {
      setFormError(err?.payload?.detail || err?.message || "Unable to submit the request.");
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async (request) => {
    try {
      await apiFetch(apiEndpoints.retailerRequests.withdraw(request.id), { method: "POST" });
      notify("Request withdrawn.");
      await loadRequests();
    } catch (err) {
      setRequestsError(err?.payload?.detail || err?.message || "Unable to withdraw the request.");
    }
  };

  const form = (
    <div className="space-y-3 rounded-2xl border border-[#7c3aed]/30 bg-[#7c3aed]/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {editingId ? "Edit request" : "New retailer"}
      </p>
      {detect ? <DetectStatus detect={detect} accuracy={draft?.accuracy_m} onRetry={detectLocation} /> : null}
      <Field label="Shop name">
        <input
          className={FIELD_CLASSNAME}
          value={draft?.name ?? ""}
          onChange={(event) => setField("name", event.target.value)}
          placeholder="Shop name"
          autoFocus
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mobile">
          <input
            className={FIELD_CLASSNAME}
            inputMode="numeric"
            value={draft?.mobile_number ?? ""}
            onChange={(event) => setField("mobile_number", event.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10 digits"
          />
        </Field>
        <Field label="City">
          <input
            className={FIELD_CLASSNAME}
            value={draft?.city ?? ""}
            onChange={(event) => setField("city", event.target.value)}
            placeholder="City"
          />
        </Field>
      </div>
      <Field label="Address">
        <input
          className={FIELD_CLASSNAME}
          value={draft?.address_line1 ?? ""}
          onChange={(event) => setField("address_line1", event.target.value)}
          placeholder="Shop no., street, area"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="State">
          <select
            className={FIELD_CLASSNAME}
            value={draft?.state ?? ""}
            onChange={(event) => setField("state", event.target.value)}
          >
            <option value="">Select state</option>
            {INDIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pincode">
          <input
            className={FIELD_CLASSNAME}
            inputMode="numeric"
            value={draft?.pincode ?? ""}
            onChange={(event) => setField("pincode", event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6 digits"
          />
        </Field>
      </div>
      <Field label="GST number">
        <input
          className={FIELD_CLASSNAME}
          value={draft?.gst_number ?? ""}
          onChange={(event) => setField("gst_number", event.target.value)}
          placeholder="Optional"
        />
      </Field>
      {formError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{formError}</p>
      ) : null}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={submit}
          disabled={saving || !(draft?.name || "").trim()}
          className="h-11 flex-1 cursor-pointer rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
        >
          {saving ? "Saving…" : editingId ? "Save changes" : "Add retailer"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="h-11 cursor-pointer rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading your retailers…
      </div>
    );
  }

  if (error) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">{error}</div>;
  }

  const nothingToShow = visibleRetailers.length === 0 && visibleRequests.length === 0 && !draft;

  return (
    <SectionCard
      title="My Retailers"
      subtitle={`${visibleRetailers.length} outlets${openRequests.length ? ` · ${openRequests.length} older requests` : ""}`}
      actions={
        <button
          type="button"
          onClick={startCreate}
          disabled={Boolean(draft)}
          className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add retailer
        </button>
      }
    >
      <div className="space-y-3">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search your outlets"
          aria-label="Search your outlets"
          className={FIELD_CLASSNAME}
        />

        {draft && !editingId ? form : null}

        {requestsError ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {requestsError}
          </p>
        ) : null}

        {nothingToShow ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            {(retailers || []).length === 0 && openRequests.length === 0
              ? "No outlets yet. Add your first retailer to start booking orders."
              : "No outlets match that search."}
          </p>
        ) : null}

        <ul className="space-y-2.5">
          {visibleRequests.map((request) => {
            if (editingId === request.id) {
              return <li key={`request-${request.id}`}>{form}</li>;
            }
            const pill = STATUS_PILL[request.status] || STATUS_PILL.PENDING;
            const place = [request.address_line1, request.city].filter(Boolean).join(", ");
            const phone = formatPhone(request.mobile_number);
            const isPending = request.status === "PENDING";
            return (
              <li
                key={`request-${request.id}`}
                // Greyed and dashed: this outlet is not real yet and cannot take an order.
                className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 opacity-60">
                    <p className="font-semibold text-slate-900">{request.name}</p>
                    {place ? (
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                        <span>{place}</span>
                      </p>
                    ) : null}
                    {phone ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                        <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                        <span className="tabular-nums">{phone}</span>
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 self-start rounded-full border px-2.5 py-1 text-[11px] font-semibold ${pill.className}`}
                  >
                    <pill.icon className="h-3 w-3" strokeWidth={2.5} />
                    {pill.label}
                  </span>
                </div>
                {request.review_note ? (
                  <p className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    <span className="font-semibold">Admin note:</span> {request.review_note}
                  </p>
                ) : null}
                {isPending ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(request)}
                      disabled={Boolean(draft)}
                      className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => withdraw(request)}
                      disabled={Boolean(draft)}
                      className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                      Withdraw
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}

          {visibleRetailers.map((retailer) => {
            const phone = formatPhone(retailer.mobile_number);
            const place = [retailer.address_line1, retailer.city].filter(Boolean).join(", ");
            return (
              <li key={`retailer-${retailer.id}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="font-semibold text-slate-900">{retailer.name}</p>
                {place ? (
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    <span>{place}</span>
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {phone ? (
                    <a href={`tel:${retailer.mobile_number}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600">
                      <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      <span className="tabular-nums">{phone}</span>
                    </a>
                  ) : null}
                  <a
                    href={mapsUrl(retailer)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600"
                  >
                    <Navigation className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    Map
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </SectionCard>
  );
}
