"use client";

import { useEffect, useRef, useState } from "react";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { INDIAN_STATES } from "@/lib/states";

// Add or edit one shop at the desk: every field in one dialog, so the table only has to show what
// is worth scanning. `retailer` null means a new shop.

const asText = (value) => (value === null || value === undefined ? "" : String(value));
const orNull = (value) => (value === "" ? null : value);
const numOrNull = (value) => (value === "" ? null : Number(value));
const digitsOnly = (value, limit) => value.replace(/\D/g, "").slice(0, limit);

const FIELDS = ["name", "mobile_number", "address_line1", "city", "state", "pincode", "gst_number", "assigned_salesman_id", "beat_id"];

function Field({ label, className = "", children }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export default function RetailerDialog({ retailer, salesmen, beats, onClose, onSaved }) {
  const dialog = useRef(null);
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS.map((key) => [key, asText(retailer?.[key])])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (event) => setValues((prev) => ({ ...prev, [key]: event.target.value }));

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      // RetailerCreate declares its optionals without defaults, so every key is sent, null or not.
      // address_line2 is no longer edited; it is carried through so a save never wipes it.
      const body = {
        name: values.name.trim(),
        mobile_number: numOrNull(values.mobile_number),
        address_line1: orNull(values.address_line1),
        address_line2: retailer?.address_line2 ?? null,
        city: orNull(values.city),
        state: orNull(values.state),
        pincode: numOrNull(values.pincode),
        gst_number: orNull(values.gst_number),
        assigned_salesman_id: numOrNull(values.assigned_salesman_id),
        beat_id: numOrNull(values.beat_id)
      };
      await apiFetch(retailer ? apiEndpoints.admin.retailerUpdate(retailer.id) : apiEndpoints.admin.retailers, {
        method: retailer ? "PATCH" : "POST",
        body: JSON.stringify(body)
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to save.");
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      aria-labelledby="retailer-dialog-title"
      className="m-auto w-full max-w-xl rounded-xl border border-line bg-white p-6 text-ink backdrop:bg-black/30"
    >
      <form onSubmit={save} className="space-y-4">
        <h2 id="retailer-dialog-title" className="text-lg font-semibold">{retailer ? `Edit ${retailer.name}` : "Add retailer"}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Retailer name" className="col-span-2">
            <InputBar value={values.name} onChange={set("name")} placeholder="Shop name" required autoFocus />
          </Field>
          <Field label="Phone">
            <InputBar value={values.mobile_number} onChange={(e) => setValues((prev) => ({ ...prev, mobile_number: digitsOnly(e.target.value, 10) }))} inputMode="numeric" placeholder="10 digits" />
          </Field>
          <Field label="GST number">
            <InputBar value={values.gst_number} onChange={set("gst_number")} placeholder="Optional" />
          </Field>
          <Field label="Address" className="col-span-2">
            <InputBar value={values.address_line1} onChange={set("address_line1")} placeholder="Shop no., street, area" />
          </Field>
          <Field label="City">
            <InputBar value={values.city} onChange={set("city")} placeholder="City" />
          </Field>
          <Field label="Pincode">
            <InputBar value={values.pincode} onChange={(e) => setValues((prev) => ({ ...prev, pincode: digitsOnly(e.target.value, 6) }))} inputMode="numeric" placeholder="6 digits" />
          </Field>
          <Field label="State" className="col-span-2">
            <SelectBar value={values.state} onChange={set("state")}>
              <option value="">Select state</option>
              {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
            </SelectBar>
          </Field>
          <Field label="Salesman">
            <SelectBar value={values.assigned_salesman_id} onChange={set("assigned_salesman_id")}>
              <option value="">No salesman</option>
              {salesmen.map((salesman) => <option key={salesman.id} value={salesman.id}>{salesman.name}</option>)}
            </SelectBar>
          </Field>
          <Field label="Beat">
            <SelectBar value={values.beat_id} onChange={set("beat_id")}>
              <option value="">No beat</option>
              {beats.map((beat) => <option key={beat.id} value={beat.id}>{beat.name}</option>)}
            </SelectBar>
          </Field>
        </div>
        {error ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="h-9 cursor-pointer rounded-md border border-control bg-white px-4 text-sm font-medium text-ink hover:bg-raised disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={saving || !values.name.trim()} className="h-9 cursor-pointer rounded-md bg-ink px-4 text-sm font-medium text-white disabled:opacity-40">
            {saving ? "Saving…" : retailer ? "Save changes" : "Add retailer"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
