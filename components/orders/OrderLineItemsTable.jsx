"use client";

import { useMemo } from "react";
import SearchSelect from "@/components/ui/SearchSelect";
import {
  getLineTaxAmount,
  getLineTotal,
  roundToTwo
} from "@/lib/orders";

const inputClassName =
  "w-full min-w-0 h-11 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base lg:h-9 lg:text-sm";

export default function OrderLineItemsTable({
  items,
  skus,
  available,
  selectedBrandId,
  pricingMode = "discount",
  onItemChange,
  onAddItem,
  onRemoveItem,
  canEditDiscount = true
}) {
  const skuMap = useMemo(() => new Map(skus.map((sku) => [String(sku.id), sku])), [skus]);
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
    []
  );
  const formatRupee = (value) => `₹${currencyFormatter.format(Number(value) || 0)}`;
  // Desktop only. Below md the same fields are re-laid-out as labelled cards, because nine
  // unlabelled controls stacked in one column tells a phone user nothing.
  const gridColumnsClassName = "lg:grid-cols-[2.5rem_2.6fr_7rem_7rem_7rem_8rem_8rem_8rem_3.5rem]";
  const desktopRowClassName = `hidden gap-3 items-center lg:grid ${gridColumnsClassName}`;
  // The one blank line phones are allowed to show. -1 once every line carries a SKU, which
  // is also when "Add SKU" becomes the only way to get another one.
  const firstBlankIndex = items.findIndex((item) => !item.skuId);
  const filteredSkus = useMemo(() => {
    if (!selectedBrandId) return [];
    return skus.filter((sku) => String(sku.brand_id) === String(selectedBrandId));
  }, [skus, selectedBrandId]);
  // Name, not code: on the order form the person booking is looking for a product they can
  // recognise. The code stays in keywords, so typing it still finds the row — it just is not
  // what gets shown. Falls back to the code, then the id, for SKUs with no name.
  const skuOptions = useMemo(
    () =>
      filteredSkus.map((sku) => ({
        value: String(sku.id),
        label: sku.name || sku.code || `SKU ${sku.id}`,
        keywords: [sku.code]
      })),
    [filteredSkus]
  );
  const getDefaultDiscount = (sku) => {
    if (!sku) return "0";
    if (sku.discount_amount !== null && sku.discount_amount !== undefined) {
      return String(sku.discount_amount);
    }
    return "0";
  };
  const parseNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };
  const roundTo = (value, decimals) => {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  };
  const getSkuListPrice = (sku) => {
    if (!sku) return "";
    if (sku.mrp !== null && sku.mrp !== undefined) {
      return String(sku.mrp);
    }
    if (sku.rate !== null && sku.rate !== undefined) {
      return String(sku.rate);
    }
    return "";
  };
  const orderBaseTotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const sku = skuMap.get(String(item.skuId));
        const listPrice = parseNumber(getSkuListPrice(sku));
        const quantity = parseNumber(item.quantity);
        return sum + listPrice * quantity;
      }, 0),
    [items, skuMap]
  );
  const totalDiscount = useMemo(
    () =>
      items.reduce((sum, item) => {
        const quantity = parseNumber(item.quantity);
        const discount = parseNumber(item.discount);
        return sum + discount * quantity;
      }, 0),
    [items]
  );
  const taxTotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + getLineTaxAmount(item, skuMap.get(String(item.skuId))),
        0
      ),
    [items, skuMap]
  );
  const grandTotal = roundToTwo(Math.max(orderBaseTotal - totalDiscount, 0));
  const preGstTotal = roundToTwo(Math.max(grandTotal - taxTotal, 0));
  const resolveFromPercent = (percentValue, listPrice) => {
    const safePercent = Math.max(0, Math.min(100, parseNumber(percentValue)));
    const discount = roundTo((safePercent / 100) * listPrice, 2);
    const unitPrice = roundTo(Math.max(listPrice - discount, 0), 2);
    return { discount, discountPercent: safePercent, unitPrice };
  };
  const resolveFromDiscount = (discountValue, listPrice) => {
    const safeDiscount = Math.max(0, Math.min(listPrice, parseNumber(discountValue)));
    const unitPrice = roundTo(Math.max(listPrice - safeDiscount, 0), 2);
    const discountPercent = listPrice ? roundTo((safeDiscount / listPrice) * 100, 1) : 0;
    return { discount: safeDiscount, discountPercent, unitPrice };
  };
  const resolveFromUnitPrice = (unitPriceValue, listPrice) => {
    const safeUnit = Math.max(0, Math.min(listPrice, parseNumber(unitPriceValue)));
    const discount = roundTo(Math.max(listPrice - safeUnit, 0), 2);
    const discountPercent = listPrice ? roundTo((discount / listPrice) * 100, 1) : 0;
    return { discount, discountPercent, unitPrice: safeUnit };
  };
  const getEditableField = () => {
    if (pricingMode === "percent") return "percent";
    if (pricingMode === "unit") return "unit";
    return "discount";
  };
  const isPercentEditable = canEditDiscount && getEditableField() === "percent";
  const isDiscountEditable = canEditDiscount && getEditableField() === "discount";
  const isUnitEditable = canEditDiscount && getEditableField() === "unit";
  const resolveInputClass = (isEditable) =>
    `${inputClassName} ${isEditable ? "" : "border-transparent bg-transparent text-slate-500"}`;
  const resolveNumericInputClass = (isEditable) =>
    `${resolveInputClass(isEditable)} text-right tabular-nums`;
  const headerNumericClass = "text-right pr-3";
  const currencyCellClass =
    "flex h-11 items-center justify-end gap-1 px-3 text-right text-base text-slate-500 tabular-nums lg:h-9 lg:text-sm";
  const currencySymbolClass = "text-slate-400 leading-none";
  const currencyInputWrapClass = "flex h-11 w-full items-center justify-end gap-1 lg:h-9";
  const currencyInputClass = (isEditable) =>
    `${resolveNumericInputClass(isEditable)} w-full lg:w-20`;
  // Label left, figure right on a phone; the desktop grid keeps them aligned to the columns.
  const totalsRowClassName = `flex items-center justify-between gap-3 text-sm text-slate-700 lg:grid lg:gap-3 ${gridColumnsClassName}`;
  const applyItemChange = (index, patch) => {
    const current = items[index] || {};
    let next = { ...current, ...patch };
    if (selectedBrandId) {
      next.brandId = String(selectedBrandId);
    }
    const sku = skuMap.get(String(next.skuId));
    const listPrice =
      parseNumber(getSkuListPrice(sku)) ||
      (parseNumber(next.unitPrice) + parseNumber(next.discount));
    if ("skuId" in patch) {
      const selectedSku = skuMap.get(String(patch.skuId));
      if (patch.skuId) {
        if (selectedSku?.brand_id) {
          next.brandId = String(selectedSku.brand_id);
        }
        const basePrice = parseNumber(getSkuListPrice(selectedSku));
        const defaultPercent =
          selectedSku?.discount_percent !== null && selectedSku?.discount_percent !== undefined
            ? String(selectedSku.discount_percent)
            : null;
        const defaultAmount = getDefaultDiscount(selectedSku);
        if (defaultPercent !== null) {
          const resolved = resolveFromPercent(defaultPercent, basePrice);
          next.discount = String(resolved.discount);
          next.discountPercent = String(resolved.discountPercent);
          next.unitPrice = String(resolved.unitPrice);
        } else {
          const resolved = resolveFromDiscount(defaultAmount, basePrice);
          next.discount = String(resolved.discount);
          next.discountPercent = String(resolved.discountPercent);
          next.unitPrice = String(resolved.unitPrice);
        }
        next.discountLastEdited = defaultPercent ? "percent" : "amount";
      } else {
        next.discount = "0";
        next.discountPercent = "0";
        next.unitPrice = "";
        next.discountLastEdited = "amount";
      }
    }
    if (patch.skuId) {
      onItemChange(index, next);
      return;
    }

    if ("discountPercent" in patch) {
      const resolved = resolveFromPercent(next.discountPercent, listPrice);
      next.discount = String(resolved.discount);
      next.unitPrice = String(resolved.unitPrice);
      next.discountPercent = String(resolved.discountPercent);
      next.discountLastEdited = "percent";
    } else if ("discount" in patch) {
      const resolved = resolveFromDiscount(next.discount, listPrice);
      next.discount = String(resolved.discount);
      next.unitPrice = String(resolved.unitPrice);
      next.discountPercent = String(resolved.discountPercent);
      next.discountLastEdited = "amount";
    } else if ("unitPrice" in patch) {
      const resolved = resolveFromUnitPrice(next.unitPrice, listPrice);
      next.discount = String(resolved.discount);
      next.unitPrice = String(resolved.unitPrice);
      next.discountPercent = String(resolved.discountPercent);
      next.discountLastEdited = "unit";
    }
    onItemChange(index, next);
  };

  return (
    <>
      <div className="space-y-3">
        <div>
          <div className={`${desktopRowClassName} text-xs uppercase tracking-widest text-slate-400`}>
            <span>#</span>
            <span className="pl-3">SKU</span>
            <span className={headerNumericClass}>Quantity</span>
            <span className={headerNumericClass}>MRP</span>
            <span className={headerNumericClass}>Discount %</span>
            <span className={headerNumericClass}>Discount</span>
            <span className={headerNumericClass}>Unit price</span>
            <span className={headerNumericClass}>Line total</span>
            <span />
          </div>
          {items.map((item, index) => {
            // Phones show one SKU at a time: every line already carrying a SKU, plus the
            // single next blank one. The form seeds several blank lines for the desktop
            // grid, and on a phone those stack into a wall of empty cards you have to
            // scroll past. Desktop is untouched — this only gates the mobile card.
            const showOnMobile = Boolean(item.skuId) || index === firstBlankIndex;
            const sku = skuMap.get(String(item.skuId));
            const mrpValue = getSkuListPrice(sku);
            const lineTotalValue = sku ? currencyFormatter.format(getLineTotal(item, sku)) : "";

            // Built once and rendered into both layouts. Responsive classes handle the size
            // difference, so the phone and desktop views can never drift apart in behaviour.
            const skuField = (
              <SearchSelect
                value={item.skuId}
                disabled={!selectedBrandId}
                onChange={(skuId) => {
                  const selectedSku = skuMap.get(String(skuId));
                  applyItemChange(index, {
                    skuId,
                    brandId: selectedSku?.brand_id ? String(selectedSku.brand_id) : item.brandId
                  });
                }}
                options={skuOptions}
                placeholder={selectedBrandId ? "Search SKUs by name or code" : "Select brand above"}
                emptyLabel="No SKUs match"
                inputClassName="h-11 rounded-2xl px-3 py-0 text-base lg:h-9 lg:text-sm"
              />
            );
            // Allocatable units at the chosen warehouse, or null when there is nothing to
            // say (no warehouse picked, no SKU on the line, lookup failed). Advisory: it
            // never disables the input, because the server re-checks under a row lock and
            // a stale client-side block is the failure this hint exists to prevent.
            const availableForLine = item.skuId && available ? available[String(item.skuId)] : undefined;
            const isShort =
              availableForLine !== undefined && Number(item.quantity) > Number(availableForLine);
            const quantityField = (
              <div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  aria-label={`Quantity for line ${index + 1}`}
                  value={item.quantity}
                  onChange={(event) => applyItemChange(index, { quantity: event.target.value })}
                  className={`${inputClassName} text-right tabular-nums ${isShort ? "border-rose-300" : ""}`}
                  placeholder="0"
                />
                {availableForLine !== undefined ? (
                  <p className={`mt-1 text-right text-[11px] tabular-nums ${isShort ? "text-rose-500" : "text-slate-400"}`}>
                    {availableForLine} in stock
                  </p>
                ) : null}
              </div>
            );
            const mrpField = (
              <div className={currencyCellClass}>
                {mrpValue ? <span className={currencySymbolClass}>₹</span> : null}
                <span>{mrpValue ? currencyFormatter.format(Number(mrpValue) || 0) : "—"}</span>
              </div>
            );
            const discountPercentField = (
              <input
                type="number"
                min="0"
                step="0.1"
                aria-label={`Discount percent for line ${index + 1}`}
                value={item.discountPercent ?? "0"}
                onChange={(event) => {
                  if (!isPercentEditable) return;
                  applyItemChange(index, { discountPercent: event.target.value });
                }}
                readOnly={!isPercentEditable}
                className={resolveNumericInputClass(isPercentEditable)}
                placeholder="0"
              />
            );
            const discountField = (
              <div className={currencyInputWrapClass}>
                <span className={currencySymbolClass}>₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label={`Discount amount for line ${index + 1}`}
                  value={item.discount}
                  onChange={(event) => {
                    if (!isDiscountEditable) return;
                    applyItemChange(index, { discount: event.target.value });
                  }}
                  readOnly={!isDiscountEditable}
                  className={currencyInputClass(isDiscountEditable)}
                  placeholder="0.00"
                />
              </div>
            );
            const unitPriceField = (
              <div className={currencyInputWrapClass}>
                <span className={currencySymbolClass}>₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label={`Unit price for line ${index + 1}`}
                  value={item.unitPrice ?? ""}
                  onChange={(event) => {
                    if (!isUnitEditable) return;
                    applyItemChange(index, { unitPrice: event.target.value });
                  }}
                  readOnly={!isUnitEditable}
                  className={currencyInputClass(isUnitEditable)}
                  placeholder="0.00"
                />
              </div>
            );
            const lineTotalField = (
              <div className={currencyCellClass}>
                {lineTotalValue ? <span className={currencySymbolClass}>₹</span> : null}
                <span>{lineTotalValue || "—"}</span>
              </div>
            );
            const removeButton =
              items.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onRemoveItem(index)}
                  className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-rose-200 text-rose-500 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 lg:h-8 lg:w-8"
                  aria-label={`Remove line item ${index + 1}`}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M6 6l1 14h10l1-14" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              ) : null;

            const mobileField = (label, control) => (
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
                {control}
              </label>
            );

            return (
              <div key={`line-${index}`}>
                {/* Phone: a labelled card. Every control keeps its name, which the desktop
                    column header would otherwise be carrying. */}
                <div className={`mb-3 rounded-2xl border border-slate-200 bg-white p-3 lg:hidden ${showOnMobile ? "" : "hidden"}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Item {index + 1}
                    </span>
                    {item.skuId ? removeButton : null}
                  </div>
                  <div className="space-y-3">
                    {mobileField("SKU", skuField)}
                    {item.skuId ? <>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>MRP</span><span className="tabular-nums">{mrpValue ? `₹${currencyFormatter.format(Number(mrpValue))}` : "—"}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {mobileField("Quantity", quantityField)}
                      {pricingMode === "percent" ? mobileField("Discount %", discountPercentField) : pricingMode === "discount" ? mobileField("Discount", discountField) : mobileField("Unit price", unitPriceField)}
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                        Line total
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-slate-800">
                        {lineTotalValue ? `₹${lineTotalValue}` : "—"}
                      </span>
                    </div>
                    </> : null}
                  </div>
                </div>

                <div className={`${desktopRowClassName} items-center`}>
                  <div className="flex items-center text-xs font-semibold text-slate-500">{index + 1}</div>
                  {skuField}
                  {quantityField}
                  {mrpField}
                  {discountPercentField}
                  {discountField}
                  {unitPriceField}
                  {lineTotalField}
                  <div className="flex items-center justify-end text-xs text-slate-500 whitespace-nowrap">
                    {removeButton}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <button
          type="button"
          onClick={onAddItem}
          // On a phone there is already a blank line waiting whenever firstBlankIndex is
          // set, so the button would append a line the view cannot show. Desktop, which
          // renders every line as a grid row, always offers it.
          className={`mr-auto rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500 ${
            firstBlankIndex === -1 ? "" : "hidden lg:block"
          }`}
        >
          Add SKU
        </button>
        <div className="ml-auto w-full space-y-2">
          <div className={totalsRowClassName}>
            <span className="lg:col-span-7 text-right text-slate-500">Order total</span>
            <span className="lg:col-span-2 lg:col-start-8 text-right font-semibold tabular-nums">
              {formatRupee(orderBaseTotal)}
            </span>
          </div>
          <div className={totalsRowClassName}>
            <span className="lg:col-span-7 text-right text-slate-500">(-) Total discount</span>
            <span className="lg:col-span-2 lg:col-start-8 text-right font-semibold tabular-nums">
              {formatRupee(totalDiscount)}
            </span>
          </div>
          <div className={totalsRowClassName}>
            <span className="lg:col-span-7 text-right text-slate-500">Pre-GST total</span>
            <span className="lg:col-span-2 lg:col-start-8 text-right font-semibold tabular-nums">
              {formatRupee(preGstTotal)}
            </span>
          </div>
          <div className={totalsRowClassName}>
            <span className="lg:col-span-7 text-right text-slate-500">GST</span>
            <span className="lg:col-span-2 lg:col-start-8 text-right font-semibold tabular-nums">
              {formatRupee(taxTotal)}
            </span>
          </div>
          <div className={totalsRowClassName}>
            <span className="lg:col-span-7 text-right text-slate-700 font-semibold">Grand total</span>
            <span className="lg:col-span-2 lg:col-start-8 text-right font-semibold tabular-nums">
              {formatRupee(grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
