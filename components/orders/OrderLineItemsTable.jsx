"use client";

import { useMemo } from "react";
import {
  getLineTaxAmount,
  getLineTotal,
  roundToTwo
} from "@/lib/orders";

const inputClassName =
  "w-full min-w-0 h-9 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm";

export default function OrderLineItemsTable({
  items,
  skus,
  selectedBrandId,
  pricingMode = "discount",
  onItemChange,
  onAddItem,
  onRemoveItem,
  canEditDiscount = true,
  wrapSkuSelect = true
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
  const gridClassName =
    "grid gap-3 items-center md:grid-cols-[2.5rem_2.6fr_7rem_7rem_7rem_8rem_8rem_8rem_3.5rem]";
  const filteredSkus = useMemo(() => {
    if (!selectedBrandId) return [];
    return skus.filter((sku) => String(sku.brand_id) === String(selectedBrandId));
  }, [skus, selectedBrandId]);
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
    "flex h-9 items-center justify-end gap-1 px-3 text-right text-sm text-slate-500 tabular-nums";
  const currencySymbolClass = "text-slate-400 leading-none";
  const currencyInputWrapClass = "flex h-9 w-full items-center justify-end gap-1";
  const currencyInputClass = (isEditable) =>
    `${resolveNumericInputClass(isEditable)} w-20`;
  const totalsRowClassName = `${gridClassName} text-sm text-slate-700`;
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
          <div className={`${gridClassName} text-xs uppercase tracking-widest text-slate-400`}>
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
            const sku = skuMap.get(String(item.skuId));
            const mrpValue = getSkuListPrice(sku);
            const lineTotalValue = sku ? currencyFormatter.format(getLineTotal(item, sku)) : "";
            return (
              <div key={`line-${index}`} className={`${gridClassName} items-center`}>
                <div className="flex items-center text-xs font-semibold text-slate-500">
                  {index + 1}
                </div>
                {wrapSkuSelect ? (
                  <div className="flex h-9 w-full min-w-0 items-center rounded-2xl border border-slate-200 bg-white px-3">
                    <select
                      value={item.skuId}
                      disabled={!selectedBrandId}
                      onChange={(event) => {
                        const skuId = event.target.value;
                        const selectedSku = skuMap.get(String(skuId));
                        applyItemChange(index, {
                          skuId,
                          brandId: selectedSku?.brand_id ? String(selectedSku.brand_id) : item.brandId
                        });
                      }}
                      className="h-full w-full border-0 bg-transparent p-0 text-sm text-slate-700 appearance-none"
                    >
                      <option value="">{selectedBrandId ? "Select SKU" : "Select brand above"}</option>
                      {filteredSkus.map((skuItem) => (
                        <option key={skuItem.id} value={skuItem.id}>
                          {skuItem.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <select
                    value={item.skuId}
                    disabled={!selectedBrandId}
                    onChange={(event) => {
                      const skuId = event.target.value;
                      const selectedSku = skuMap.get(String(skuId));
                      applyItemChange(index, {
                        skuId,
                        brandId: selectedSku?.brand_id ? String(selectedSku.brand_id) : item.brandId
                      });
                    }}
                    className={inputClassName}
                  >
                    <option value="">{selectedBrandId ? "Select SKU" : "Select brand above"}</option>
                    {filteredSkus.map((skuItem) => (
                      <option key={skuItem.id} value={skuItem.id}>
                        {skuItem.name}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={item.quantity}
                  onChange={(event) => applyItemChange(index, { quantity: event.target.value })}
                  className={`${inputClassName} text-right tabular-nums`}
                  placeholder="0"
                />
                <div className={currencyCellClass}>
                  {mrpValue ? <span className={currencySymbolClass}>₹</span> : null}
                  <span>{mrpValue ? currencyFormatter.format(Number(mrpValue) || 0) : "—"}</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={item.discountPercent ?? "0"}
                  onChange={(event) => {
                    if (!isPercentEditable) return;
                    applyItemChange(index, { discountPercent: event.target.value });
                  }}
                  readOnly={!isPercentEditable}
                  className={resolveNumericInputClass(isPercentEditable)}
                  placeholder="0"
                />
                <div className={currencyInputWrapClass}>
                  <span className={currencySymbolClass}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
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
                <div className={currencyInputWrapClass}>
                  <span className={currencySymbolClass}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
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
                <div className={currencyCellClass}>
                  {lineTotalValue ? <span className={currencySymbolClass}>₹</span> : null}
                  <span>{lineTotalValue || "—"}</span>
                </div>
                <div className="flex items-center justify-end text-xs text-slate-500 whitespace-nowrap">
                  {items.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => onRemoveItem(index)}
                      className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 text-rose-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Remove line item"
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
                  ) : null}
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
          className="mr-auto rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
        >
          Add Line
        </button>
        <div className="ml-auto w-full space-y-2">
          <div className={totalsRowClassName}>
            <span className="md:col-span-7 text-right text-slate-500">Order total</span>
            <span className="md:col-span-2 md:col-start-8 text-right font-semibold tabular-nums">
              {formatRupee(orderBaseTotal)}
            </span>
          </div>
          <div className={totalsRowClassName}>
            <span className="md:col-span-7 text-right text-slate-500">(-) Total discount</span>
            <span className="md:col-span-2 md:col-start-8 text-right font-semibold tabular-nums">
              {formatRupee(totalDiscount)}
            </span>
          </div>
          <div className={totalsRowClassName}>
            <span className="md:col-span-7 text-right text-slate-500">Pre-GST total</span>
            <span className="md:col-span-2 md:col-start-8 text-right font-semibold tabular-nums">
              {formatRupee(preGstTotal)}
            </span>
          </div>
          <div className={totalsRowClassName}>
            <span className="md:col-span-7 text-right text-slate-500">GST</span>
            <span className="md:col-span-2 md:col-start-8 text-right font-semibold tabular-nums">
              {formatRupee(taxTotal)}
            </span>
          </div>
          <div className={totalsRowClassName}>
            <span className="md:col-span-7 text-right text-slate-700 font-semibold">Grand total</span>
            <span className="md:col-span-2 md:col-start-8 text-right font-semibold tabular-nums">
              {formatRupee(grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
