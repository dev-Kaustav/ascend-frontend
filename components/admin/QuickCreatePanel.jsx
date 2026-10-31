"use client";

import { useEffect, useMemo, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { applySkuFieldChange, emptySku, toNumber } from "@/lib/skuPricing";

import { InputBar, SelectBar } from "@/components/ui/InputBars";
import { INDIAN_STATES } from "@/lib/states";
import { useToast } from "@/components/ui/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";

const ROW_CLASSNAME = "grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center";
const LABEL_CLASSNAME = "text-xs font-semibold text-slate-500";
const GROUP_ROW_CLASSNAME = "grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center";
const GROUP_LABEL_CLASSNAME = "text-xs font-semibold text-slate-500";
const SECTION_LABEL_CLASSNAME = "pt-3 text-xs font-semibold uppercase tracking-widest text-slate-500";
const TRIPLE_GROUP_CLASSNAME = "grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center";

const FieldRow = ({ id, label, children }) => (
  <div className={ROW_CLASSNAME}>
    <label htmlFor={id} className={LABEL_CLASSNAME}>
      {label}
    </label>
    {children}
  </div>
);

const ENTITY_LABELS = {
  warehouse: "Warehouse",
  retailer: "Retailer",
  brand: "Brand",
  sku: "SKU",
  beat: "Beat"
};

export default function QuickCreatePanel({
  title = "Quick create",
  subtitle = "Add missing entities without leaving this form.",
  entities = ["warehouse", "retailer", "brand", "sku", "beat"],
  defaultEntity,
  salesmen = [],
  warehouseManagers = [],
  warehouses = [],
  brands = [],
  onCreated,
  headerError
}) {
  const [createError, setCreateError] = useState("");
  const [newWarehouse, setNewWarehouse] = useState({
    name: "",
    location: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    pincode: "",
    manager_id: ""
  });
  const [newBrand, setNewBrand] = useState({
    name: "",
    poc_name: "",
    poc_phone_number: "",
    poc_email: ""
  });
  const [newRetailer, setNewRetailer] = useState({
    name: "",
    mobile_number: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    pincode: "",
    gst_number: "",
    salesman_id: ""
  });
  const [newSku, setNewSku] = useState(emptySku());
  const [newBeat, setNewBeat] = useState({ name: "", warehouse_id: "" });
  const { notify } = useToast();

  const { role } = useAuth();
  const canManageWarehouse = role === "ADMIN";
  const canManageBrand = role === "ADMIN" || role === "ACCOUNTANT";
  const canManageRetailer = role === "ADMIN";
  const canManageSku = role === "ADMIN" || role === "WAREHOUSE_MANAGER";
  const canManageBeat = role === "ADMIN";

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
    if (entities.includes("beat") && canManageBeat) {
      options.push({ value: "beat", label: ENTITY_LABELS.beat });
    }
    return options;
  }, [canManageBeat, canManageBrand, canManageRetailer, canManageSku, canManageWarehouse, entities]);

  const [chosenEntity, setChosenEntity] = useState(null);
  const selectedEntity = (() => {
    const has = (value) => Boolean(value) && entityOptions.some((option) => option.value === value);
    if (has(defaultEntity)) return defaultEntity;
    if (has(chosenEntity)) return chosenEntity;
    return entityOptions[0]?.value || "";
  })();
  const setSelectedEntity = setChosenEntity;

  const updateSkuField = (field, value) => {
    setNewSku((prev) => applySkuFieldChange(prev, field, value));
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
    if (!newWarehouse.manager_id) {
      setCreateError("Warehouse manager is required.");
      return;
    }
    if (newWarehouse.pincode && newWarehouse.pincode.length !== 6) {
      setCreateError("Pincode must be 6 digits.");
      return;
    }
    try {
      await apiFetch(apiEndpoints.admin.warehouses, {
        method: "POST",
        body: JSON.stringify({
          name: newWarehouse.name,
          location: newWarehouse.location || null,
          address_line1: newWarehouse.address_line1 || null,
          address_line2: newWarehouse.address_line2 || null,
          city: newWarehouse.city || null,
          state: newWarehouse.state || null,
          pincode: newWarehouse.pincode ? Number(newWarehouse.pincode) : null,
          manager_id: Number(newWarehouse.manager_id)
        })
      });
      setNewWarehouse({
        name: "",
        location: "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        pincode: "",
        manager_id: ""
      });
      notify("Warehouse created.");
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
    if (!newBrand.poc_name) {
      setCreateError("POC name is required.");
      return;
    }
    if (!newBrand.poc_phone_number || newBrand.poc_phone_number.length !== 10) {
      setCreateError("POC phone number must be 10 digits.");
      return;
    }
    try {
      await apiFetch(apiEndpoints.admin.brands, {
        method: "POST",
        body: JSON.stringify({
          name: newBrand.name,
          poc_name: newBrand.poc_name,
          poc_phone_number: Number(newBrand.poc_phone_number),
          poc_email: newBrand.poc_email || null
        })
      });
      setNewBrand({
        name: "",
        poc_name: "",
        poc_phone_number: "",
        poc_email: ""
      });
      notify("Brand created.");
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
    if (newRetailer.mobile_number && newRetailer.mobile_number.length !== 10) {
      setCreateError("Mobile number must be 10 digits.");
      return;
    }
    if (newRetailer.pincode && newRetailer.pincode.length !== 6) {
      setCreateError("Pincode must be 6 digits.");
      return;
    }
    try {
      await apiFetch(apiEndpoints.admin.retailers, {
        method: "POST",
        body: JSON.stringify({
          name: newRetailer.name,
          mobile_number: newRetailer.mobile_number ? Number(newRetailer.mobile_number) : null,
          address_line1: newRetailer.address_line1 || null,
          address_line2: newRetailer.address_line2 || null,
          city: newRetailer.city || null,
          state: newRetailer.state || null,
          pincode: newRetailer.pincode ? Number(newRetailer.pincode) : null,
          gst_number: newRetailer.gst_number || null,
          assigned_salesman_id: newRetailer.salesman_id ? Number(newRetailer.salesman_id) : null
        })
      });
      setNewRetailer({
        name: "",
        mobile_number: "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        pincode: "",
        gst_number: "",
        salesman_id: ""
      });
      notify("Retailer created.");
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
      "brand_id",
      "hsn_code",
      "distributor_landing_price",
      "mrp",
      "discount_amount",
      "discount_percent",
      "rate",
      "sgst_percent",
      "sgst_amount",
      "cgst_percent",
      "cgst_amount",
      "igst_percent",
      "igst_amount",
      "amount"
    ];
    const missingFields = requiredFields.filter((field) => newSku[field] === "" || newSku[field] === null || newSku[field] === undefined);
    if (missingFields.length) {
      setCreateError("All SKU fields except weight and dimensions are required.");
      return;
    }
    const numericFields = [
      "mrp",
      "distributor_landing_price",
      "discount_amount",
      "discount_percent",
      "rate",
      "sgst_percent",
      "sgst_amount",
      "cgst_percent",
      "cgst_amount",
      "igst_percent",
      "igst_amount",
      "amount",
      "weight",
      "length_cm",
      "width_cm",
      "height_cm"
    ];
    // Blank is allowed only for weight and dimensions; the required check above caught the rest.
    const invalidNumbers = numericFields.filter((field) => newSku[field] !== "" && toNumber(newSku[field]) === null);
    if (invalidNumbers.length) {
      setCreateError("All SKU numeric fields must be valid numbers.");
      return;
    }
    try {
      await apiFetch(apiEndpoints.admin.skus, {
        method: "POST",
        body: JSON.stringify({
          name: newSku.name,
          // Optional, and an empty box means "no code" rather than "".
          code: newSku.code.trim() || null,
          brand_id: Number(newSku.brand_id),
          hsn_code: newSku.hsn_code,
          distributor_landing_price: toNumber(newSku.distributor_landing_price),
          mrp: toNumber(newSku.mrp),
          discount_amount: toNumber(newSku.discount_amount),
          discount_percent: toNumber(newSku.discount_percent),
          rate: toNumber(newSku.rate),
          sgst_percent: toNumber(newSku.sgst_percent),
          sgst_amount: toNumber(newSku.sgst_amount),
          cgst_percent: toNumber(newSku.cgst_percent),
          cgst_amount: toNumber(newSku.cgst_amount),
          igst_percent: toNumber(newSku.igst_percent),
          igst_amount: toNumber(newSku.igst_amount),
          amount: toNumber(newSku.amount),
          weight: toNumber(newSku.weight),
          length_cm: toNumber(newSku.length_cm),
          width_cm: toNumber(newSku.width_cm),
          height_cm: toNumber(newSku.height_cm)
        })
      });
      setNewSku(emptySku());
      notify("SKU created.");
      if (onCreated) {
        await onCreated();
      }
    } catch (err) {
      setCreateError(err?.payload?.detail || err?.message || "Unable to create SKU.");
    }
  }

  async function handleCreateBeat(event) {
    event.preventDefault();
    setCreateError("");
    if (!newBeat.name.trim()) {
      setCreateError("Beat name is required.");
      return;
    }
    try {
      await apiFetch(apiEndpoints.admin.beats, {
        method: "POST",
        body: JSON.stringify({
          name: newBeat.name.trim(),
          warehouse_id: newBeat.warehouse_id ? Number(newBeat.warehouse_id) : null,
        }),
      });
      setNewBeat({ name: "", warehouse_id: "" });
      notify("Beat created.");
      if (onCreated) await onCreated();
    } catch (err) {
      setCreateError(err?.payload?.detail || err?.message || "Unable to create beat.");
    }
  }

  return (
    <SectionCard title={title} subtitle={subtitle}>
      {headerError ? <p className="mb-3 text-sm text-rose-500">{headerError}</p> : null}
      {createError ? <p className="mb-3 text-sm text-rose-500">{createError}</p> : null}
      {entityOptions.length ? (
        <div className="space-y-4">
          <div className={ROW_CLASSNAME}>
            <label
              htmlFor="quick-create-entity"
              className={`${LABEL_CLASSNAME} uppercase tracking-widest`}
            >
              Select entity
            </label>
            <SelectBar
              id="quick-create-entity"
              value={selectedEntity}
              onChange={(event) => setSelectedEntity(event.target.value)}
            >
              {entityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectBar>
          </div>

          {selectedEntity === "warehouse" && (
            <form onSubmit={handleCreateWarehouse} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Warehouse</p>
              <FieldRow id="warehouse-name" label="Warehouse name">
                <InputBar
                  id="warehouse-name"
                  type="text"
                  value={newWarehouse.name}
                  onChange={(event) => setNewWarehouse((prev) => ({ ...prev, name: event.target.value }))}
                />
              </FieldRow>
              <FieldRow id="warehouse-manager" label="Warehouse manager">
                <SelectBar
                  id="warehouse-manager"
                  value={newWarehouse.manager_id}
                  onChange={(event) => setNewWarehouse((prev) => ({ ...prev, manager_id: event.target.value }))}
                >
                  <option value="">Assign manager</option>
                  {warehouseManagers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name}
                      {manager.phone_number ? ` (${manager.phone_number})` : ""}
                    </option>
                  ))}
                </SelectBar>
              </FieldRow>
              <FieldRow id="warehouse-location" label="Location">
                <InputBar
                  id="warehouse-location"
                  type="text"
                  value={newWarehouse.location}
                  onChange={(event) => setNewWarehouse((prev) => ({ ...prev, location: event.target.value }))}
                />
              </FieldRow>
              <FieldRow id="warehouse-address-line1" label="Address line 1">
                <InputBar
                  id="warehouse-address-line1"
                  type="text"
                  value={newWarehouse.address_line1}
                  onChange={(event) => setNewWarehouse((prev) => ({ ...prev, address_line1: event.target.value }))}
                />
              </FieldRow>
              <FieldRow id="warehouse-address-line2" label="Address line 2">
                <InputBar
                  id="warehouse-address-line2"
                  type="text"
                  value={newWarehouse.address_line2}
                  onChange={(event) => setNewWarehouse((prev) => ({ ...prev, address_line2: event.target.value }))}
                />
              </FieldRow>
              <FieldRow id="warehouse-city" label="City">
                <div className={TRIPLE_GROUP_CLASSNAME}>
                  <InputBar
                    id="warehouse-city"
                    type="text"
                    value={newWarehouse.city}
                    onChange={(event) => setNewWarehouse((prev) => ({ ...prev, city: event.target.value }))}
                  />
                  <label htmlFor="warehouse-state" className={GROUP_LABEL_CLASSNAME}>
                    State
                  </label>
                  <SelectBar
                    id="warehouse-state"
                    value={newWarehouse.state}
                    onChange={(event) => setNewWarehouse((prev) => ({ ...prev, state: event.target.value }))}
                  >
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </SelectBar>
                  <label htmlFor="warehouse-pincode" className={GROUP_LABEL_CLASSNAME}>
                    Pincode
                  </label>
                  <InputBar
                    id="warehouse-pincode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={newWarehouse.pincode}
                    onChange={(event) =>
                      setNewWarehouse((prev) => ({
                        ...prev,
                        pincode: event.target.value.replace(/\D/g, "").slice(0, 6)
                      }))
                    }
                  />
                </div>
              </FieldRow>
              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Create Warehouse
              </button>
            </form>
          )}

          {selectedEntity === "retailer" && (
            <form onSubmit={handleCreateRetailer} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Retailer</p>
              <FieldRow id="retailer-name" label="Retailer name">
                <div className={GROUP_ROW_CLASSNAME}>
                  <InputBar
                    id="retailer-name"
                    type="text"
                    value={newRetailer.name}
                    onChange={(event) => setNewRetailer((prev) => ({ ...prev, name: event.target.value }))}
                  />
                  <label htmlFor="retailer-mobile-number" className={GROUP_LABEL_CLASSNAME}>
                    Mobile number
                  </label>
                  <InputBar
                    id="retailer-mobile-number"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={newRetailer.mobile_number}
                    onChange={(event) =>
                      setNewRetailer((prev) => ({
                        ...prev,
                        mobile_number: event.target.value.replace(/\D/g, "").slice(0, 10)
                      }))
                    }
                    placeholder="10-digit number"
                  />
                </div>
              </FieldRow>
              <FieldRow id="retailer-address-line1" label="Address line 1">
                <InputBar
                  id="retailer-address-line1"
                  type="text"
                  value={newRetailer.address_line1}
                  onChange={(event) => setNewRetailer((prev) => ({ ...prev, address_line1: event.target.value }))}
                />
              </FieldRow>
              <FieldRow id="retailer-address-line2" label="Address line 2">
                <InputBar
                  id="retailer-address-line2"
                  type="text"
                  value={newRetailer.address_line2}
                  onChange={(event) => setNewRetailer((prev) => ({ ...prev, address_line2: event.target.value }))}
                />
              </FieldRow>
              <FieldRow id="retailer-city" label="City">
                <div className={TRIPLE_GROUP_CLASSNAME}>
                  <InputBar
                    id="retailer-city"
                    type="text"
                    value={newRetailer.city}
                    onChange={(event) => setNewRetailer((prev) => ({ ...prev, city: event.target.value }))}
                  />
                  <label htmlFor="retailer-state" className={GROUP_LABEL_CLASSNAME}>
                    State
                  </label>
                  <SelectBar
                    id="retailer-state"
                    value={newRetailer.state}
                    onChange={(event) => setNewRetailer((prev) => ({ ...prev, state: event.target.value }))}
                  >
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </SelectBar>
                  <label htmlFor="retailer-pincode" className={GROUP_LABEL_CLASSNAME}>
                    Pincode
                  </label>
                  <InputBar
                    id="retailer-pincode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={newRetailer.pincode}
                    onChange={(event) =>
                      setNewRetailer((prev) => ({
                        ...prev,
                        pincode: event.target.value.replace(/\D/g, "").slice(0, 6)
                      }))
                    }
                  />
                </div>
              </FieldRow>
              <FieldRow id="retailer-gst-number" label="GST number">
                <InputBar
                  id="retailer-gst-number"
                  type="text"
                  value={newRetailer.gst_number}
                  onChange={(event) => setNewRetailer((prev) => ({ ...prev, gst_number: event.target.value }))}
                />
              </FieldRow>
              <FieldRow id="retailer-salesman" label="Assigned salesman">
                <SelectBar
                  id="retailer-salesman"
                  value={newRetailer.salesman_id}
                  onChange={(event) => setNewRetailer((prev) => ({ ...prev, salesman_id: event.target.value }))}
                >
                  <option value="">Assign salesman (optional)</option>
                  {salesmen.map((salesman) => (
                    <option key={salesman.id} value={salesman.id}>
                      {salesman.name}
                    </option>
                  ))}
                </SelectBar>
              </FieldRow>
              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Create Retailer
              </button>
            </form>
          )}

          {selectedEntity === "brand" && (
            <form onSubmit={handleCreateBrand} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Brand</p>
              <FieldRow id="brand-name" label="Brand name">
                <InputBar
                  id="brand-name"
                  type="text"
                  value={newBrand.name}
                  onChange={(event) => setNewBrand((prev) => ({ ...prev, name: event.target.value }))}
                />
              </FieldRow>
              <FieldRow id="brand-poc-name" label="POC name">
                <InputBar
                  id="brand-poc-name"
                  type="text"
                  value={newBrand.poc_name}
                  onChange={(event) => setNewBrand((prev) => ({ ...prev, poc_name: event.target.value }))}
                />
              </FieldRow>
              <FieldRow id="brand-poc-number" label="POC number">
                <InputBar
                  id="brand-poc-number"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={newBrand.poc_phone_number}
                  onChange={(event) =>
                    setNewBrand((prev) => ({
                      ...prev,
                      poc_phone_number: event.target.value.replace(/\\D/g, "").slice(0, 10)
                    }))
                  }
                />
              </FieldRow>
              <FieldRow id="brand-poc-email" label="POC email (optional)">
                <InputBar
                  id="brand-poc-email"
                  type="email"
                  value={newBrand.poc_email}
                  onChange={(event) => setNewBrand((prev) => ({ ...prev, poc_email: event.target.value }))}
                />
              </FieldRow>
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
              <div className="space-y-4">
                <FieldRow id="sku-name" label="SKU name">
                  <InputBar
                    id="sku-name"
                    type="text"
                    value={newSku.name}
                    onChange={(event) => setNewSku((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Enter SKU name"
                  />
                </FieldRow>
                <FieldRow id="sku-code" label="SKU code">
                  <InputBar
                    id="sku-code"
                    type="text"
                    value={newSku.code}
                    onChange={(event) => setNewSku((prev) => ({ ...prev, code: event.target.value }))}
                    placeholder="e.g. CHN-HG-25g"
                  />
                </FieldRow>
                <FieldRow id="sku-brand-name" label="Brand">
                  <SelectBar
                    id="sku-brand-name"
                    value={newSku.brand_id}
                    onChange={(event) => setNewSku((prev) => ({ ...prev, brand_id: event.target.value }))}
                  >
                    <option value="">Select brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </SelectBar>
                </FieldRow>
                <FieldRow id="sku-hsn-code" label="HSN code">
                  <InputBar
                    id="sku-hsn-code"
                    type="text"
                    value={newSku.hsn_code}
                    onChange={(event) => setNewSku((prev) => ({ ...prev, hsn_code: event.target.value }))}
                    placeholder="Enter HSN code"
                  />
                </FieldRow>
                <FieldRow id="sku-mrp" label="MRP">
                  <InputBar
                    id="sku-mrp"
                    type="number"
                    min="0"
                    step="0.001"
                    value={newSku.mrp}
                    onChange={(event) => updateSkuField("mrp", event.target.value)}
                  />
                </FieldRow>
                <FieldRow id="sku-distributor-landing-price" label="Distributor landing price">
                  <InputBar
                    id="sku-distributor-landing-price"
                    type="number"
                    min="0"
                    step="0.001"
                    value={newSku.distributor_landing_price}
                    onChange={(event) =>
                      setNewSku((prev) => ({ ...prev, distributor_landing_price: event.target.value }))
                    }
                  />
                </FieldRow>
                <FieldRow id="sku-discount-percent" label="Discount %">
                  <div className={GROUP_ROW_CLASSNAME}>
                    <InputBar
                      id="sku-discount-percent"
                      type="number"
                      min="0"
                      step="0.001"
                      value={newSku.discount_percent}
                      onChange={(event) => updateSkuField("discount_percent", event.target.value)}
                    />
                    <label htmlFor="sku-discount-amount" className={GROUP_LABEL_CLASSNAME}>
                      Discount amount
                    </label>
                    <InputBar
                      id="sku-discount-amount"
                      type="number"
                      min="0"
                      step="0.001"
                      value={newSku.discount_amount}
                      onChange={(event) => updateSkuField("discount_amount", event.target.value)}
                    />
                  </div>
                </FieldRow>
                <FieldRow id="sku-rate" label="Rate">
                  <InputBar
                    id="sku-rate"
                    type="number"
                    min="0"
                    step="0.001"
                    value={newSku.rate}
                    readOnly
                  />
                </FieldRow>

                <p className={SECTION_LABEL_CLASSNAME}>Tax details</p>
                <FieldRow id="sku-sgst-percent" label="SGST %">
                  <div className={GROUP_ROW_CLASSNAME}>
                    <InputBar
                      id="sku-sgst-percent"
                      type="number"
                      min="0"
                      step="0.001"
                      value={newSku.sgst_percent}
                      onChange={(event) => updateSkuField("sgst_percent", event.target.value)}
                    />
                    <label htmlFor="sku-sgst-amount" className={GROUP_LABEL_CLASSNAME}>
                      SGST amount
                    </label>
                    <InputBar
                      id="sku-sgst-amount"
                      type="number"
                      min="0"
                      step="0.001"
                      value={newSku.sgst_amount}
                      onChange={(event) => updateSkuField("sgst_amount", event.target.value)}
                    />
                  </div>
                </FieldRow>
                <FieldRow id="sku-cgst-percent" label="CGST %">
                  <div className={GROUP_ROW_CLASSNAME}>
                    <InputBar
                      id="sku-cgst-percent"
                      type="number"
                      min="0"
                      step="0.001"
                      value={newSku.cgst_percent}
                      onChange={(event) => updateSkuField("cgst_percent", event.target.value)}
                    />
                    <label htmlFor="sku-cgst-amount" className={GROUP_LABEL_CLASSNAME}>
                      CGST amount
                    </label>
                    <InputBar
                      id="sku-cgst-amount"
                      type="number"
                      min="0"
                      step="0.001"
                      value={newSku.cgst_amount}
                      onChange={(event) => updateSkuField("cgst_amount", event.target.value)}
                    />
                  </div>
                </FieldRow>
                <FieldRow id="sku-igst-percent" label="IGST %">
                  <div className={GROUP_ROW_CLASSNAME}>
                    <InputBar
                      id="sku-igst-percent"
                      type="number"
                      min="0"
                      step="0.001"
                      value={newSku.igst_percent}
                      onChange={(event) => updateSkuField("igst_percent", event.target.value)}
                    />
                    <label htmlFor="sku-igst-amount" className={GROUP_LABEL_CLASSNAME}>
                      IGST amount
                    </label>
                    <InputBar
                      id="sku-igst-amount"
                      type="number"
                      min="0"
                      step="0.001"
                      value={newSku.igst_amount}
                      onChange={(event) => updateSkuField("igst_amount", event.target.value)}
                    />
                  </div>
                </FieldRow>
                <FieldRow id="sku-amount" label="Amount">
                  <InputBar
                    id="sku-amount"
                    type="number"
                    min="0"
                    step="0.001"
                    value={newSku.amount}
                    readOnly
                  />
                </FieldRow>

                <p className={SECTION_LABEL_CLASSNAME}>Dimensions</p>
                <FieldRow id="sku-weight" label="Weight">
                  <InputBar
                    id="sku-weight"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newSku.weight}
                    onChange={(event) => setNewSku((prev) => ({ ...prev, weight: event.target.value }))}
                  />
                </FieldRow>
                <FieldRow id="sku-length-cm" label="Length (cm)">
                  <div className={TRIPLE_GROUP_CLASSNAME}>
                    <InputBar
                      id="sku-length-cm"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newSku.length_cm}
                      onChange={(event) => setNewSku((prev) => ({ ...prev, length_cm: event.target.value }))}
                    />
                    <label htmlFor="sku-width-cm" className={GROUP_LABEL_CLASSNAME}>
                      Width (cm)
                    </label>
                    <InputBar
                      id="sku-width-cm"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newSku.width_cm}
                      onChange={(event) => setNewSku((prev) => ({ ...prev, width_cm: event.target.value }))}
                    />
                    <label htmlFor="sku-height-cm" className={GROUP_LABEL_CLASSNAME}>
                      Height (cm)
                    </label>
                    <InputBar
                      id="sku-height-cm"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newSku.height_cm}
                      onChange={(event) => setNewSku((prev) => ({ ...prev, height_cm: event.target.value }))}
                    />
                  </div>
                </FieldRow>
              </div>
              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Create SKU
              </button>
            </form>
          )}
          {selectedEntity === "beat" && (
            <form onSubmit={handleCreateBeat} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Beat</p>
              <FieldRow id="beat-name" label="Beat name">
                <InputBar
                  id="beat-name"
                  type="text"
                  value={newBeat.name}
                  onChange={(e) => setNewBeat((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. GGN GTM-13"
                />
              </FieldRow>
              <FieldRow id="beat-warehouse" label="Warehouse (optional)">
                <SelectBar
                  id="beat-warehouse"
                  value={newBeat.warehouse_id}
                  onChange={(e) => setNewBeat((prev) => ({ ...prev, warehouse_id: e.target.value }))}
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </SelectBar>
              </FieldRow>
              <button type="submit" className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Create Beat
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
