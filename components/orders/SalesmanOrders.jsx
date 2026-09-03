"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/format";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "ALL" });
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

  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">Loading orders…</div>;
  if (error) return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">{error}</div>;

  return (
    <div className="space-y-6">
      <SectionCard
        title="My Orders"
        subtitle="Orders for your retailers"
        actions={
          <Link href="/app/orders/new" className="inline-flex min-h-[44px] items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white">
            New Order
          </Link>
        }
      >
        <select
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value })}
          className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-base sm:w-auto sm:text-sm"
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
          // Makes the whole mobile card tappable, which is what lets the duplicate "View"
          // button be hidden there. Matches DriverOrders, which already did this.
          onRowClick={(order) => setSelectedOrderId(order.id)}
        />
      </SectionCard>

      {selectedOrderId && (
        <SectionCard title="Order Detail">
          <OrderDetailPanel orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
        </SectionCard>
      )}
    </div>
  );
}
