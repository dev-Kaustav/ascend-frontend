"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, MapPin, Minus, Pencil, Plus } from "lucide-react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import MobileActionBar, { BAR_ACTION_PRIMARY } from "@/components/layout/MobileActionBar";
import SearchSelect from "@/components/ui/SearchSelect";
import FieldSection, { FIELD_CONTROL } from "@/components/field/FieldSection";
import useOrderFormLookups from "@/lib/hooks/useOrderFormLookups";
import useStockAvailability from "@/lib/hooks/useStockAvailability";
import { getLineTaxAmount, getSkuGstRate, roundToTwo } from "@/lib/orders";
import { useToast } from "@/components/ui/ToastProvider";

// The salesman's order screen, built for a phone at a shop counter: pick the shop, add products
// from the search dropdown, step quantities by the ladi, optionally note cash collected, done. No salesman picker (create_outgoing_order stamps
// it from the login), no date (the server dates the order), and no pricing-mode toggle: the unit
// price is what gets negotiated, and the discount is derived from it.

// Most orders are booked from the City warehouse, so it is preselected when it exists.
const DEFAULT_WAREHOUSE_NAME = "city";

// Pieces in one pack (a ladi). Quantities step by a whole pack; 1 when the SKU is sold by the piece.
const packSize = (sku) => (Number(sku?.units_per_pack) > 0 ? Number(sku.units_per_pack) : 1);
const packLabel = (sku) => (packSize(sku) > 1 ? sku?.pack_type || "pack" : "pc");
const listPriceOf = (sku) => Number(sku?.mrp ?? sku?.rate) || 0;
// The default selling price per piece: the catalogue amount, i.e. MRP less the SKU's discount.
const defaultUnitPrice = (sku) => {
  const amount = Number(sku?.amount);
  if (Number.isFinite(amount) && amount > 0) return amount;
  return Math.max(listPriceOf(sku) - (Number(sku?.discount_amount) || 0), 0);
};

const rupees = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatRupee = (value) => `₹${rupees.format(Number(value) || 0)}`;

const PAYMENT_MODES = [
  ["CASH", "Cash"],
  ["UPI", "UPI"],
  ["CHEQUE", "Cheque"]
];

export default function SalesmanOrderCreate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify } = useToast();
  const { retailers, skus, warehouses, brands, loading, error: lookupError } = useOrderFormLookups({
    errorMessage: "Unable to load order form data."
  });

  const [retailerId, setRetailerId] = useState(() => searchParams.get("retailer") || "");
  const [warehouseChoice, setWarehouseChoice] = useState("");
  const [brandChoice, setBrandChoice] = useState("");
  // { [skuId]: { quantity (pieces), packPrice (per ladi, as typed) } }. Prices are negotiated per
  // ladi at the counter; the per-piece price the API needs is derived from it.
  const [lines, setLines] = useState({});
  // Insertion order, so a newly added product lands at the bottom of the list, not re-sorted.
  const [lineOrder, setLineOrder] = useState([]);
  const [editingPrice, setEditingPrice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // A choice the salesman made wins; otherwise City, otherwise the only/first warehouse.
  const warehouseId = useMemo(() => {
    if (warehouseChoice) return warehouseChoice;
    const city = warehouses.find((w) => (w.name || "").trim().toLowerCase() === DEFAULT_WAREHOUSE_NAME);
    return String((city || warehouses[0])?.id ?? "");
  }, [warehouseChoice, warehouses]);
  const brandId = brandChoice || String(brands[0]?.id ?? "");

  const retailer = useMemo(
    () => retailers.find((r) => String(r.id) === String(retailerId)) || null,
    [retailers, retailerId]
  );
  // A ?retailer= id that is not one of this salesman's outlets is dropped rather than submitted.
  useEffect(() => {
    if (!loading && retailerId && !retailer) setRetailerId("");
  }, [loading, retailerId, retailer]);

  const retailerOptions = useMemo(
    () =>
      retailers.map((r) => ({
        value: String(r.id),
        label: r.name,
        hint: r.address_line1 || "",
        keywords: [r.address_line1, r.city, r.mobile_number]
      })),
    [retailers]
  );

  const skuMap = useMemo(() => new Map(skus.map((sku) => [String(sku.id), sku])), [skus]);
  // The dropdown offers the brand's products not yet on the order; added ones are edited below.
  const productOptions = useMemo(
    () =>
      skus
        .filter((sku) => (!brandId || String(sku.brand_id) === brandId) && !lines[String(sku.id)])
        .map((sku) => ({
          value: String(sku.id),
          label: sku.name || sku.code || `SKU ${sku.id}`,
          hint: `${formatRupee(defaultUnitPrice(sku) * packSize(sku))} / ${packLabel(sku)}`,
          keywords: [sku.code]
        })),
    [skus, brandId, lines]
  );

  const chosenIds = lineOrder;
  const { available, refreshAvailability } = useStockAvailability(warehouseId, chosenIds);

  // Lines in the shape lib/orders.js prices: quantity, and discount per piece off the list price.
  const priced = useMemo(
    () =>
      chosenIds.map((skuId) => {
        const sku = skuMap.get(skuId);
        const line = lines[skuId];
        const listPrice = listPriceOf(sku);
        const perPiece = (Number(line.packPrice) || 0) / packSize(sku);
        const unitPrice = Math.min(Math.max(perPiece, 0), listPrice || Infinity);
        // The discount is fixed per line, not per piece: ₹95 a ladi of 12 does not divide into
        // whole paise, and rounding each piece would drift the ladi to ₹95.04.
        const lineDiscount = roundToTwo(Math.max(listPrice - unitPrice, 0) * line.quantity);
        // `discount` (per piece) is what lib/orders.js getLineTaxAmount expects.
        const discount = line.quantity ? lineDiscount / line.quantity : 0;
        return { skuId, sku, quantity: line.quantity, listPrice, unitPrice, discount, lineDiscount };
      }),
    [chosenIds, lines, skuMap]
  );
  const totals = useMemo(() => {
    const mrp = priced.reduce((sum, l) => sum + l.listPrice * l.quantity, 0);
    const discount = priced.reduce((sum, l) => sum + l.lineDiscount, 0);
    const gst = priced.reduce((sum, l) => sum + getLineTaxAmount(l, l.sku), 0);
    const grand = roundToTwo(Math.max(mrp - discount, 0));
    return { mrp: roundToTwo(mrp), discount: roundToTwo(discount), gst: roundToTwo(gst), grand };
  }, [priced]);

  const addProduct = (skuId) => {
    const sku = skuMap.get(String(skuId));
    if (!sku || lines[String(skuId)]) return;
    const id = String(skuId);
    setLines((prev) => ({
      ...prev,
      [id]: { quantity: packSize(sku), packPrice: String(roundToTwo(defaultUnitPrice(sku) * packSize(sku))) }
    }));
    setLineOrder((prev) => [...prev, id]);
  };

  const removeProduct = (id) => {
    setLines(({ [id]: _removed, ...rest }) => rest);
    setLineOrder((prev) => prev.filter((value) => value !== id));
    if (editingPrice === id) setEditingPrice(null);
  };

  const step = (sku, direction) => {
    const id = String(sku.id);
    const quantity = (lines[id]?.quantity || 0) + direction * packSize(sku);
    if (quantity <= 0) return removeProduct(id);
    setLines((prev) => ({ ...prev, [id]: { ...prev[id], quantity } }));
  };

  const setPackPrice = (skuId, value) =>
    setLines((prev) => (prev[skuId] ? { ...prev, [skuId]: { ...prev[skuId], packPrice: value } } : prev));

  // A brand switch keeps only the lines that belong to the new brand.
  const chooseBrand = (nextBrandId) => {
    setBrandChoice(nextBrandId);
    const keep = lineOrder.filter((id) => String(skuMap.get(id)?.brand_id) === nextBrandId);
    setLineOrder(keep);
    setLines((prev) => Object.fromEntries(keep.map((id) => [id, prev[id]])));
  };

  const collected = Number(paymentAmount);
  // Blank or zero collected makes it a credit order: most orders are on credit.
  const isCredit = !paymentAmount.trim() || !(collected > 0);

  async function handleSubmit(event) {
    event?.preventDefault();
    setError("");
    if (!retailerId) return setError("Choose a shop first.");
    if (!warehouseId) return setError("No warehouse is set up for orders.");
    if (!priced.length) return setError("Add at least one product.");
    if (!isCredit && !Number.isFinite(collected)) return setError("Enter the amount collected as a number.");

    setSaving(true);
    try {
      const response = await apiFetch(apiEndpoints.orders.create, {
        method: "POST",
        body: JSON.stringify({
          retailer_id: Number(retailerId),
          warehouse_id: Number(warehouseId),
          payment_mode: isCredit ? "CREDIT" : paymentMode,
          payment_amount: isCredit ? null : roundToTwo(collected),
          items: priced.map((l) => {
            const gstRate = getSkuGstRate(l.sku);
            return {
              sku_id: Number(l.skuId),
              quantity: l.quantity,
              unit_price: l.listPrice || l.unitPrice,
              discount_amount: l.lineDiscount,
              taxes: gstRate > 0 ? [{ tax_type: "GST", rate: gstRate }] : []
            };
          })
        })
      });
      notify("Order created.");
      router.push(`/app/orders/${response.id}`);
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to create order.");
      refreshAvailability();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">Loading…</div>;
  }

  const itemCount = priced.length;
  const submitLabel = saving ? "Creating…" : "Create order";
  const canSubmit = !saving && Boolean(retailerId) && itemCount > 0;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-3">
      {/* Shop, with the brand and warehouse it is booked against as one symmetric row. */}
      <FieldSection title="Shop">
        {retailer ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{retailer.name}</p>
              {retailer.address_line1 || retailer.city ? (
                <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span className="truncate">{[retailer.address_line1, retailer.city].filter(Boolean).join(", ")}</span>
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setRetailerId("")}
              className="h-11 shrink-0 cursor-pointer rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
            >
              Change
            </button>
          </div>
        ) : (
          <SearchSelect
            value={retailerId}
            onChange={setRetailerId}
            options={retailerOptions}
            placeholder="Search your shops"
            inputClassName="h-11 !rounded-xl !py-0"
            emptyLabel="No shops match"
          />
        )}
        {!retailers.length ? (
          <p className="text-sm text-amber-600">Add a retailer from the Retailers tab to start booking.</p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <FieldSelect
            label="Brand"
            value={brandId}
            onChange={chooseBrand}
            options={brands.map((b) => [String(b.id), b.name])}
          />
          <FieldSelect
            label="Warehouse"
            value={warehouseId}
            onChange={setWarehouseChoice}
            options={warehouses.map((w) => [String(w.id), w.name])}
          />
        </div>
      </FieldSection>

      {/* Products: added from the dropdown, edited here. */}
      <FieldSection title="Products" meta={itemCount ? `${itemCount} added` : null}>
        <SearchSelect
          value=""
          onChange={addProduct}
          options={productOptions}
          placeholder={itemCount ? "Add another product" : "Add a product"}
            // A solid black + button inside a dashed box, label beside it: reads as "add", not "search".
            icon={
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Plus className="!h-4 !w-4" strokeWidth={2.75} />
              </span>
            }
            inputClassName="!h-12 !rounded-xl !py-0 !pl-[3.25rem] !border-2 !border-dashed !border-slate-300 font-semibold placeholder:!text-slate-700 placeholder:font-semibold"
          emptyLabel={productOptions.length ? "No products match" : "Every product is already added"}
        />
        {itemCount ? (
          <ul className="divide-y divide-slate-100">
            {priced.map(({ skuId: id, sku, quantity, unitPrice }) => {
              const size = packSize(sku);
              const unit = packLabel(sku);
              const line = lines[id];
              const stock = available?.[id];
              const short = stock !== undefined && stock < quantity;
              const mrp = listPriceOf(sku);
              return (
                <li key={id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  {/* Row 1: what it is · how many */}
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-slate-900">{sku?.name || sku?.code}</p>
                      <p className="text-xs tabular-nums text-slate-500">
                        {size > 1 ? `${quantity} pcs` : null}
                        {size > 1 && mrp ? " · " : null}
                        {mrp ? `MRP ${formatRupee(mrp * size)} / ${unit}` : null}
                      </p>
                    </div>
                    {/* − count + with the unit beside the count, so it reads "2 ladi", not 2 pieces.
                        − on the last ladi removes the product. */}
                    <div className="flex h-11 shrink-0 items-center rounded-xl bg-slate-900 text-white">
                      <button type="button" onClick={() => step(sku, -1)} aria-label={`One ${unit} less of ${sku?.name}`} className="flex h-full w-11 cursor-pointer items-center justify-center">
                        <Minus className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                      <span className="flex min-w-[4.5rem] items-baseline justify-center gap-1 px-1" aria-label={`${quantity / size} ${unit}`}>
                        <span className="text-base font-semibold tabular-nums">{quantity / size}</span>
                        <span className="text-sm text-white/70">{unit}</span>
                      </span>
                      <button type="button" onClick={() => step(sku, 1)} aria-label={`One ${unit} more of ${sku?.name}`} className="flex h-full w-11 cursor-pointer items-center justify-center">
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                  {/* Row 2: price per ladi (editable) · line total, aligned under the stepper */}
                  <div className="flex items-center justify-between gap-3">
                    {editingPrice === id ? (
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            autoFocus
                            aria-label={`Price per ${unit}`}
                            value={line.packPrice}
                            onChange={(event) => setPackPrice(id, event.target.value)}
                            onBlur={() => setEditingPrice(null)}
                            onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                            className="h-10 w-28 rounded-xl border border-slate-300 pl-7 pr-3 text-right text-base tabular-nums text-slate-900 focus:border-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/25"
                          />
                        </span>
                        <span>/ {unit}</span>
                      </label>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingPrice(id)}
                        aria-label={`Edit price per ${unit}`}
                        className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-sm tabular-nums text-slate-700"
                      >
                        <span className="font-semibold">{formatRupee(unitPrice * size)}</span>
                        <span className="text-slate-500">/ {unit}</span>
                        <Pencil className="ml-0.5 h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      </button>
                    )}
                    <p className="text-sm font-semibold tabular-nums text-slate-900">{formatRupee(unitPrice * quantity)}</p>
                  </div>
                  {short ? <p className="text-xs text-amber-600">Only {stock} pcs in stock right now</p> : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </FieldSection>

      {/* Payment: the same two-column shape as brand / warehouse. Blank received = credit. */}
      <FieldSection title="Payment">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Received</span>
            <span className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400">₹</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                placeholder="0"
                className={`${FIELD_CONTROL} pl-7 text-right tabular-nums`}
              />
            </span>
          </label>
          <FieldSelect
            label="Mode"
            value={isCredit ? "CREDIT" : paymentMode}
            onChange={setPaymentMode}
            disabled={isCredit}
            options={isCredit ? [["CREDIT", "Credit"]] : PAYMENT_MODES}
          />
        </div>
        <p className="text-xs text-slate-500">
          {isCredit ? "Nothing received, so this is a credit order." : "Leave Received blank for a credit order."}
        </p>
      </FieldSection>

      {itemCount ? <BillSummary totals={totals} itemCount={itemCount} received={isCredit ? 0 : collected} /> : null}

      {lookupError ? <p className="text-sm text-rose-600">{lookupError}</p> : null}

      {/* Desktop: the button sits under the bill. Phones use the bar below. */}
      <div className="hidden items-center justify-end gap-4 lg:flex">
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button type="submit" disabled={!canSubmit} className="h-12 rounded-2xl bg-slate-900 px-6 text-sm font-semibold text-white disabled:opacity-50">
          {submitLabel}
        </button>
      </div>

      <MobileActionBar notice={error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}>
        <div className="min-w-0 shrink-0 pr-1">
          <p className="text-base font-semibold tabular-nums text-slate-900">{formatRupee(totals.grand)}</p>
          <p className="text-xs text-slate-500">
            {itemCount ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : "No items yet"}
          </p>
        </div>
        <button type="submit" disabled={!canSubmit} className={BAR_ACTION_PRIMARY}>
          {submitLabel}
        </button>
      </MobileActionBar>
    </form>
  );
}

// A labelled native select: on a phone it opens the system picker, which is clearer than a row
// of pill buttons and keeps every field the same height.
function FieldSelect({ label, value, onChange, options, disabled = false }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={`${FIELD_CONTROL} cursor-pointer appearance-none truncate pr-9 font-semibold disabled:cursor-default`}
        >
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </span>
    </label>
  );
}

// Receipt-style: the numbers a salesman reads back to the shopkeeper, in the order they add up.
function BillSummary({ totals, itemCount, received }) {
  const due = roundToTwo(Math.max(totals.grand - (received || 0), 0));
  const row = (label, value, className = "text-slate-600") => (
    <div className={`flex items-baseline justify-between gap-3 ${className}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
  return (
    <FieldSection title="Bill summary" meta={`${itemCount} item${itemCount === 1 ? "" : "s"}`} aria-label="Bill summary">
      <dl className="space-y-1.5 text-sm">
        {row("MRP total", formatRupee(totals.mrp))}
        {row("Discount", `− ${formatRupee(totals.discount)}`, "text-emerald-700")}
        {row("GST (included)", formatRupee(totals.gst), "text-slate-400")}
      </dl>
      <div className="border-t border-dashed border-slate-300" />
      <dl className="space-y-1.5 text-sm">
        {row("Order total", formatRupee(totals.grand), "text-base font-semibold text-slate-900")}
        {received > 0 ? row("Received", `− ${formatRupee(received)}`) : null}
        {row(received > 0 ? "Balance due" : "Due on credit", formatRupee(due), "font-semibold text-slate-700")}
      </dl>
    </FieldSection>
  );
}
