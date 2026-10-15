"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/format";
import FieldFeedback from "@/components/field/FieldFeedback";
import FieldOrderCard from "@/components/field/FieldOrderCard";
import FieldStatusFilters from "@/components/field/FieldStatusFilters";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import OrderDetailPanel from "@/components/orders/OrderDetailPanel";
import InvoiceCell from "@/components/ui/InvoiceCell";

function getOrderDate(order) {
  return order?.created_at || order?.order_date || null;
}

export default function SalesmanOrders() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "ALL" });
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
      cell: ({ row }) => row.original.retailer_name || "—",
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
      header: "",
      accessorKey: "detail_action",
      // The whole card is tappable on mobile, so this duplicate control is hidden there.
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setSelectedOrderId(row.original.id)}
          className="inline-flex min-h-[44px] cursor-pointer items-center rounded-full border border-slate-200 px-4 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
        >
          View
        </button>
      ),
    },
  ], []);

  if (loading) return <FieldFeedback loading label="Loading orders…" />;
  if (error) return <FieldFeedback error={error} onRetry={() => loadOrders()} />;

  return (
    <div className="space-y-6">
      <SectionCard
        title="My Orders"
        subtitle="Track orders and record collected cash from order details."
        actions={
          <Link href="/app/orders/new" className="inline-flex min-h-[44px] items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white">
            New Order
          </Link>
        }
      >
        <FieldStatusFilters value={filters.status} onChange={(status) => { setFilters({ status }); setPage(1); }} />
        <select
          aria-label="Filter orders by status"
          value={filters.status}
          onChange={(e) => { setFilters({ status: e.target.value }); setPage(1); }}
          className="hidden lg:block min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-base sm:w-auto sm:text-sm"
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
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
          // Makes the whole mobile card tappable, which is what lets the duplicate "View"
          // button be hidden there. Matches DriverOrders, which already did this.
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

      {selectedOrderId && (
        <SectionCard title="Order Detail">
          <OrderDetailPanel orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
        </SectionCard>
      )}
    </div>
  );
}
