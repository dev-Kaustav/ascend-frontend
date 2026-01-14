"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatDate, toTitleCase } from "@/lib/format";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";

function getOrderDate(order) {
  return order?.created_at || order?.order_date || order?.date || null;
}

function getWarehouseId(order) {
  if (order?.warehouse_id) return order.warehouse_id;
  const type = String(order?.order_type || "").toUpperCase();
  if (type === "INCOMING") return order?.to_entity_id;
  if (type === "OUTGOING") return order?.from_entity_id;
  return null;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    orderType: "ALL",
    status: "ALL",
    paymentStatus: "ALL",
    fromDate: "",
    toDate: ""
  });

  async function loadOrders(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const [ordersResponse, retailersResponse, warehousesResponse] = await Promise.all([
        apiFetch(apiEndpoints.admin.orders),
        apiFetch(apiEndpoints.admin.retailers),
        apiFetch(apiEndpoints.admin.warehouses)
      ]);
      setOrders(ordersResponse || []);
      setRetailers(retailersResponse || []);
      setWarehouses(warehousesResponse || []);
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

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

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const invoice = order.invoice_number || "";
      if (filters.search && !invoice.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.orderType !== "ALL" && String(order.order_type).toUpperCase() !== filters.orderType) {
        return false;
      }
      if (filters.status !== "ALL" && String(order.status).toUpperCase() !== filters.status) {
        return false;
      }
      if (
        filters.paymentStatus !== "ALL" &&
        String(order.payment_status || "UNPAID").toUpperCase() !== filters.paymentStatus
      ) {
        return false;
      }
      const orderDate = getOrderDate(order);
      if (filters.fromDate && orderDate && new Date(orderDate) < new Date(filters.fromDate)) {
        return false;
      }
      if (filters.toDate && orderDate && new Date(orderDate) > new Date(filters.toDate)) {
        return false;
      }
      return true;
    });
  }, [orders, filters]);

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
        header: "Type",
        accessorKey: "order_type",
        cell: ({ row }) => toTitleCase(row.original.order_type)
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
        subtitle="Track incoming and outgoing orders across the network."
        actions={
          <button
            type="button"
            onClick={() => loadOrders(false)}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
          >
            Refresh
          </button>
        }
      >
        <div className="grid gap-4 md:grid-cols-5">
          <input
            type="text"
            placeholder="Search invoice"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
          <select
            value={filters.orderType}
            onChange={(event) => setFilters((prev) => ({ ...prev, orderType: event.target.value }))}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
          >
            <option value="ALL">Order Type</option>
            <option value="INCOMING">Incoming</option>
            <option value="OUTGOING">Outgoing</option>
          </select>
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
          >
            <option value="ALL">Status</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={filters.paymentStatus}
            onChange={(event) => setFilters((prev) => ({ ...prev, paymentStatus: event.target.value }))}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
          >
            <option value="ALL">Payment</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="UNPAID">Unpaid</option>
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={filters.fromDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, fromDate: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs"
            />
            <input
              type="date"
              value={filters.toDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, toDate: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Orders" subtitle={`${filteredOrders.length} orders shown`}>
        <DataTable columns={columns} data={filteredOrders} emptyLabel="No orders match the selected filters." />
      </SectionCard>
    </div>
  );
}
