"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch, apiFetchBlob, apiFetchCached } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber, toTitleCase } from "@/lib/format";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";

function getOrderDate(order) {
  return order?.created_at || order?.order_date || order?.date || null;
}

function getOrderTotal(order) {
  if (!order) return 0;
  if (typeof order.total_amount === "number") return order.total_amount;
  if (order.total_amount !== undefined && order.total_amount !== null) {
    const parsed = Number(order.total_amount);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (!order?.items?.length) return 0;
  const total = order.items.reduce((sum, item) => {
    const base = (item.quantity || 0) * (item.unit_price || 0) - (item.discount_amount || 0);
    return sum + base;
  }, 0);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export default function AdminInvoices() {
  const [orders, setOrders] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    status: "ALL",
    paymentStatus: "ALL"
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const params = new URLSearchParams();
        params.set("limit", String(pageSize));
        params.set("offset", String((page - 1) * pageSize));
        if (filters.search) params.set("search", filters.search);
        if (filters.status !== "ALL") params.set("status", filters.status);
        if (filters.paymentStatus !== "ALL") params.set("payment_status", filters.paymentStatus);

        const lookupsPromise = lookupsLoaded ? Promise.resolve(null) : apiFetchCached(apiEndpoints.admin.lookups);
        const [ordersResponse, lookupsResponse] = await Promise.all([
          apiFetch(`${apiEndpoints.admin.orders}?${params.toString()}`),
          lookupsPromise
        ]);
        if (!active) return;
        setOrders(ordersResponse?.items || []);
        setTotal(ordersResponse?.total || 0);
        if (lookupsResponse) {
          setRetailers(lookupsResponse?.retailers || []);
          setLookupsLoaded(true);
        }
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load invoices.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [filters, page, pageSize]);

  const retailerMap = useMemo(() => {
    const map = new Map();
    retailers.forEach((retailer) => {
      map.set(retailer.id, retailer.name);
    });
    return map;
  }, [retailers]);

  const totals = useMemo(() => {
    const totalInvoices = total;
    const totalBilled = orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    const paidInvoices = orders.filter(
      (order) => String(order.payment_status || "CREDIT").toUpperCase() === "PAID"
    ).length;
    return { totalInvoices, totalBilled, paidInvoices };
  }, [orders, total]);

  const columns = useMemo(
    () => [
      {
        header: "Invoice #",
        accessorKey: "invoice_number",
        cell: ({ row }) => (
          <Link className="font-semibold text-slate-900 hover:underline" href={`/app/orders/${row.original.id}`}>
            {row.original.invoice_number || `Order #${row.original.id}`}
          </Link>
        )
      },
      {
        header: "Retailer",
        accessorKey: "to_entity_id",
        cell: ({ row }) => {
          const retailerId = row.original.to_entity_id;
          return retailerMap.get(retailerId) || row.original.to_entity_name || retailerId || "—";
        }
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => toTitleCase(row.original.status)
      },
      {
        header: "Payment",
        accessorKey: "payment_status",
        cell: ({ row }) => toTitleCase(row.original.payment_status || "CREDIT")
      },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => formatCurrency(getOrderTotal(row.original))
      },
      {
        header: "Date",
        accessorKey: "created_at",
        cell: ({ row }) => formatDate(getOrderDate(row.original))
      },
      {
        header: "PDF",
        accessorKey: "pdf",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={async () => {
              const { blob, filename } = await apiFetchBlob(apiEndpoints.orders.invoicePdf(row.original.id));
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = filename || `invoice-${row.original.id}.pdf`;
              document.body.appendChild(link);
              link.click();
              link.remove();
              window.URL.revokeObjectURL(url);
            }}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
          >
            Download
          </button>
        )
      }
    ],
    [retailerMap]
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading invoices…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard
          title="Invoices"
          value={formatNumber(totals.totalInvoices)}
          subtitle="Issued invoices"
          accent="sky"
        />
        <StatCard
          title="Total Billed"
          value={formatCurrency(totals.totalBilled)}
          subtitle="Invoice value"
          accent="emerald"
        />
        <StatCard
          title="Paid Invoices"
          value={formatNumber(totals.paidInvoices)}
          subtitle="Fully paid"
          accent="amber"
        />
      </div>

      <SectionCard title="Invoice Filters" subtitle="Search invoice numbers or filter status">
        <div className="grid gap-4 md:grid-cols-3">
          <input
            type="text"
            value={filters.search}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, search: event.target.value }));
              setPage(1);
            }}
            placeholder="Search invoice"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
          />
          <select
            value={filters.status}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, status: event.target.value }));
              setPage(1);
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
          >
            <option value="ALL">Status</option>
            <option value="BOOKED">Booked</option>
            <option value="READY_TO_SHIP">Ready to ship</option>
            <option value="OUT_FOR_DELIVERY">Out for delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="RETURNED">Returned</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={filters.paymentStatus}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, paymentStatus: event.target.value }));
              setPage(1);
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
          >
            <option value="ALL">Payment</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="CREDIT">Credit</option>
          </select>
        </div>
      </SectionCard>

      <SectionCard
        title="Invoices"
        subtitle={`${formatNumber(total)} invoices`}
        actions={
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        }
      >
        <DataTable columns={columns} data={orders} emptyLabel="No invoices to display." />
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>
            Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={page >= Math.ceil(total / pageSize)}
              className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
