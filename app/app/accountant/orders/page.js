"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch, apiFetchCached } from "@/lib/api";
import { formatDate, toTitleCase } from "@/lib/format";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import { InputBar, SelectBar } from "@/components/ui/InputBars";

function getOrderDate(order) {
  return order?.created_at || order?.order_date || order?.date || null;
}

export default function AccountantOrders() {
  const [orders, setOrders] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState({
    search: "",
    status: "PENDING"
  });

  async function loadOrders(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));
      if (filters.search) params.set("search", filters.search);
      if (filters.status !== "ALL") params.set("status", filters.status);

      const [ordersResponse, lookupsResponse] = await Promise.all([
        apiFetch(`${apiEndpoints.admin.orders}?${params.toString()}`),
        apiFetchCached(apiEndpoints.admin.lookups)
      ]);
      setOrders(ordersResponse?.items || []);
      setTotal(ordersResponse?.total || 0);
      setRetailers(lookupsResponse?.retailers || []);
      setWarehouses(lookupsResponse?.warehouses || []);
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
        cell: ({ row }) => <span className="font-semibold text-slate-900">#{row.original.id}</span>
      },
      {
        header: "Retailer",
        accessorKey: "to_entity_id",
        cell: ({ row }) => {
          const retailerId = row.original.to_entity_id;
          return retailerMap.get(retailerId) || retailerId || "—";
        }
      },
      {
        header: "Warehouse",
        accessorKey: "from_entity_id",
        cell: ({ row }) => warehouseMap.get(row.original.from_entity_id) || row.original.from_entity_id || "—"
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => toTitleCase(row.original.status)
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
        title="Order Entry"
        subtitle="Orders punched by accounting."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/app/accountant/orders/new"
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
        <div className="grid gap-4 md:grid-cols-2">
          <InputBar
            type="text"
            placeholder="Search invoice"
            value={filters.search}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, search: event.target.value }));
              setPage(1);
            }}
          />
          <SelectBar
            value={filters.status}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, status: event.target.value }));
              setPage(1);
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="OUT_FOR_DELIVERY">Out for delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="RETURNED">Returned</option>
            <option value="CANCELLED">Cancelled</option>
          </SelectBar>
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
        <DataTable columns={columns} data={orders} emptyLabel="No orders match the selected filters." />
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
