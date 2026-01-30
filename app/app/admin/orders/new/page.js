"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiEndpoints, apiFetch } from "@/lib/api";
import QuickCreatePanel from "@/components/admin/QuickCreatePanel";
import OrderLineItemsTable from "@/components/orders/OrderLineItemsTable";
import SectionCard from "@/components/layout/SectionCard";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import { getAccessToken, getRoleFromToken } from "@/lib/auth";
import useAdminLookups from "@/lib/hooks/useAdminLookups";
import useLineItems from "@/lib/hooks/useLineItems";
import { createEmptyOrderItem, getSkuGstRate } from "@/lib/orders";

export default function AdminOrderCreate() {
  const router = useRouter();
  const [retailerId, setRetailerId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [salesmanId, setSalesmanId] = useState("");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const { items, updateItem, addItem, removeItem } = useLineItems(createEmptyOrderItem);
  const {
    retailers,
    skus,
    warehouses,
    salesmen,
    warehouseManagers,
    loading,
    error: lookupError,
    refreshLookups
  } = useAdminLookups({
    errorMessage: "Unable to load order form data."
  });
  const skuMap = useMemo(() => new Map(skus.map((sku) => [String(sku.id), sku])), [skus]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const role = useMemo(() => getRoleFromToken(getAccessToken()), []);
  const canEditDiscount = useMemo(() => role === "SALESMAN" || role === "ACCOUNTANT" || role === "ADMIN", [role]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!retailerId) {
      setError("Select a retailer before submitting.");
      return;
    }
    if (!salesmanId) {
      setError("Select a salesman before submitting.");
      return;
    }
    const payloadItems = items
      .map((item) => {
        const skuId = Number(item.skuId);
        const sku = skuMap.get(String(item.skuId));
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        const discount = canEditDiscount ? Number(item.discount) || 0 : 0;
        const gstRate = getSkuGstRate(sku);
        if (!skuId || !quantity || !unitPrice || !sku) {
          return null;
        }
        return {
          sku_id: skuId,
          quantity,
          unit_price: unitPrice,
          discount_amount: discount,
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
          salesman_id: Number(salesmanId),
          payment_mode: paymentMode,
          payment_amount: paymentAmountValue,
          order_date: orderDate || null,
          items: payloadItems
        })
      });
      router.push(`/app/admin/orders/${response.id}`);
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
        subtitle="Register an outgoing order for a retailer."
        actions={
          <Link
            href="/app/admin/orders"
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
              <SelectBar value={retailerId} onChange={(event) => setRetailerId(event.target.value)} className="mt-2">
                <option value="">Select retailer</option>
                {retailers.map((retailer) => (
                  <option key={retailer.id} value={retailer.id}>
                    {retailer.name}
                  </option>
                ))}
              </SelectBar>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400">Order date (optional)</label>
              <InputBar
                type="date"
                value={orderDate}
                onChange={(event) => setOrderDate(event.target.value)}
                className="mt-2"
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
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400">Salesman</label>
              <SelectBar
                value={salesmanId}
                onChange={(event) => setSalesmanId(event.target.value)}
                className="mt-2"
                required
              >
                <option value="">Select salesman</option>
                {salesmen.map((salesman) => (
                  <option key={salesman.id} value={salesman.id}>
                    {salesman.name}
                  </option>
                ))}
              </SelectBar>
            </div>
            <div>
              {paymentMode !== "CREDIT" ? (
                <>
                  <label className="text-xs uppercase tracking-widest text-slate-400">Payment amount</label>
                  <InputBar
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    className="mt-2"
                    placeholder="Enter payment amount"
                    required
                  />
                </>
              ) : null}
            </div>
          </div>

          <OrderLineItemsTable
            items={items}
            skus={skus}
            onItemChange={updateItem}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            canEditDiscount={canEditDiscount}
          />

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
      <QuickCreatePanel
        entities={["warehouse", "retailer", "sku"]}
        salesmen={salesmen}
        warehouseManagers={warehouseManagers}
        onCreated={refreshLookups}
      />
    </div>
  );
}
