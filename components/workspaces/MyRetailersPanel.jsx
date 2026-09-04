"use client";

import { useCallback, useMemo, useState } from "react";
import { MapPin, Pencil, Phone, Plus } from "lucide-react";
import SectionCard from "@/components/layout/SectionCard";
import { apiEndpoints } from "@/lib/api";
import useOrderFormLookups from "@/lib/hooks/useOrderFormLookups";
import useInlineRowEditor from "@/lib/hooks/useInlineRowEditor";
import { INDIAN_STATES } from "@/lib/states";

// A salesman works this screen on a phone in a market, so it is a card list rather than the
// wide admin table: no horizontal scroll, 44px targets, 16px inputs (which also stops iOS
// zooming the page when a field takes focus).
const FIELD_CLASSNAME =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-800 transition-colors placeholder:text-slate-400 focus:border-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/25";

const asText = (value) => (value === null || value === undefined ? "" : String(value));
const orNull = (value) => (value === "" || value === undefined ? null : value);
const numOrNull = (value) => (value === "" || value === null || value === undefined ? null : Number(value));

const formatPhone = (value) => {
  if (!value && value !== 0) return null;
  const raw = String(value).replace(/\D/g, "");
  return raw.length === 10 ? `${raw.slice(0, 5)} ${raw.slice(5)}` : raw || null;
};

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export default function MyRetailersPanel() {
  // Scoped by the backend to this salesman's assigned outlets, which is exactly the set they
  // are allowed to edit — so the list and the permission can never disagree.
  const { retailers, loading, error, refreshLookups } = useOrderFormLookups({
    errorMessage: "Unable to load your retailers."
  });
  const [search, setSearch] = useState("");

  const editor = useInlineRowEditor({
    blank: useCallback(
      () => ({
        name: "",
        mobile_number: "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        pincode: "",
        gst_number: ""
      }),
      []
    ),
    toForm: useCallback(
      (retailer) => ({
        name: asText(retailer.name),
        mobile_number: asText(retailer.mobile_number),
        address_line1: asText(retailer.address_line1),
        address_line2: asText(retailer.address_line2),
        city: asText(retailer.city),
        state: asText(retailer.state),
        pincode: asText(retailer.pincode),
        gst_number: asText(retailer.gst_number)
      }),
      []
    ),
    // No salesman or beat field: the backend stamps this salesman on create and refuses to
    // move either on update, so offering them here would only promise something it rejects.
    buildBody: useCallback(
      (values) => ({
        name: values.name,
        mobile_number: numOrNull(values.mobile_number),
        address_line1: orNull(values.address_line1),
        address_line2: orNull(values.address_line2),
        city: orNull(values.city),
        state: orNull(values.state),
        pincode: numOrNull(values.pincode),
        gst_number: orNull(values.gst_number),
        assigned_salesman_id: null,
        beat_id: null
      }),
      []
    ),
    createUrl: apiEndpoints.admin.retailers,
    updateUrl: apiEndpoints.admin.retailerUpdate,
    onSaved: refreshLookups
  });

  const filtered = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return retailers || [];
    return (retailers || []).filter((retailer) => {
      const haystack = [retailer.name, retailer.city, retailer.mobile_number, retailer.gst_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [retailers, search]);

  const form = (
    <div className="space-y-3 rounded-2xl border border-[#7c3aed]/30 bg-[#7c3aed]/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {editor.mode === "create" ? "New retailer" : "Edit retailer"}
      </p>
      <Field label="Shop name">
        <input
          className={FIELD_CLASSNAME}
          value={editor.values.name ?? ""}
          onChange={(event) => editor.setField("name", event.target.value)}
          placeholder="Shop name"
          autoFocus
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mobile">
          <input
            className={FIELD_CLASSNAME}
            inputMode="numeric"
            value={editor.values.mobile_number ?? ""}
            onChange={(event) => editor.setField("mobile_number", event.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10 digits"
          />
        </Field>
        <Field label="City">
          <input
            className={FIELD_CLASSNAME}
            value={editor.values.city ?? ""}
            onChange={(event) => editor.setField("city", event.target.value)}
            placeholder="City"
          />
        </Field>
      </div>
      <Field label="Address line 1">
        <input
          className={FIELD_CLASSNAME}
          value={editor.values.address_line1 ?? ""}
          onChange={(event) => editor.setField("address_line1", event.target.value)}
          placeholder="Street, landmark"
        />
      </Field>
      <Field label="Address line 2">
        <input
          className={FIELD_CLASSNAME}
          value={editor.values.address_line2 ?? ""}
          onChange={(event) => editor.setField("address_line2", event.target.value)}
          placeholder="Optional"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="State">
          <select
            className={FIELD_CLASSNAME}
            value={editor.values.state ?? ""}
            onChange={(event) => editor.setField("state", event.target.value)}
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
            value={editor.values.pincode ?? ""}
            onChange={(event) => editor.setField("pincode", event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6 digits"
          />
        </Field>
      </div>
      <Field label="GST number">
        <input
          className={FIELD_CLASSNAME}
          value={editor.values.gst_number ?? ""}
          onChange={(event) => editor.setField("gst_number", event.target.value)}
          placeholder="Optional"
        />
      </Field>
      {editor.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{editor.error}</p>
      ) : null}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={editor.save}
          disabled={editor.saving || !(editor.values.name || "").trim()}
          className="h-11 flex-1 cursor-pointer rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
        >
          {editor.saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={editor.cancel}
          disabled={editor.saving}
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

  return (
    <SectionCard
      title="My Retailers"
      subtitle={`${filtered.length} of ${(retailers || []).length} outlets assigned to you`}
      actions={
        <button
          type="button"
          onClick={editor.startCreate}
          disabled={editor.isActive}
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

        {editor.mode === "create" ? form : null}

        {filtered.length === 0 && editor.mode !== "create" ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            {(retailers || []).length === 0
              ? "No outlets yet. Add your first retailer to start booking orders."
              : "No outlets match that search."}
          </p>
        ) : null}

        <ul className="space-y-2.5">
          {filtered.map((retailer) => {
            const phone = formatPhone(retailer.mobile_number);
            const place = [retailer.address_line1, retailer.city].filter(Boolean).join(", ");
            if (editor.isEditing(retailer)) {
              return <li key={retailer.id}>{form}</li>;
            }
            return (
              <li
                key={retailer.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{retailer.name}</p>
                  {place ? (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                      <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      <span className="truncate">{place}</span>
                    </p>
                  ) : null}
                  {phone ? (
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                      <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      <span className="tabular-nums">{phone}</span>
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => editor.startEdit(retailer)}
                  disabled={editor.isActive}
                  aria-label={`Edit ${retailer.name}`}
                  className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40"
                >
                  <Pencil className="h-4 w-4" strokeWidth={2} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </SectionCard>
  );
}
