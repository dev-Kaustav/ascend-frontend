"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch, apiFetchCached } from "@/lib/api";
import { formatDate, toTitleCase } from "@/lib/format";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";

function getOrderDate(order) {
  return order?.created_at || order?.order_date || order?.date || null;
}

function getWarehouseId(order) {
  return order?.warehouse_id || order?.from_entity_id || null;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    status: "ALL",
    paymentStatus: "ALL",
    fromDate: "",
    toDate: ""
  });

  async function loadOrders(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));
      if (filters.search) params.set("search", filters.search);
      if (filters.status !== "ALL") params.set("status", filters.status);
      if (filters.paymentStatus !== "ALL") params.set("payment_status", filters.paymentStatus);
      if (filters.fromDate) params.set("from_date", filters.fromDate);
      if (filters.toDate) params.set("to_date", filters.toDate);

      const lookupsPromise = lookupsLoaded ? Promise.resolve(null) : apiFetchCached(apiEndpoints.admin.lookups);
      const [ordersResponse, lookupsResponse] = await Promise.all([
        apiFetch(`${apiEndpoints.admin.orders}?${params.toString()}`),
        lookupsPromise
      ]);
      setOrders(ordersResponse?.items || []);
      setTotal(ordersResponse?.total || 0);
      if (lookupsResponse) {
        setRetailers(lookupsResponse?.retailers || []);
        setWarehouses(lookupsResponse?.warehouses || []);
        setLookupsLoaded(true);
      }
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [page, pageSize, filters]);

  const retailerMap = useMemo(() => {
    const map = new Map();
    retailers.forEach((retailer) => {
      map.set(retailer.id, retailer.name);
    });
    return map;
  }, [retailers]);

  const warehouseMap = useMemo(() => {
    const map = new Map();
    warehouses.forEach((warehouse) => {
      map.set(warehouse.id, warehouse.name);
    });
    return map;
  }, [warehouses]);

  const columns = useMemo(
    () => [
      {
        header: "Order ID",
        accessorKey: "id",
        cell: ({ row }) => (
          <Link className="font-semibold text-slate-900 hover:underline" href={`/app/admin/orders/${row.original.id}`}>
            #{row.original.id}
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
        header: "Warehouse",
        accessorKey: "warehouse_id",
        cell: ({ row }) => {
          const warehouseId = getWarehouseId(row.original);
          return warehouseMap.get(warehouseId) || row.original.warehouse_name || warehouseId || "—";
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
        cell: ({ row }) => toTitleCase(row.original.payment_status || "UNPAID")
      },
      {
        header: "Order Date",
        accessorKey: "created_at",
        cell: ({ row }) => formatDate(getOrderDate(row.original))
      },
      {
        header: "Invoice #",
        accessorKey: "invoice_number",
        cell: ({ row }) => row.original.invoice_number || "—"
      }
    ],
    [retailerMap, warehouseMap]
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading orders…
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
      <SectionCard
        title="Orders Dashboard"
        subtitle="Track outgoing orders across the network."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/app/admin/orders/new"
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
            >
              New Order
            </Link>
            <button
              type="button"
              onClick={() => loadOrders(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
            >
              Refresh
            </button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <input
            type="text"
            placeholder="Search invoice"
            value={filters.search}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, search: event.target.value }));
              setPage(1);
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
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
            <option value="PENDING">Pending</option>
            <option value="OUT_FOR_DELIVERY">Out for delivery</option>
            <option value="CONFIRMED">Confirmed</option>
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
            <option value="UNPAID">Unpaid</option>
          </select>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="date"
              value={filters.fromDate}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, fromDate: event.target.value }));
                setPage(1);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs"
            />
            <input
              type="date"
              value={filters.toDate}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, toDate: event.target.value }));
                setPage(1);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Orders"
        subtitle={`${total} orders`}
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
        <div className="max-w-full overflow-x-auto pb-2">
          <DataTable columns={columns} data={orders} emptyLabel="No orders match the selected filters." />
        </div>
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
