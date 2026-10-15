"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/format";
import FieldFeedback from "@/components/field/FieldFeedback";
import FieldOrderCard from "@/components/field/FieldOrderCard";
import FieldStatusFilters from "@/components/field/FieldStatusFilters";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import OrderDetailPanel from "@/components/orders/OrderDetailPanel";
import InvoiceCell from "@/components/ui/InvoiceCell";
import { getCoords } from "@/lib/geo";

function getOrderDate(order) {
  return order?.created_at || order?.order_date || null;
}

const CANCELLABLE = new Set(["PENDING", "READY_TO_SHIP", "OUT_FOR_DELIVERY"]);

export default function DriverOrders() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "READY_TO_SHIP" });
  const [updates, setUpdates] = useState({});
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  async function loadOrders(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(pageSize), offset: String((page - 1) * pageSize) });
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

  useEffect(() => { loadOrders(); }, [filters, page]);

  function updateRow(orderId, patch) {
    setUpdates((prev) => ({ ...prev, [orderId]: { ...prev[orderId], ...patch } }));
  }

  async function handleStatusUpdate(orderId, status, extra = {}) {
    updateRow(orderId, { saving: true, error: "" });
    try {
      // Where the driver stood when they closed this out. Attached here rather than at the
      // button so every caller of this function gets it, and best-effort on purpose: a denied
      // permission or a dead fix must not stop a driver clearing the day's orders. The server
      // treats missing coordinates as missing, not as an error.
      const coords = status === "DELIVERED" ? await getCoords().catch(() => null) : null;
      await apiFetch(apiEndpoints.orders.updateStatus(orderId), {
        method: "PATCH",
        body: JSON.stringify({ status, ...extra, ...(coords || {}) }),
      });
      updateRow(orderId, { saving: false, error: "", paymentStatus: "", paymentMode: "", paymentAmount: "" });
      await loadOrders(false);
    } catch (err) {
      updateRow(orderId, { saving: false, error: err?.payload?.detail || "Update failed." });
    }
  }

  const columns = useMemo(() => [
    {
      header: "Order",
      accessorKey: "id",
      meta: { mobilePrimary: true },
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
      header: "Retailer",
      accessorKey: "retailer_name",
      cell: ({ row }) => row.original.retailer_name || row.original.to_entity_id || "—",
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
      header: "Date",
      accessorKey: "created_at",
      cell: ({ row }) => formatDate(getOrderDate(row.original)),
    },
    {
      header: "Action",
      accessorKey: "actions",
      // The driver's whole workflow lives in this cell; give it the full card width.
      meta: { mobileFullWidth: true },
      cell: ({ row }) => {
        const order = row.original;
        const rowUpdate = updates[order.id] || {};
        if (order.status === "READY_TO_SHIP") {
          return (
            <div className="flex flex-col gap-1.5 text-xs">
              <button
                type="button"
                disabled={rowUpdate.saving}
                onClick={() => handleStatusUpdate(order.id, "OUT_FOR_DELIVERY")}
                className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white disabled:opacity-60"
              >
                {rowUpdate.saving ? "Saving…" : "Mark In Transit"}
              </button>
              {rowUpdate.error && <span className="text-rose-500">{rowUpdate.error}</span>}
            </div>
          );
        }
        if (order.status === "OUT_FOR_DELIVERY") {
          return (
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  aria-label={`Payment status for order ${order.id}`}
                  value={rowUpdate.paymentStatus || ""}
                  onChange={(e) => updateRow(order.id, { paymentStatus: e.target.value })}
                  className="col-span-2 min-h-[48px] rounded-full border border-slate-200 bg-white px-3 py-1 text-base sm:text-sm"
                >
                  <option value="">Payment (optional)</option>
                  <option value="PAID">Paid</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="CREDIT">Credit</option>
                </select>
                {rowUpdate.paymentStatus && rowUpdate.paymentStatus !== "CREDIT" && (
                  <>
                    <select
                      aria-label={`Payment mode for order ${order.id}`}
                      value={rowUpdate.paymentMode || ""}
                      onChange={(e) => updateRow(order.id, { paymentMode: e.target.value })}
                      className="min-h-[48px] rounded-full border border-slate-200 bg-white px-3 py-1 text-base sm:text-sm"
                    >
                      <option value="">Mode</option>
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={rowUpdate.paymentAmount || ""}
                      onChange={(e) => updateRow(order.id, { paymentAmount: e.target.value })}
                      placeholder="Amount"
                      aria-label={`Payment amount for order ${order.id}`}
                      className="min-h-[48px] rounded-full border border-slate-200 bg-white px-3 py-1 text-base sm:text-sm"
                    />
                  </>
                )}
              </div>
              <button
                type="button"
                disabled={rowUpdate.saving}
                onClick={() => handleStatusUpdate(order.id, "DELIVERED", {
                  payment_status: rowUpdate.paymentStatus || undefined,
                  payment_mode: rowUpdate.paymentMode || undefined,
                  payment_amount: rowUpdate.paymentAmount ? Number(rowUpdate.paymentAmount) : undefined,
                })}
                className="inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-full bg-emerald-700 px-4 text-xs font-semibold uppercase tracking-widest text-white transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {/* This press now waits on a GPS fix before it sends, which can take a few
                    seconds on a market street. "Saving…" would read as a hung button. */}
                {rowUpdate.saving ? "Getting location…" : "Mark Delivered"}
              </button>
              <button
                type="button"
                disabled={rowUpdate.saving}
                onClick={() => handleStatusUpdate(order.id, "CANCELLED")}
                className="inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-full border border-rose-300 bg-white px-4 text-xs font-semibold uppercase tracking-widest text-rose-600 transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {rowUpdate.saving ? "Saving…" : "Refused"}
              </button>
              {rowUpdate.error && <span className="text-rose-500">{rowUpdate.error}</span>}
            </div>
          );
        }
        return <span className="text-xs text-slate-400">{toTitleCase(order.status)}</span>;
      },
    },
  ], [updates]);

  if (loading) return <FieldFeedback loading label="Loading orders…" />;
  if (error) return <FieldFeedback error={error} onRetry={() => loadOrders()} />;

  return (
    <div className="space-y-6">
      <SectionCard
        title="My Deliveries"
        subtitle="Orders assigned to you"
        actions={
          <button type="button" onClick={() => loadOrders(false)} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Refresh
          </button>
        }
      >
        <FieldStatusFilters value={filters.status} onChange={(status) => { setFilters({ status }); setPage(1); }} driver />
        <select
          aria-label="Filter orders by status"
          value={filters.status}
          onChange={(e) => { setFilters({ status: e.target.value }); setPage(1); }}
          className="hidden lg:block rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
        >
          <option value="ALL">All Statuses</option>
          <option value="READY_TO_SHIP">Ready to ship</option>
          <option value="OUT_FOR_DELIVERY">Out for delivery</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </SectionCard>

      <SectionCard className="field-list-section" title="Orders" subtitle={`${total} ${total === 1 ? "order" : "orders"}`}>
        <DataTable
          renderMobileRow={(order, renderCell) => <FieldOrderCard order={order}>{renderCell("actions")}</FieldOrderCard>}
          columns={columns}
          data={orders}
          emptyLabel="No orders found."
          tableClassName="min-w-[700px]"
          onRowClick={(order) => setSelectedOrderId(order.id)}
        />
        {total > pageSize ? <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-500">
          <span>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="min-h-11 rounded-xl border border-slate-200 px-4 disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage((value) => value + 1)} className="min-h-11 rounded-xl border border-slate-200 px-4 disabled:opacity-40">Next</button>
          </div>
        </div> : null}
      </SectionCard>
      {selectedOrderId ? (
        <div className="field-detail-overlay fixed inset-0 z-50 flex justify-end bg-slate-950/30 p-0 sm:p-4">
          <button
            type="button"
            aria-label="Close order detail"
            className="absolute inset-0 cursor-default"
            onClick={() => setSelectedOrderId(null)}
          />
          <aside className="relative h-dvh w-full overflow-y-auto border-l border-slate-200 bg-slate-50 p-4 shadow-xl sm:max-w-5xl sm:rounded-lg sm:border">
            <OrderDetailPanel
              orderId={selectedOrderId}
              onClose={() => setSelectedOrderId(null)}
              onOrderUpdate={() => loadOrders(false)}
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
