"use client";

import { useEffect, useMemo, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { getAccessToken, getRoleFromToken } from "@/lib/auth";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import { useToast } from "@/components/ui/ToastProvider";

const ROW_CLASSNAME = "grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center";
const LABEL_CLASSNAME = "text-xs font-semibold text-slate-500";
const GROUP_ROW_CLASSNAME = "grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center";
const GROUP_LABEL_CLASSNAME = "text-xs font-semibold text-slate-500";
const SECTION_LABEL_CLASSNAME = "pt-3 text-xs font-semibold uppercase tracking-widest text-slate-500";
const TRIPLE_GROUP_CLASSNAME = "grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center";
const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal"
];

const FieldRow = ({ id, label, children }) => (
  <div className={ROW_CLASSNAME}>
    <label htmlFor={id} className={LABEL_CLASSNAME}>
      {label}
    </label>
    {children}
  </div>
);

const LAST_EDITED_DEFAULT = { discount: null, sgst: null, cgst: null, igst: null };

const emptySku = () => ({
  name: "",
  brand_name: "",
  hsn_code: "",
  pack_quantity: "1",
  mrp: "",
  discount_amount: "",
  discount_percent: "",
  rate: "",
  sgst_percent: "",
  sgst_amount: "",
  cgst_percent: "",
  cgst_amount: "",
  igst_percent: "",
  igst_amount: "",
  amount: "",
  weight: "",
  length_cm: "",
  width_cm: "",
  height_cm: "",
  __lastEdited: { ...LAST_EDITED_DEFAULT }
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
  entities = ["warehouse", "retailer", "sku"],
  defaultEntity,
  salesmen = [],
  warehouseManagers = [],
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
  const [newBrand, setNewBrand] = useState({ name: "", contact_info: "" });
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
  const { notify } = useToast();

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

  const getNextLastEdited = (current, field) => {
    const next = { ...(current || LAST_EDITED_DEFAULT) };
    switch (field) {
      case "discount_percent":
        next.discount = "percent";
        break;
      case "discount_amount":
        next.discount = "amount";
        break;
      case "sgst_percent":
        next.sgst = "percent";
        break;
      case "sgst_amount":
        next.sgst = "amount";
        break;
      case "cgst_percent":
        next.cgst = "percent";
        break;
      case "cgst_amount":
        next.cgst = "amount";
        break;
      case "igst_percent":
        next.igst = "percent";
        break;
      case "igst_amount":
        next.igst = "amount";
        break;
      default:
        break;
    }
    return next;
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
    if (changedField === "discount_percent") {
      if (percent === null) {
        nextSku.discount_amount = "";
        return;
      }
      nextSku.discount_amount = base === null ? "" : formatNumber((base * percent) / 100);
      return;
    }
    if (changedField === "discount_amount") {
      if (amount === null) {
        nextSku.discount_percent = "";
        return;
      }
      nextSku.discount_percent = base === null ? "" : formatNumber((amount / base) * 100);
      return;
    }
    if (base === null) {
      return;
    }
    const lastEdited = nextSku.__lastEdited?.discount;
    if (lastEdited === "amount") {
      nextSku.discount_percent = amount === null ? "" : formatNumber((amount / base) * 100);
      return;
    }
    if (lastEdited === "percent") {
      nextSku.discount_amount = percent === null ? "" : formatNumber((base * percent) / 100);
      return;
    }
    if (percent !== null) {
      nextSku.discount_amount = formatNumber((base * percent) / 100);
      return;
    }
    if (amount !== null) {
      nextSku.discount_percent = formatNumber((amount / base) * 100);
    }
  };

  const syncTaxAndRate = (nextSku, changedField) => {
    const taxPairs = [
      { key: "sgst", percent: "sgst_percent", amount: "sgst_amount" },
      { key: "cgst", percent: "cgst_percent", amount: "cgst_amount" },
      { key: "igst", percent: "igst_percent", amount: "igst_amount" }
    ];
    const changedTaxPair = taxPairs.find((pair) => pair.percent === changedField || pair.amount === changedField);
    if (changedTaxPair) {
      const percentValue = toNumber(nextSku[changedTaxPair.percent]);
      const amountValue = toNumber(nextSku[changedTaxPair.amount]);
      if (changedField === changedTaxPair.percent && percentValue === null) {
        nextSku[changedTaxPair.amount] = "";
      }
      if (changedField === changedTaxPair.amount && amountValue === null) {
        nextSku[changedTaxPair.percent] = "";
      }
    }

    const base = getMrpBase(nextSku);
    const rawDiscountAmount = nextSku.discount_amount;
    const discountAmount = toNumber(rawDiscountAmount);
    const hasDiscountInput =
      rawDiscountAmount !== "" && rawDiscountAmount !== null && rawDiscountAmount !== undefined;
    if (base === null || (hasDiscountInput && discountAmount === null)) {
      nextSku.amount = "";
      nextSku.rate = "";
      return;
    }

    const amountValue = Math.max(base - (discountAmount ?? 0), 0);
    nextSku.amount = formatNumber(amountValue);
    const lastEdited = nextSku.__lastEdited || LAST_EDITED_DEFAULT;
    let totalPercent = 0;
    let totalAmount = 0;

    const taxState = taxPairs.map((pair) => {
      const percentValue = toNumber(nextSku[pair.percent]);
      const amountValue = toNumber(nextSku[pair.amount]);
      const mode = lastEdited[pair.key];
      let usePercent = false;
      let useAmount = false;

      if (mode === "percent") {
        usePercent = percentValue !== null;
      } else if (mode === "amount") {
        useAmount = amountValue !== null;
      } else if (percentValue !== null) {
        usePercent = true;
      } else if (amountValue !== null) {
        useAmount = true;
      }

      if (usePercent) totalPercent += percentValue;
      if (useAmount) totalAmount += amountValue;

      return {
        ...pair,
        percentField: pair.percent,
        amountField: pair.amount,
        percentValue,
        amountValue,
        usePercent,
        useAmount
      };
    });

    const denominator = 1 + totalPercent / 100;
    const rawRate = denominator ? (amountValue - totalAmount) / denominator : 0;
    const rateValue = Number.isFinite(rawRate) ? Math.max(rawRate, 0) : 0;
    nextSku.rate = formatNumber(rateValue);

    taxState.forEach((tax) => {
      if (tax.usePercent) {
        nextSku[tax.amountField] =
          tax.percentValue === null ? "" : formatNumber((rateValue * tax.percentValue) / 100);
        return;
      }
      if (tax.useAmount) {
        nextSku[tax.percentField] =
          tax.amountValue === null ? "" : rateValue ? formatNumber((tax.amountValue / rateValue) * 100) : "";
        return;
      }
      if (tax.percentValue === null) {
        nextSku[tax.percentField] = "";
      }
      if (tax.amountValue === null) {
        nextSku[tax.amountField] = "";
      }
    });
  };

  const updateSkuField = (field, value) => {
    setNewSku((prev) => {
      const nextSku = { ...prev, [field]: value, __lastEdited: getNextLastEdited(prev.__lastEdited, field) };
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
    try {
      await apiFetch(apiEndpoints.admin.brands, {
        method: "POST",
        body: JSON.stringify({ name: newBrand.name, contact_info: newBrand.contact_info || null })
      });
      setNewBrand({ name: "", contact_info: "" });
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
      "igst_percent",
      "igst_amount",
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
      "igst_percent",
      "igst_amount",
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
              <FieldRow id="brand-contact-info" label="Contact info">
                <InputBar
                  id="brand-contact-info"
                  type="text"
                  value={newBrand.contact_info}
                  onChange={(event) => setNewBrand((prev) => ({ ...prev, contact_info: event.target.value }))}
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
                <FieldRow id="sku-brand-name" label="Brand name">
                  <InputBar
                    id="sku-brand-name"
                    type="text"
                    value={newSku.brand_name}
                    onChange={(event) => setNewSku((prev) => ({ ...prev, brand_name: event.target.value }))}
                    placeholder="Enter brand name"
                  />
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
                    step="0.01"
                    value={newSku.mrp}
                    onChange={(event) => updateSkuField("mrp", event.target.value)}
                  />
                </FieldRow>
                <FieldRow id="sku-discount-percent" label="Discount %">
                  <div className={GROUP_ROW_CLASSNAME}>
                    <InputBar
                      id="sku-discount-percent"
                      type="number"
                      min="0"
                      step="0.01"
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
                      step="0.01"
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
                    step="0.01"
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
                      step="0.01"
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
                      step="0.01"
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
                      step="0.01"
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
                      step="0.01"
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
                      step="0.01"
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
                      step="0.01"
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
                    step="0.01"
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
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
          No quick create options available for this role.
        </div>
      )}
    </SectionCard>
  );
}
