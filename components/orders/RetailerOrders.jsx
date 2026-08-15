"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/format";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import OrderDetailPanel from "@/components/orders/OrderDetailPanel";
import InvoiceCell from "@/components/ui/InvoiceCell";

function getOrderDate(order) {
  return order?.created_at || order?.order_date || null;
}

// Coordinator ruling (03-05): READY_TO_SHIP -> CANCELLED includes RETAILER
// (03-CONTEXT.md D2, amended after planning; mirrors _ALLOWED_TRANSITIONS in
// ascend-backend/app/services/order.py). A retailer may cancel until goods
// leave the warehouse; once OUT_FOR_DELIVERY the correct event is a
// driver-recorded doorstep refusal.
const CANCELLABLE = new Set(["PENDING", "READY_TO_SHIP"]);

export default function RetailerOrders() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "ALL" });
  const [cancelling, setCancelling] = useState({});
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  async function loadOrders(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status !== "ALL") params.set("status", filters.status);
      const resp = await apiFetch(`${apiEndpoints.orders.list}?${params.toString()}`);
      setOrders(resp?.items || []);
      setTotal(resp?.total || 0);
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrders(); }, [filters]);

  async function handleCancel(orderId) {
    setCancelling((prev) => ({ ...prev, [orderId]: { saving: true, error: "" } }));
    try {
      await apiFetch(apiEndpoints.orders.updateStatus(orderId), {
        method: "PATCH",
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      setCancelling((prev) => ({ ...prev, [orderId]: { saving: false, error: "" } }));
      await loadOrders(false);
    } catch (err) {
      setCancelling((prev) => ({ ...prev, [orderId]: { saving: false, error: err?.payload?.detail || "Failed to cancel." } }));
    }
  }

  const columns = useMemo(() => [
    {
      header: "Order",
      accessorKey: "id",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-slate-900">#{row.original.id}</p>
          <InvoiceCell
            invoiceNumber={row.original.invoice_number}
            status={row.original.status}
            className="text-xs"
          />
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => toTitleCase(row.original.status),
    },
    {
      header: "Total",
      accessorKey: "total_amount",
      meta: { type: "number" },
      cell: ({ row }) => formatCurrency(row.original.total_amount),
    },
    {
      header: "Pending",
      accessorKey: "pending_amount",
      meta: { type: "number" },
      cell: ({ row }) => formatCurrency(row.original.pending_amount),
    },
    {
      header: "Date",
      accessorKey: "created_at",
      cell: ({ row }) => formatDate(getOrderDate(row.original)),
    },
    {
      header: "",
      accessorKey: "cancel_action",
      cell: ({ row }) => {
        const order = row.original;
        if (!CANCELLABLE.has(order.status)) return null;
        const state = cancelling[order.id] || {};
        return (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              disabled={state.saving}
              onClick={() => handleCancel(order.id)}
              className="cursor-pointer rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
            >
              {state.saving ? "Cancelling…" : "Cancel"}
            </button>
            {state.error && <span className="text-xs text-rose-500">{state.error}</span>}
          </div>
        );
      },
    },
  ], [cancelling]);

  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">Loading orders…</div>;
  if (error) return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">{error}</div>;

  return (
    <div className="space-y-6">
      <SectionCard title="My Orders" subtitle="Orders placed for your account">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value })}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="READY_TO_SHIP">Ready to ship</option>
          <option value="OUT_FOR_DELIVERY">Out for delivery</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </SectionCard>

      <SectionCard title="Orders" subtitle={`${total} orders`}>
        <DataTable
          columns={columns}
          data={orders}
          emptyLabel="No orders found."
          tableClassName="min-w-[700px]"
          onRowClick={(order) => setSelectedOrderId(order.id)}
        />
      </SectionCard>
      {selectedOrderId ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 p-0 sm:p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={() => setSelectedOrderId(null)} />
          <aside className="relative h-dvh w-full overflow-y-auto border-l border-slate-200 bg-slate-50 p-4 shadow-xl sm:max-w-5xl sm:rounded-lg sm:border">
            <OrderDetailPanel orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} onOrderUpdate={() => loadOrders(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
