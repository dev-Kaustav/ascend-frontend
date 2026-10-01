"use client";

import { useEffect, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import { useToast } from "@/components/ui/ToastProvider";
import { apiEndpoints, apiFetch } from "@/lib/api";
import useAdminLookups from "@/lib/hooks/useAdminLookups";

const LABEL_CLASSNAME = "text-xs uppercase tracking-widest text-slate-400";

const asText = (value) => (value === null || value === undefined ? "" : String(value));

// The form holds text (it is what the inputs edit); the API speaks numbers and a nullable id.
const toForm = (settings) => ({
  min_order_value: asText(settings?.min_order_value),
  delivery_charge_percent: asText(settings?.delivery_charge_percent),
  storefront_warehouse_id: asText(settings?.storefront_warehouse_id)
});

const EMPTY_FORM = toForm(null);

const NUMERIC_FIELDS = {
  min_order_value: "Minimum order",
  delivery_charge_percent: "Delivery charge percentage"
};

// Admin-only screen, so naming the percentage here is fine: the "never show the percentage"
// rule (D-05) governs retailer-facing surfaces, which this panel is not.
export default function StoreSettingsPanel() {
  const { warehouses } = useAdminLookups({ errorMessage: "Unable to load warehouses." });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saved, setSaved] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useToast();

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetch(apiEndpoints.admin.storeSettings);
        if (!active) return;
        const next = toForm(response);
        setForm(next);
        setSaved(next);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.payload?.detail || err?.message || "Unable to load store settings.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const update = (field) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    // Only what the admin changed goes out. The API is partial, so this is about intent, not
    // necessity — but it also means an untouched field can never be overwritten by a stale form.
    const payload = {};
    for (const [field, label] of Object.entries(NUMERIC_FIELDS)) {
      if (form[field] === saved[field]) continue;
      const parsed = form[field].trim() === "" ? NaN : Number(form[field]);
      if (!Number.isFinite(parsed)) {
        setError(`${label} must be a number.`);
        return;
      }
      payload[field] = parsed;
    }
    if (form.storefront_warehouse_id !== saved.storefront_warehouse_id) {
      // Empty choice means "no warehouse" (store closed), which the API accepts as null.
      payload.storefront_warehouse_id = form.storefront_warehouse_id
        ? Number(form.storefront_warehouse_id)
        : null;
    }
    if (!Object.keys(payload).length) {
      notify("No changes to save.");
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch(apiEndpoints.admin.storeSettings, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      const next = toForm(response);
      setForm(next);
      setSaved(next);
      notify("Store settings saved.");
    } catch (err) {
      // 400/422 detail from the API, shown as-is; the form keeps what the admin typed.
      setError(err?.payload?.detail || err?.message || "Unable to save store settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading store settings…
      </div>
    );
  }

  return (
    <SectionCard
      title="Store Settings"
      subtitle="Delivery rules and the warehouse the storefront ships from. Changes apply to new carts straight away."
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL_CLASSNAME} htmlFor="ss-min-order">
              Minimum order for free delivery (₹)
            </label>
            <InputBar
              id="ss-min-order"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.min_order_value}
              onChange={update("min_order_value")}
              className="mt-2"
            />
            <p className="mt-2 text-xs text-slate-500">
              Orders at or above this value ship free; below it the delivery charge applies.
            </p>
          </div>
          <div>
            <label className={LABEL_CLASSNAME} htmlFor="ss-delivery-percent">
              Delivery charge below the minimum (% of cart value)
            </label>
            <InputBar
              id="ss-delivery-percent"
              type="number"
              min="0"
              max="100"
              step="0.01"
              inputMode="decimal"
              value={form.delivery_charge_percent}
              onChange={update("delivery_charge_percent")}
              className="mt-2"
            />
          </div>
        </div>
        <div className="max-w-md">
          <label className={LABEL_CLASSNAME} htmlFor="ss-warehouse">
            Storefront warehouse
          </label>
          <SelectBar
            id="ss-warehouse"
            value={form.storefront_warehouse_id}
            onChange={update("storefront_warehouse_id")}
            className="mt-2"
          >
            <option value="">Not set — store closed</option>
            {(warehouses || []).map((warehouse) => (
              <option key={warehouse.id} value={String(warehouse.id)}>
                {warehouse.name}
              </option>
            ))}
          </SelectBar>
          <p className="mt-2 text-xs text-slate-500">Stock for storefront orders is taken from this warehouse.</p>
        </div>
        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
        ) : null}
        <div>
          <button
            type="submit"
            disabled={saving}
            className="cursor-pointer rounded-full bg-slate-900 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}
