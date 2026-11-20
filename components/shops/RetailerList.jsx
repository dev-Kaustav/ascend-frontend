"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Clock, MapPin, Pencil, Phone, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SectionCard from "@/components/layout/SectionCard";
import MobileActionBar, { BAR_ACTION_PRIMARY, BAR_ACTION_SECONDARY } from "@/components/layout/MobileActionBar";
import { useToast } from "@/components/ui/ToastProvider";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { can } from "@/lib/policy";
import { formatAccuracy, getCoords } from "@/lib/geo";
import { daysAgo, formatPhone, ShopActions, ShopAvatar } from "@/components/shops/ShopParts";
import { loadMaps, normalizePlaceAddress, reverseGeocode } from "@/lib/store/maps.mjs";
import Pager from "@/components/tables/Pager";
import useShops, { useDebounced, useShopLabels, useShopsChanged } from "@/lib/hooks/useShops";
import { INDIAN_STATES } from "@/lib/states";

// The shop list, one screen for every role that has one: a card per shop with Call, Map and Order.
// Built for a phone in a market: no horizontal scroll, 44px targets, 16px inputs (which also stops
// iOS zooming the page when a field takes focus).
//
// What differs by role comes from lib/policy. A salesman sees their own shops (the server scopes
// /orders/lookups) and adds new ones through retailer requests. The office sees every shop with
// its salesman and beat, filters by salesman, and adds and edits shops directly.
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
  // Office only (manageRetailers): who sells to the shop and on which beat.
  assigned_salesman_id: "",
  beat_id: "",
  // Numbers, not strings, unlike every other field here — they come straight off the device
  // rather than a keyboard, and the API takes floats.
  latitude: null,
  longitude: null,
  accuracy_m: null
};

const asText = (value) => (value === null || value === undefined ? "" : String(value));
const orNull = (value) => (value === "" || value === undefined ? null : value);
const numOrNull = (value) => (value === "" || value === null || value === undefined ? null : Number(value));

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

// The office has thousands of shops; the server sends one page at a time.
const PAGE = 30;

/** `beatId` narrows the list to one beat ("none" for shops on no beat), for the beat screen. */
export default function RetailerList({ beatId = null }) {
  const { role } = useAuth();
  const router = useRouter();
  const manage = can(role, "manageRetailers");
  // A salesman's new shop goes through a retailer request; the office creates shops outright.
  const viaRequests = can(role, "addRetailer") && !manage;
  // Salesmen and beats for the office's filter and form.
  const { salesmen, beats } = useShopLabels(manage);
  const shopsChanged = useShopsChanged();
  const [salesmanFilter, setSalesmanFilter] = useState("");
  const [page, setPage] = useState(1);
  const { notify } = useToast();
  const [requests, setRequests] = useState([]);
  const [requestsError, setRequestsError] = useState("");
  const [search, setSearch] = useState("");
  // The server scopes this by role: a salesman gets the shops assigned to them, which is exactly
  // the set they can book orders against; the office gets every shop.
  const settledSearch = useDebounced(search.trim());
  const { shops, total, error, isPending, isPlaceholderData } = useShops({ search: settledSearch, salesmanId: salesmanFilter, beatId, page, pageSize: PAGE });
  // A new search or filter starts again from page 1.
  const [filterKey, setFilterKey] = useState("");
  const key = [settledSearch, salesmanFilter].join("|");
  if (key !== filterKey) {
    setFilterKey(key);
    setPage(1);
  }
  const [draft, setDraft] = useState(null);
  // The record the inline form is editing: { kind: "request" | "retailer", id }, or null.
  const [editing, setEditing] = useState(null);
  const editingId = editing?.id ?? null;
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [showMore, setShowMore] = useState(false);
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
    if (viaRequests) loadRequests();
  }, [loadRequests, viaRequests]);

  // Only pending and rejected requests are worth showing: an approved one has already become a
  // real outlet in the list above, so rendering both would double it.
  const openRequests = useMemo(
    () => requests.filter((request) => request.status !== "APPROVED"),
    [requests]
  );

  const matches = useCallback(
    (row) => {
      if (beatId && String(row.beat_id ?? "none") !== String(beatId)) return false;
      if (salesmanFilter && String(row.assigned_salesman_id ?? "") !== salesmanFilter) return false;
      const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!tokens.length) return true;
      const haystack = [row.name, row.city, row.mobile_number, row.gst_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    },
    [search, salesmanFilter, beatId]
  );

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
    // A shop added from a beat's screen starts on that beat.
    setDraft({ ...BLANK, beat_id: beatId && beatId !== "none" ? String(beatId) : "" });
    setEditing(null);
    setFormError("");
    setShowMore(false);
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
    setEditing({ kind: "request", id: request.id });
    setFormError("");
  };

  // The office edits a shop in place, with the same form plus its salesman and beat.
  const startEditRetailer = (retailer) => {
    setDraft({
      ...Object.fromEntries(Object.keys(BLANK).map((key) => [key, asText(retailer[key])])),
      latitude: retailer.latitude ?? null,
      longitude: retailer.longitude ?? null,
      accuracy_m: null
    });
    setEditing({ kind: "retailer", id: retailer.id });
    setFormError("");
    setShowMore(false);
  };

  const cancel = () => {
    detectRun.current += 1;
    setDetect(null);
    setDraft(null);
    setEditing(null);
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
      longitude: draft.longitude ?? null,
      ...(manage ? { assigned_salesman_id: numOrNull(draft.assigned_salesman_id), beat_id: numOrNull(draft.beat_id) } : {})
    };
    // The office writes shops directly; a salesman writes retailer requests.
    const url = manage
      ? editingId ? apiEndpoints.admin.retailerUpdate(editingId) : apiEndpoints.admin.retailers
      : editingId ? apiEndpoints.retailerRequests.update(editingId) : apiEndpoints.retailerRequests.create;
    try {
      await apiFetch(url, { method: editingId ? "PATCH" : "POST", body: JSON.stringify(body) });
      // A new request creates the retailer outright (approval workflow disabled), so the order
      // picker has to be refreshed for the new outlet to be bookable.
      notify(editingId ? (manage ? "Shop updated." : "Request updated.") : "Retailer added. You can book orders for it now.");
      cancel();
      await Promise.all([viaRequests ? loadRequests() : null, shopsChanged()]);
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
        {editing?.kind === "retailer" ? "Edit shop" : editingId ? "Edit request" : "New retailer"}
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
      <Field label="Mobile">
        <input
          className={FIELD_CLASSNAME}
          inputMode="numeric"
          value={draft?.mobile_number ?? ""}
          onChange={(event) => setField("mobile_number", event.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="10 digits"
        />
      </Field>
      {/* Pre-filled from the phone's location, and always editable. */}
      <Field label="Address">
        <input
          className={FIELD_CLASSNAME}
          value={draft?.address_line1 ?? ""}
          onChange={(event) => setField("address_line1", event.target.value)}
          placeholder="Shop no., street, area"
        />
      </Field>
      {manage ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Salesman">
            <select className={FIELD_CLASSNAME} value={draft?.assigned_salesman_id ?? ""} onChange={(event) => setField("assigned_salesman_id", event.target.value)}>
              <option value="">Unassigned</option>
              {salesmen.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Beat">
            <select className={FIELD_CLASSNAME} value={draft?.beat_id ?? ""} onChange={(event) => setField("beat_id", event.target.value)}>
              <option value="">No beat</option>
              {beats.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        </div>
      ) : null}
      {/* City, state, pincode and GST fill themselves from the location; tucked away so the
          form is three fields unless the salesman needs to correct one. */}
      <button
        type="button"
        onClick={() => setShowMore((value) => !value)}
        aria-expanded={showMore}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-1 text-left text-sm text-slate-500"
      >
        <span className="min-w-0 truncate">
          {[draft?.city, draft?.state, draft?.pincode].filter(Boolean).join(", ") || "City, state, pincode, GST"}
        </span>
        <span className="flex shrink-0 items-center gap-1 font-semibold text-[#6d28d9]">
          {showMore ? "Less" : "More details"}
          <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? "rotate-180" : ""}`} />
        </span>
      </button>
      {showMore ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <input
                className={FIELD_CLASSNAME}
                value={draft?.city ?? ""}
                onChange={(event) => setField("city", event.target.value)}
                placeholder="City"
              />
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
          <Field label="GST number">
            <input
              className={FIELD_CLASSNAME}
              value={draft?.gst_number ?? ""}
              onChange={(event) => setField("gst_number", event.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>
      ) : null}
      {formError ? (
        // On phones a create error shows in the bottom bar, next to the button that caused it.
        <p className={`rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 ${editingId ? "" : "hidden lg:block"}`}>{formError}</p>
      ) : null}
      <div className={`gap-2 pt-1 ${editingId ? "flex" : "hidden lg:flex"}`}>
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

  if (isPending) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading your retailers…
      </div>
    );
  }

  if (error) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">{error.message || "Unable to load your retailers."}</div>;
  }

  const nothingToShow = shops.length === 0 && visibleRequests.length === 0 && !draft;
  const canOrder = can(role, "createOrder");
  const canAdd = can(role, "addRetailer");

  return (
    <SectionCard
      title={manage || !viaRequests ? "Shops" : "My Retailers"}
      subtitle={`${total} ${total === 1 ? "shop" : "shops"}${openRequests.length ? ` · ${openRequests.length} older requests` : ""}`}
      actions={
        canAdd ? <button
          type="button"
          onClick={startCreate}
          disabled={Boolean(draft)}
          className="hidden h-11 cursor-pointer items-center gap-1.5 rounded-full bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-slate-700 disabled:opacity-40 lg:inline-flex"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add retailer
        </button> : null
      }
    >
      <div className="space-y-3">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={manage || !viaRequests ? "Search shops, city, phone or GST" : "Search your outlets"}
          aria-label="Search shops"
          className={FIELD_CLASSNAME}
        />
        {manage ? (
          <select
            aria-label="Filter by salesman"
            value={salesmanFilter}
            onChange={(event) => setSalesmanFilter(event.target.value)}
            className={`${FIELD_CLASSNAME} ${salesmanFilter ? "font-semibold" : "text-slate-500"}`}
          >
            <option value="">All salesmen</option>
            {salesmen.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        ) : null}

        {draft && !editingId ? form : null}

        {requestsError ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {requestsError}
          </p>
        ) : null}

        {nothingToShow ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            {!settledSearch && !salesmanFilter && openRequests.length === 0
              ? "No outlets yet. Add your first retailer to start booking orders."
              : "No outlets match that search."}
          </p>
        ) : null}

        <ul className={`space-y-2.5 ${isPlaceholderData ? "opacity-60 transition-opacity" : ""}`}>
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

          {shops.map((retailer) => {
            if (editing?.kind === "retailer" && editingId === retailer.id) {
              return <li key={`retailer-${retailer.id}`}>{form}</li>;
            }
            const place = [retailer.address_line1, retailer.city].filter(Boolean).join(", ");
            // The office reads who sells to the shop and on which beat.
            const assignment = manage ? [retailer.salesman_name || "No salesman", retailer.beat_name || "No beat"].join(" · ") : null;
            return (
              // The whole card opens the shop; its own buttons and links (Call, Map, Order, edit) do
              // their own thing.
              <li
                key={`retailer-${retailer.id}`}
                onClick={(event) => {
                  if (!event.target.closest("button, a, select, input")) router.push(`/app/retailers/${retailer.id}`);
                }}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50 active:bg-slate-100"
              >
                <div className="flex items-center gap-3 px-1 pt-1">
                  {/* The shop's name opens its screen: report, orders and what it owes. */}
                  <Link href={`/app/retailers/${retailer.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <ShopAvatar name={retailer.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-900">{retailer.name}</span>
                      <span className={`block truncate text-sm ${place ? "text-slate-500" : "text-amber-600"}`}>{place || "No address"}</span>
                      <span className="block truncate text-xs text-slate-400">
                        {[retailer.last_order_at ? `Ordered ${daysAgo(retailer.last_order_at)}` : "No orders yet", assignment].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                  </Link>
                  {manage ? (
                    <button
                      type="button"
                      onClick={() => startEditRetailer(retailer)}
                      disabled={Boolean(draft)}
                      aria-label={`Edit ${retailer.name}`}
                      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 text-slate-500 disabled:opacity-40"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={2} />
                    </button>
                  ) : null}
                </div>
                <div className="mt-3">
                  <ShopActions shop={retailer} canOrder={canOrder} />
                </div>
              </li>
            );
          })}
        </ul>
        <Pager page={page} pageSize={PAGE} total={total} noun="shops" onChange={(number) => { setPage(number); window.scrollTo({ top: 0 }); }} />
      </div>
      {/* Phones: the add action lives in the thumb zone; while the form is open it becomes
          Save / Cancel there. Editing an old request keeps its own inline buttons. */}
      {editingId || !canAdd ? null : (
        <MobileActionBar notice={draft && formError ? <p role="alert" className="text-sm text-rose-600">{formError}</p> : null}>
          {draft ? (
            <>
              <button type="button" onClick={cancel} disabled={saving} className={`${BAR_ACTION_SECONDARY} !flex-none px-5`}>
                Cancel
              </button>
              <button type="button" onClick={submit} disabled={saving || !(draft.name || "").trim()} className={BAR_ACTION_PRIMARY}>
                {saving ? "Saving…" : "Add retailer"}
              </button>
            </>
          ) : (
            <button type="button" onClick={startCreate} className={`${BAR_ACTION_PRIMARY} gap-1.5`}>
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add retailer
            </button>
          )}
        </MobileActionBar>
      )}
    </SectionCard>
  );
}
