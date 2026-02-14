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
  brands = [],
  onItemChange,
  onAddItem,
  onRemoveItem,
  canEditDiscount = true,
  wrapSkuSelect = true
}) {
  const skuMap = useMemo(() => new Map(skus.map((sku) => [String(sku.id), sku])), [skus]);
  const orderTotal = useMemo(() => getOrderTotal(items, skuMap), [items, skuMap]);
  const totalDiscount = useMemo(() => getOrderDiscountTotal(items), [items]);
  const gridClassName =
    "grid gap-3 md:grid-cols-[0.25fr_1.4fr_2.4fr_0.9fr_0.9fr_1fr_1fr_1.1fr_auto]";

  return (
    <>
      <div className="space-y-3">
        <div>
          <div className={`${gridClassName} text-xs uppercase tracking-widest text-slate-400`}>
            <span>#</span>
            <span>Brand</span>
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
            const availableSkus = item.brandId
              ? skus.filter((skuItem) => String(skuItem.brand_id) === String(item.brandId))
              : skus;
            const discountPercent = getLineDiscountPercent(item);
            const discountPercentValue = discountPercent
              ? String(Math.round(discountPercent * 10) / 10)
              : "0";
            const mrpValue = sku?.mrp ?? "";
            return (
              <div key={`line-${index}`} className={gridClassName}>
                <div className="flex items-center text-xs font-semibold text-slate-500">
                  {index + 1}
                </div>
                {wrapSkuSelect ? (
                  <div className="flex h-9 w-full min-w-0 items-center rounded-2xl border border-slate-200 bg-white px-3">
                    <select
                      value={item.brandId}
                      onChange={(event) => {
                        const nextBrandId = event.target.value;
                        const selectedSku = skuMap.get(String(item.skuId));
                        const skuMatchesBrand = nextBrandId
                          ? selectedSku && String(selectedSku.brand_id) === String(nextBrandId)
                          : true;
                        onItemChange(index, {
                          brandId: nextBrandId,
                          skuId: skuMatchesBrand ? item.skuId : ""
                        });
                      }}
                      className="h-full w-full border-0 bg-transparent p-0 text-sm text-slate-700 appearance-none"
                    >
                      <option value="">Select brand</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <select
                    value={item.brandId}
                    onChange={(event) => {
                      const nextBrandId = event.target.value;
                      const selectedSku = skuMap.get(String(item.skuId));
                      const skuMatchesBrand = nextBrandId
                        ? selectedSku && String(selectedSku.brand_id) === String(nextBrandId)
                        : true;
                      onItemChange(index, {
                        brandId: nextBrandId,
                        skuId: skuMatchesBrand ? item.skuId : ""
                      });
                    }}
                    className={inputClassName}
                  >
                    <option value="">Select brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                )}
                {wrapSkuSelect ? (
                  <div className="flex h-9 w-full min-w-0 items-center rounded-2xl border border-slate-200 bg-white px-3">
                    <select
                      value={item.skuId}
                      onChange={(event) => {
                        const skuId = event.target.value;
                        const selectedSku = skuMap.get(String(skuId));
                        onItemChange(index, {
                          skuId,
                          brandId: selectedSku?.brand_id ? String(selectedSku.brand_id) : item.brandId
                        });
                      }}
                      className="h-full w-full border-0 bg-transparent p-0 text-sm text-slate-700 appearance-none"
                    >
                      <option value="">Select SKU</option>
                      {availableSkus.map((skuItem) => (
                        <option key={skuItem.id} value={skuItem.id}>
                          {skuItem.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <select
                    value={item.skuId}
                    onChange={(event) => {
                      const skuId = event.target.value;
                      const selectedSku = skuMap.get(String(skuId));
                      onItemChange(index, {
                        skuId,
                        brandId: selectedSku?.brand_id ? String(selectedSku.brand_id) : item.brandId
                      });
                    }}
                    className={inputClassName}
                  >
                    <option value="">Select SKU</option>
                    {availableSkus.map((skuItem) => (
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
