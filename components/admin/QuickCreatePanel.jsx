"use client";

import { useEffect, useMemo, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { getAccessToken, getRoleFromToken } from "@/lib/auth";

const emptySku = () => ({
  name: "",
  brand_name: "",
  hsn_code: "",
  pack_quantity: "",
  mrp: "",
  discount_amount: "",
  discount_percent: "",
  rate: "",
  sgst_percent: "",
  sgst_amount: "",
  cgst_percent: "",
  cgst_amount: "",
  amount: "",
  weight: "",
  length_cm: "",
  width_cm: "",
  height_cm: ""
});

const ENTITY_LABELS = {
  warehouse: "Warehouse",
  retailer: "Retailer",
  brand: "Brand",
  sku: "SKU"
};

export default function QuickCreatePanel({
  title = "Quick create",
  subtitle = "Add missing entities without leaving this form.",
  entities = ["warehouse", "retailer", "brand", "sku"],
  defaultEntity,
  salesmen = [],
  onCreated,
  headerError
}) {
  const [createError, setCreateError] = useState("");
  const [newWarehouse, setNewWarehouse] = useState({ name: "", location: "" });
  const [newBrand, setNewBrand] = useState({ name: "", contact_info: "" });
  const [newRetailer, setNewRetailer] = useState({ name: "", contact_info: "", salesman_id: "" });
  const [newSku, setNewSku] = useState(emptySku());

  const role = useMemo(() => getRoleFromToken(getAccessToken()), []);
  const canManageWarehouse = useMemo(() => role === "ADMIN", [role]);
  const canManageBrand = useMemo(() => role === "ADMIN" || role === "ACCOUNTANT", [role]);
  const canManageRetailer = useMemo(() => role === "ADMIN", [role]);
  const canManageSku = useMemo(() => role === "ADMIN" || role === "WAREHOUSE_MANAGER" || role === "ACCOUNTANT", [role]);

  const entityOptions = useMemo(() => {
    const options = [];
    if (entities.includes("warehouse") && canManageWarehouse) {
      options.push({ value: "warehouse", label: ENTITY_LABELS.warehouse });
    }
    if (entities.includes("retailer") && canManageRetailer) {
      options.push({ value: "retailer", label: ENTITY_LABELS.retailer });
    }
    if (entities.includes("brand") && canManageBrand) {
      options.push({ value: "brand", label: ENTITY_LABELS.brand });
    }
    if (entities.includes("sku") && canManageSku) {
      options.push({ value: "sku", label: ENTITY_LABELS.sku });
    }
    return options;
  }, [canManageBrand, canManageRetailer, canManageSku, canManageWarehouse, entities]);

  const [selectedEntity, setSelectedEntity] = useState(() => {
    if (defaultEntity && entityOptions.find((option) => option.value === defaultEntity)) {
      return defaultEntity;
    }
    return entityOptions[0]?.value || "";
  });

  useEffect(() => {
    if (defaultEntity && entityOptions.find((option) => option.value === defaultEntity)) {
      if (selectedEntity !== defaultEntity) {
        setSelectedEntity(defaultEntity);
      }
      return;
    }
    if (!entityOptions.find((option) => option.value === selectedEntity)) {
      setSelectedEntity(entityOptions[0]?.value || "");
    }
  }, [defaultEntity, entityOptions, selectedEntity]);

  const toNumber = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatNumber = (value) => {
    if (value === null) return "";
    return String(Math.round(value * 100) / 100);
  };

  const getMrpBase = (sku) => {
    const quantity = toNumber(sku.pack_quantity);
    const mrp = toNumber(sku.mrp);
    if (quantity === null || mrp === null) return null;
    return quantity * mrp;
  };

  const syncDiscountFields = (nextSku, changedField) => {
    if (
      changedField !== "discount_percent" &&
      changedField !== "discount_amount" &&
      changedField !== "mrp" &&
      changedField !== "pack_quantity"
    ) {
      return;
    }
    const base = getMrpBase(nextSku);
    const percent = toNumber(nextSku.discount_percent);
    const amount = toNumber(nextSku.discount_amount);
    if (base === null) {
      if (changedField === "discount_percent") nextSku.discount_amount = "";
      if (changedField === "discount_amount") nextSku.discount_percent = "";
      return;
    }
    if (changedField === "discount_percent") {
      nextSku.discount_amount = percent === null ? "" : formatNumber((base * percent) / 100);
      return;
    }
    if (changedField === "discount_amount") {
      nextSku.discount_percent = amount === null ? "" : formatNumber((amount / base) * 100);
      return;
    }
    if (percent !== null) {
      nextSku.discount_amount = formatNumber((base * percent) / 100);
    } else if (amount !== null) {
      nextSku.discount_percent = formatNumber((amount / base) * 100);
    }
  };

  const syncTaxAndRate = (nextSku, changedField) => {
    const base = getMrpBase(nextSku);
    const discountAmount = toNumber(nextSku.discount_amount);
    if (base === null || discountAmount === null) {
      nextSku.amount = "";
      nextSku.rate = "";
      return;
    }

    const amountValue = Math.max(base - discountAmount, 0);
    nextSku.amount = formatNumber(amountValue);

    const sgstPercent = toNumber(nextSku.sgst_percent);
    const cgstPercent = toNumber(nextSku.cgst_percent);
    const sgstAmount = toNumber(nextSku.sgst_amount);
    const cgstAmount = toNumber(nextSku.cgst_amount);

    const changedPercent = changedField === "sgst_percent" || changedField === "cgst_percent";
    const changedAmount = changedField === "sgst_amount" || changedField === "cgst_amount";

    if (changedPercent || (!changedAmount && (sgstPercent !== null || cgstPercent !== null))) {
      const totalPercent = (sgstPercent || 0) + (cgstPercent || 0);
      const rateValue = totalPercent ? amountValue / (1 + totalPercent / 100) : amountValue;
      nextSku.rate = formatNumber(rateValue);
      if (sgstPercent !== null) {
        nextSku.sgst_amount = formatNumber((rateValue * sgstPercent) / 100);
      }
      if (cgstPercent !== null) {
        nextSku.cgst_amount = formatNumber((rateValue * cgstPercent) / 100);
      }
      return;
    }

    if (changedAmount || sgstAmount !== null || cgstAmount !== null) {
      const rateValue = Math.max(amountValue - (sgstAmount || 0) - (cgstAmount || 0), 0);
      nextSku.rate = formatNumber(rateValue);
      if (sgstAmount !== null) {
        nextSku.sgst_percent = rateValue ? formatNumber((sgstAmount / rateValue) * 100) : "";
      }
      if (cgstAmount !== null) {
        nextSku.cgst_percent = rateValue ? formatNumber((cgstAmount / rateValue) * 100) : "";
      }
      return;
    }

    nextSku.rate = formatNumber(amountValue);
  };

  const updateSkuField = (field, value) => {
    setNewSku((prev) => {
      const nextSku = { ...prev, [field]: value };
      syncDiscountFields(nextSku, field);
      syncTaxAndRate(nextSku, field);
      return nextSku;
    });
  };

  async function handleCreateWarehouse(event) {
    event.preventDefault();
    setCreateError("");
    if (!canManageWarehouse) {
      setCreateError("Only admins can create warehouses.");
      return;
    }
    if (!newWarehouse.name) {
      setCreateError("Warehouse name is required.");
      return;
    }
    try {
      await apiFetch(apiEndpoints.admin.warehouses, {
        method: "POST",
        body: JSON.stringify({ name: newWarehouse.name, location: newWarehouse.location })
      });
      setNewWarehouse({ name: "", location: "" });
      if (onCreated) {
        await onCreated();
      }
    } catch (err) {
      setCreateError(err?.payload?.detail || err?.message || "Unable to create warehouse.");
    }
  }

  async function handleCreateBrand(event) {
    event.preventDefault();
    setCreateError("");
    if (!canManageBrand) {
      setCreateError("Only admins or accountants can create brands.");
      return;
    }
    if (!newBrand.name) {
      setCreateError("Brand name is required.");
      return;
    }
    try {
      await apiFetch(apiEndpoints.admin.brands, {
        method: "POST",
        body: JSON.stringify({ name: newBrand.name, contact_info: newBrand.contact_info || null })
      });
      setNewBrand({ name: "", contact_info: "" });
      if (onCreated) {
        await onCreated();
      }
    } catch (err) {
      setCreateError(err?.payload?.detail || err?.message || "Unable to create brand.");
    }
  }

  async function handleCreateRetailer(event) {
    event.preventDefault();
    setCreateError("");
    if (!canManageRetailer) {
      setCreateError("Only admins can create retailers.");
      return;
    }
    if (!newRetailer.name) {
      setCreateError("Retailer name is required.");
      return;
    }
    try {
      await apiFetch(apiEndpoints.admin.retailers, {
        method: "POST",
        body: JSON.stringify({
          name: newRetailer.name,
          contact_info: newRetailer.contact_info,
          assigned_salesman_id: newRetailer.salesman_id ? Number(newRetailer.salesman_id) : null
        })
      });
      setNewRetailer({ name: "", contact_info: "", salesman_id: "" });
      if (onCreated) {
        await onCreated();
      }
    } catch (err) {
      setCreateError(err?.payload?.detail || err?.message || "Unable to create retailer.");
    }
  }

  async function handleCreateSku(event) {
    event.preventDefault();
    setCreateError("");
    if (!canManageSku) {
      setCreateError("Only admins, warehouse managers, or accountants can create SKUs.");
      return;
    }
    const requiredFields = [
      "name",
      "brand_name",
      "hsn_code",
      "pack_quantity",
      "mrp",
      "discount_amount",
      "discount_percent",
      "rate",
      "sgst_percent",
      "sgst_amount",
      "cgst_percent",
      "cgst_amount",
      "amount",
      "weight",
      "length_cm",
      "width_cm",
      "height_cm"
    ];
    const missingFields = requiredFields.filter((field) => newSku[field] === "" || newSku[field] === null || newSku[field] === undefined);
    if (missingFields.length) {
      setCreateError("All SKU fields are required.");
      return;
    }
    const numericFields = [
      "pack_quantity",
      "mrp",
      "discount_amount",
      "discount_percent",
      "rate",
      "sgst_percent",
      "sgst_amount",
      "cgst_percent",
      "cgst_amount",
      "amount",
      "weight",
      "length_cm",
      "width_cm",
      "height_cm"
    ];
    const invalidNumbers = numericFields.filter((field) => toNumber(newSku[field]) === null);
    if (invalidNumbers.length) {
      setCreateError("All SKU numeric fields must be valid numbers.");
      return;
    }
    try {
      const brandResponse = await apiFetch(apiEndpoints.admin.brands, {
        method: "POST",
        body: JSON.stringify({ name: newSku.brand_name, contact_info: null })
      });
      await apiFetch(apiEndpoints.admin.skus, {
        method: "POST",
        body: JSON.stringify({
          name: newSku.name,
          brand_id: brandResponse.id,
          hsn_code: newSku.hsn_code,
          pack_quantity: toNumber(newSku.pack_quantity),
          mrp: toNumber(newSku.mrp),
          discount_amount: toNumber(newSku.discount_amount),
          discount_percent: toNumber(newSku.discount_percent),
          rate: toNumber(newSku.rate),
          sgst_percent: toNumber(newSku.sgst_percent),
          sgst_amount: toNumber(newSku.sgst_amount),
          cgst_percent: toNumber(newSku.cgst_percent),
          cgst_amount: toNumber(newSku.cgst_amount),
          amount: toNumber(newSku.amount),
          weight: toNumber(newSku.weight),
          length_cm: toNumber(newSku.length_cm),
          width_cm: toNumber(newSku.width_cm),
          height_cm: toNumber(newSku.height_cm)
        })
      });
      setNewSku(emptySku());
      if (onCreated) {
        await onCreated();
      }
    } catch (err) {
      setCreateError(err?.payload?.detail || err?.message || "Unable to create SKU.");
    }
  }

  return (
    <SectionCard title={title} subtitle={subtitle}>
      {headerError ? <p className="mb-3 text-sm text-rose-500">{headerError}</p> : null}
      {createError ? <p className="mb-3 text-sm text-rose-500">{createError}</p> : null}
      {entityOptions.length ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs uppercase tracking-widest text-slate-500">Select entity</label>
            <select
              value={selectedEntity}
              onChange={(event) => setSelectedEntity(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {entityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {selectedEntity === "warehouse" && (
            <form onSubmit={handleCreateWarehouse} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Warehouse</p>
              <input
                type="text"
                value={newWarehouse.name}
                onChange={(event) => setNewWarehouse((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Warehouse name"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={newWarehouse.location}
                onChange={(event) => setNewWarehouse((prev) => ({ ...prev, location: event.target.value }))}
                placeholder="Location"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Create Warehouse
              </button>
            </form>
          )}

          {selectedEntity === "retailer" && (
            <form onSubmit={handleCreateRetailer} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Retailer</p>
              <input
                type="text"
                value={newRetailer.name}
                onChange={(event) => setNewRetailer((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Retailer name"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={newRetailer.contact_info}
                onChange={(event) => setNewRetailer((prev) => ({ ...prev, contact_info: event.target.value }))}
                placeholder="Contact info"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <select
                value={newRetailer.salesman_id}
                onChange={(event) => setNewRetailer((prev) => ({ ...prev, salesman_id: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Assign salesman (optional)</option>
                {salesmen.map((salesman) => (
                  <option key={salesman.id} value={salesman.id}>
                    {salesman.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Create Retailer
              </button>
            </form>
          )}

          {selectedEntity === "brand" && (
            <form onSubmit={handleCreateBrand} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Brand</p>
              <input
                type="text"
                value={newBrand.name}
                onChange={(event) => setNewBrand((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Brand name"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={newBrand.contact_info}
                onChange={(event) => setNewBrand((prev) => ({ ...prev, contact_info: event.target.value }))}
                placeholder="Contact info"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Create Brand
              </button>
            </form>
          )}

          {selectedEntity === "sku" && (
            <form onSubmit={handleCreateSku} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">SKU</p>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  value={newSku.name}
                  onChange={(event) => setNewSku((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="SKU name"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={newSku.brand_name}
                  onChange={(event) => setNewSku((prev) => ({ ...prev, brand_name: event.target.value }))}
                  placeholder="Brand name"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={newSku.hsn_code}
                  onChange={(event) => setNewSku((prev) => ({ ...prev, hsn_code: event.target.value }))}
                  placeholder="HSN code"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSku.pack_quantity}
                  onChange={(event) => updateSkuField("pack_quantity", event.target.value)}
                  placeholder="Qty"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSku.rate}
                  readOnly
                  placeholder="Rate"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSku.mrp}
                  onChange={(event) => updateSkuField("mrp", event.target.value)}
                  placeholder="MRP"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSku.discount_amount}
                  onChange={(event) => updateSkuField("discount_amount", event.target.value)}
                  placeholder="Discount amount"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSku.discount_percent}
                  onChange={(event) => updateSkuField("discount_percent", event.target.value)}
                  placeholder="Discount %"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSku.sgst_percent}
                  onChange={(event) => updateSkuField("sgst_percent", event.target.value)}
                  placeholder="SGST %"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSku.sgst_amount}
                  onChange={(event) => updateSkuField("sgst_amount", event.target.value)}
                  placeholder="SGST amount"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSku.cgst_percent}
                  onChange={(event) => updateSkuField("cgst_percent", event.target.value)}
                  placeholder="CGST %"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSku.cgst_amount}
                  onChange={(event) => updateSkuField("cgst_amount", event.target.value)}
                  placeholder="CGST amount"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSku.amount}
                  readOnly
                  placeholder="Amount"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSku.weight}
                  onChange={(event) => setNewSku((prev) => ({ ...prev, weight: event.target.value }))}
                  placeholder="Weight"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSku.length_cm}
                  onChange={(event) => setNewSku((prev) => ({ ...prev, length_cm: event.target.value }))}
                  placeholder="Length (cm)"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSku.width_cm}
                  onChange={(event) => setNewSku((prev) => ({ ...prev, width_cm: event.target.value }))}
                  placeholder="Width (cm)"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSku.height_cm}
                  onChange={(event) => setNewSku((prev) => ({ ...prev, height_cm: event.target.value }))}
                  placeholder="Height (cm)"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Create SKU
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
          No quick create options available for this role.
        </div>
      )}
    </SectionCard>
  );
}
