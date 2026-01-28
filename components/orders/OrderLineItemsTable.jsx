"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import {
  getLineDiscountPercent,
  getLineTotal,
  getOrderDiscountTotal,
  getOrderTotal
} from "@/lib/orders";

const inputClassName = "w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm";

export default function OrderLineItemsTable({
  items,
  skus,
  onItemChange,
  onAddItem,
  onRemoveItem,
  canEditDiscount = true,
  wrapSkuSelect = true
}) {
  const skuMap = useMemo(() => new Map(skus.map((sku) => [String(sku.id), sku])), [skus]);
  const orderTotal = useMemo(() => getOrderTotal(items, skuMap), [items, skuMap]);
  const totalDiscount = useMemo(() => getOrderDiscountTotal(items), [items]);

  return (
    <>
      <div className="space-y-3">
        <div>
          <div className="grid gap-3 text-xs uppercase tracking-widest text-slate-400 md:grid-cols-[2.2fr_0.9fr_0.9fr_1fr_1fr_1.1fr_auto]">
            <span>SKU</span>
            <span>Quantity</span>
            <span>MRP</span>
            <span>Unit Price</span>
            <span>Discount %</span>
            <span>Discount amount</span>
            <span />
          </div>
          {items.map((item, index) => {
            const sku = skuMap.get(String(item.skuId));
            const discountPercent = getLineDiscountPercent(item);
            const discountPercentValue = discountPercent
              ? String(Math.round(discountPercent * 10) / 10)
              : "0";
            const mrpValue = sku?.mrp ?? "";
            return (
              <div
                key={`line-${index}`}
                className="grid gap-3 md:grid-cols-[2.2fr_0.9fr_0.9fr_1fr_1fr_1.1fr_auto]"
              >
                {wrapSkuSelect ? (
                  <div className="flex h-9 w-full min-w-0 items-center rounded-2xl border border-slate-200 bg-white px-3">
                    <select
                      value={item.skuId}
                      onChange={(event) => onItemChange(index, { skuId: event.target.value })}
                      className="h-full w-full border-0 bg-transparent p-0 text-sm text-slate-700 appearance-none"
                    >
                      <option value="">Select SKU</option>
                      {skus.map((skuItem) => (
                        <option key={skuItem.id} value={skuItem.id}>
                          {skuItem.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <select
                    value={item.skuId}
                    onChange={(event) => onItemChange(index, { skuId: event.target.value })}
                    className={inputClassName}
                  >
                    <option value="">Select SKU</option>
                    {skus.map((skuItem) => (
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
                  onChange={(event) => onItemChange(index, { quantity: event.target.value })}
                  className={inputClassName}
                  placeholder="0"
                />
                <input
                  type="text"
                  value={mrpValue}
                  readOnly
                  className={inputClassName}
                  placeholder="MRP"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(event) => onItemChange(index, { unitPrice: event.target.value })}
                  className={inputClassName}
                  placeholder="0.00"
                />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={discountPercentValue}
                  readOnly
                  className={inputClassName}
                  placeholder="0"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.discount}
                  onChange={(event) => {
                    if (!canEditDiscount) return;
                    onItemChange(index, { discount: event.target.value });
                  }}
                  readOnly={!canEditDiscount}
                  className={inputClassName}
                  placeholder="0.00"
                />
                <div className="flex items-center justify-end text-xs text-slate-500">
                  <span>{formatCurrency(getLineTotal(item, sku))}</span>
                  {items.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => onRemoveItem(index)}
                      className="ml-3 text-rose-500 hover:text-rose-600"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onAddItem}
          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
        >
          Add Line
        </button>
        <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-700">
          <span>Order total: {formatCurrency(orderTotal)}</span>
          <span className="text-slate-500">Total discount: {formatCurrency(totalDiscount)}</span>
        </div>
      </div>
    </>
  );
}
