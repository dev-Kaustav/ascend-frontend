"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiEndpoints, apiFetch } from "@/lib/api";
import QuickCreatePanel from "@/components/admin/QuickCreatePanel";
import OrderLineItemsTable from "@/components/orders/OrderLineItemsTable";
import SectionCard from "@/components/layout/SectionCard";
import SearchSelect from "@/components/ui/SearchSelect";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import useAdminLookups from "@/lib/hooks/useAdminLookups";
import useLineItems from "@/lib/hooks/useLineItems";
import { createEmptyOrderItem, getOrderTotal, getSkuGstRate, roundToTwo } from "@/lib/orders";
import { useToast } from "@/components/ui/ToastProvider";

export default function AccountantOrderCreate() {
  const router = useRouter();
  const getTodayDate = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };
  const [retailerId, setRetailerId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [salesmanId, setSalesmanId] = useState("");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [brandId, setBrandId] = useState("");
  const [orderDate, setOrderDate] = useState(getTodayDate);
  const [pricingMode, setPricingMode] = useState("discount");
  const { items, updateItem, addItem, removeItem, setItems } = useLineItems(createEmptyOrderItem, 5);
  const { retailers, skus, warehouses, salesmen, brands, loading, error: lookupError, refreshLookups } = useAdminLookups({
    errorMessage: "Unable to load order form data."
  });
  const skuMap = useMemo(() => new Map(skus.map((sku) => [String(sku.id), sku])), [skus]);
  const retailerOptions = useMemo(
    () =>
      retailers.map((retailer) => ({
        value: String(retailer.id),
        label: retailer.name,
        hint: retailer.city || "",
        keywords: [retailer.city, retailer.mobile_number]
      })),
    [retailers]
  );
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
    []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useToast();
  const formatRupee = (value) => `₹${currencyFormatter.format(Number(value) || 0)}`;
  const orderGrandTotal = useMemo(() => getOrderTotal(items, skuMap), [items, skuMap]);
  const paymentPending = useMemo(() => {
    if (paymentMode === "CREDIT") return orderGrandTotal;
    const received = Number(paymentAmount);
    const safeReceived = Number.isFinite(received) ? received : 0;
    return roundToTwo(Math.max(orderGrandTotal - safeReceived, 0));
  }, [paymentAmount, paymentMode, orderGrandTotal]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!retailerId) {
      setError("Select a retailer before submitting.");
      return;
    }
    if (!brandId) {
      setError("Select a brand before submitting.");
      return;
    }
    if (!orderDate) {
      setError("Order date is required.");
      return;
    }
    const payloadItems = items
      .map((item) => {
        const skuId = Number(item.skuId);
        const sku = skuMap.get(String(item.skuId));
        const quantity = Number(item.quantity);
        const listPrice = Number(sku?.mrp ?? sku?.rate);
        const discountPerUnit = Number(item.discount) || 0;
        const resolvedListPrice = Number.isFinite(listPrice) && listPrice > 0
          ? listPrice
          : Number(item.unitPrice || 0) + discountPerUnit;
        const unitPrice = resolvedListPrice;
        const gstRate = getSkuGstRate(sku);
        if (!skuId || !quantity || !unitPrice || !sku) {
          return null;
        }
        return {
          sku_id: skuId,
          quantity,
          unit_price: unitPrice,
          discount_amount: roundToTwo(discountPerUnit * quantity),
          taxes: gstRate > 0 ? [{ tax_type: "GST", rate: gstRate }] : []
        };
      })
      .filter(Boolean);

    if (!payloadItems.length) {
      setError("Add at least one line item with SKU, quantity, and unit price.");
      return;
    }

    const trimmedPaymentAmount = paymentAmount.trim();
    if (paymentMode !== "CREDIT" && !trimmedPaymentAmount) {
      setError("Enter a payment amount.");
      return;
    }
    const paymentAmountValue = paymentMode === "CREDIT" ? null : Number(trimmedPaymentAmount);
    if (paymentMode !== "CREDIT" && (!Number.isFinite(paymentAmountValue) || paymentAmountValue <= 0)) {
      setError("Payment amount must be a positive number.");
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch(apiEndpoints.orders.create, {
        method: "POST",
        body: JSON.stringify({
          retailer_id: Number(retailerId),
          warehouse_id: warehouseId ? Number(warehouseId) : null,
          salesman_id: salesmanId ? Number(salesmanId) : null,
          payment_mode: paymentMode,
          payment_amount: paymentAmountValue,
          order_date: orderDate,
          items: payloadItems
        })
      });
      notify("Order created.");
      router.push("/app/orders");
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to create order.");
    } finally {
      setSaving(false);
    }
  }


  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading order form…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Create Order"
        subtitle="Punch orders submitted by salesmen."
        actions={
          <Link
            href="/app/orders"
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
          >
            Back to Orders
          </Link>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400">Retailer</label>
              <SearchSelect
                value={retailerId}
                onChange={setRetailerId}
                options={retailerOptions}
                placeholder="Search retailers by name, city or phone"
                emptyLabel="No retailers match"
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400">Order date</label>
              <InputBar
                type="date"
                value={orderDate}
                onChange={(event) => setOrderDate(event.target.value)}
                className="mt-2"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400">Warehouse (optional)</label>
              <SelectBar value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="mt-2">
                <option value="">Auto-assign</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </SelectBar>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400">Brand</label>
              <SelectBar
                value={brandId}
                onChange={(event) => {
                  const nextBrandId = event.target.value;
                  setBrandId(nextBrandId);
                  setItems((prev) =>
                    prev.map((item) => {
                      const sku = skuMap.get(String(item.skuId));
                      const skuMatches = nextBrandId
                        ? sku && String(sku.brand_id) === String(nextBrandId)
                        : false;
                      return {
                        ...item,
                        brandId: nextBrandId,
                        skuId: skuMatches ? item.skuId : "",
                        unitPrice: skuMatches ? item.unitPrice : "",
                        discount: skuMatches ? item.discount : "0",
                        discountPercent: skuMatches ? item.discountPercent : "0",
                        discountLastEdited: skuMatches ? item.discountLastEdited : "amount"
                      };
                    })
                  );
                }}
                className="mt-2"
                required
              >
                <option value="">Select brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </SelectBar>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400">Payment mode</label>
              <SelectBar
                value={paymentMode}
                onChange={(event) => {
                  const value = event.target.value;
                  setPaymentMode(value);
                  if (value === "CREDIT") {
                    setPaymentAmount("");
                  }
                }}
                className="mt-2"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CREDIT">Credit</option>
              </SelectBar>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400">Salesman (optional)</label>
              <SelectBar value={salesmanId} onChange={(event) => setSalesmanId(event.target.value)} className="mt-2">
                <option value="">Select salesman</option>
                {salesmen.map((salesman) => (
                  <option key={salesman.id} value={salesman.id}>
                    {salesman.name}
                  </option>
                ))}
              </SelectBar>
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-200 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-widest text-slate-400">Order items</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[11px] uppercase tracking-widest text-slate-400">Edit by</span>
                {[
                  { value: "percent", label: "Discount %" },
                  { value: "discount", label: "Discount" },
                  { value: "unit", label: "Unit price" }
                ].map((option) => {
                  const isActive = pricingMode === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="accountant-pricing-mode"
                        value={option.value}
                        checked={isActive}
                        onChange={() => setPricingMode(option.value)}
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </div>
            <OrderLineItemsTable
              items={items}
              skus={skus}
              selectedBrandId={brandId}
              pricingMode={pricingMode}
              onItemChange={updateItem}
              onAddItem={addItem}
              onRemoveItem={removeItem}
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {paymentMode !== "CREDIT" ? (
              <div className="w-full space-y-2">
                <div className="grid items-center gap-3 md:grid-cols-[2.5rem_2.6fr_7rem_7rem_7rem_8rem_8rem_8rem_3.5rem]">
                  <span className="md:col-span-7 text-right text-sm font-semibold text-slate-700">
                    Payment received
                  </span>
                  <div className="md:col-span-2 md:col-start-8">
                    <InputBar
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder="Enter amount"
                      required
                      className="text-right tabular-nums"
                    />
                  </div>
                </div>
                <div className="grid items-center gap-3 text-sm text-slate-600 md:grid-cols-[2.5rem_2.6fr_7rem_7rem_7rem_8rem_8rem_8rem_3.5rem]">
                  <span className="md:col-span-7 text-right text-sm font-semibold text-slate-500">
                    Payment pending
                  </span>
                  <span className="md:col-span-2 md:col-start-8 text-right font-semibold tabular-nums">
                    {formatRupee(paymentPending)}
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-sm font-semibold text-slate-500">
                Credit order. Pending amount: {formatRupee(orderGrandTotal)}
              </span>
            )}
          </div>

          {lookupError ? <p className="text-sm text-rose-500">{lookupError}</p> : null}
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create Order"}
            </button>
          </div>
        </form>
      </SectionCard>
      <QuickCreatePanel entities={["brand", "sku"]} brands={brands} onCreated={refreshLookups} />
    </div>
  );
}
