"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiEndpoints, apiFetch } from "@/lib/api";
import SectionCard from "@/components/layout/SectionCard";
import QuickCreatePanel from "@/components/admin/QuickCreatePanel";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import { useToast } from "@/components/ui/ToastProvider";
import useAdminLookups from "@/lib/hooks/useAdminLookups";
import useLineItems from "@/lib/hooks/useLineItems";

const emptyItem = () => ({
  skuId: "",
  quantity: "",
  mfgDate: "",
  expiryDate: ""
});

export default function WarehouseInventoryAdd() {
  const router = useRouter();
  const [brandId, setBrandId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const { items, updateItem, addItem, removeItem } = useLineItems(emptyItem);
  const { brands, skus, warehouses, warehouseManagers, loading, error: lookupError, refreshLookups } = useAdminLookups({
    errorMessage: "Unable to load inventory form data."
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useToast();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!brandId) {
      setError("Select a brand before submitting.");
      return;
    }
    if (!warehouseId) {
      setError("Select a warehouse before submitting.");
      return;
    }

    const payloadItems = items
      .map((item) => {
        const skuId = Number(item.skuId);
        const quantity = Number(item.quantity);
        if (!skuId || !Number.isFinite(quantity) || quantity <= 0) {
          return null;
        }
        return {
          sku_id: skuId,
          quantity,
          mfg_date: item.mfgDate || null,
          expiry_date: item.expiryDate || null
        };
      })
      .filter(Boolean);

    if (!payloadItems.length || payloadItems.length !== items.length) {
      setError("Each line item needs SKU and quantity.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch(apiEndpoints.admin.inventory, {
        method: "POST",
        body: JSON.stringify({
          brand_id: Number(brandId),
          warehouse_id: Number(warehouseId),
          items: payloadItems
        })
      });
      notify("Inventory added.");
      router.push("/app/inventory");
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to add inventory.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading inventory form…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Add Inventory"
        subtitle="Receive stock into a warehouse."
        actions={
          <Link
            href="/app/inventory"
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
          >
            Back to Inventory
          </Link>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400">Brand</label>
              <SelectBar value={brandId} onChange={(event) => setBrandId(event.target.value)} className="mt-2">
                <option value="">Select brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </SelectBar>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400">Warehouse</label>
              <SelectBar value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="mt-2">
                <option value="">Select warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </SelectBar>
            </div>
          </div>

          <div className="space-y-3">
            <div className="overflow-x-auto">
              <div className="grid min-w-[720px] gap-3 text-xs uppercase tracking-widest text-slate-400 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                <span>SKU</span>
                <span>Quantity</span>
                <span>MFG Date</span>
                <span>Expiry Date</span>
                <span />
              </div>
              {items.map((item, index) => (
                <div
                  key={`line-${index}`}
                  className="grid min-w-[720px] gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
                >
                  <SelectBar
                    value={item.skuId}
                    onChange={(event) => updateItem(index, { skuId: event.target.value })}
                    size="sm"
                  >
                    <option value="">Select SKU</option>
                    {skus.map((sku) => (
                      <option key={sku.id} value={sku.id}>
                        {sku.name}
                      </option>
                    ))}
                  </SelectBar>
                  <InputBar
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, { quantity: event.target.value })}
                    size="sm"
                    placeholder="0"
                  />
                  <InputBar
                    type="date"
                    value={item.mfgDate}
                    onChange={(event) => updateItem(index, { mfgDate: event.target.value })}
                    size="sm"
                  />
                  <InputBar
                    type="date"
                    value={item.expiryDate}
                    onChange={(event) => updateItem(index, { expiryDate: event.target.value })}
                    size="sm"
                  />
                  <div className="flex items-center justify-end text-xs text-slate-500">
                    {items.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-rose-500 hover:text-rose-600"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={addItem}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
            >
              Add Line
            </button>
          </div>

          {lookupError ? <p className="text-sm text-rose-500">{lookupError}</p> : null}
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Adding..." : "Add Inventory"}
            </button>
          </div>
        </form>
      </SectionCard>

      <QuickCreatePanel
        entities={["warehouse", "retailer", "brand", "sku"]}
        warehouseManagers={warehouseManagers}
        brands={brands}
        onCreated={refreshLookups}
      />
    </div>
  );
}
