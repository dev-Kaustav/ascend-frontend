"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch, apiFetchBlob, apiFetchCached } from "@/lib/api";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/format";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import { useToast } from "@/components/ui/ToastProvider";
import OrderDetailPanel from "@/components/orders/OrderDetailPanel";

function getOrderDate(order) {
  return order?.created_at || order?.order_date || order?.date || null;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    status: "ALL",
    paymentStatus: "ALL",
    fromDate: "",
    toDate: ""
  });
  const { notify } = useToast();

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
        setSalesmen(lookupsResponse?.salesmen || []);
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

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.status !== "ALL") params.set("status", filters.status);
      if (filters.paymentStatus !== "ALL") params.set("payment_status", filters.paymentStatus);
      if (filters.fromDate) params.set("from_date", filters.fromDate);
      if (filters.toDate) params.set("to_date", filters.toDate);

      const query = params.toString();
      const endpoint = query ? `${apiEndpoints.admin.ordersExport}?${query}` : apiEndpoints.admin.ordersExport;
      const { blob, filename } = await apiFetchBlob(endpoint);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "orders.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      notify(err?.message || "Unable to export orders.", { tone: "error" });
    } finally {
      setExporting(false);
    }
  }

  const retailerMap = useMemo(() => {
    const map = new Map();
    retailers.forEach((retailer) => {
      map.set(retailer.id, retailer.name);
    });
    return map;
  }, [retailers]);

  const salesmanMap = useMemo(() => {
    const map = new Map();
    salesmen.forEach((salesman) => {
      map.set(salesman.id, salesman);
    });
    return map;
  }, [salesmen]);

  const columns = useMemo(
    () => [
      {
        header: "Date",
        accessorKey: "created_at",
        cell: ({ row }) => formatDate(getOrderDate(row.original))
      },
      {
        header: "Order ID",
        accessorKey: "id",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedOrderId(row.original.id);
            }}
            className="font-semibold text-slate-900 hover:underline"
          >
            #{row.original.id}
          </button>
        )
      },
      {
        header: "Invoice ID",
        accessorKey: "invoice_number",
        cell: ({ row }) => row.original.invoice_number || "—"
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => toTitleCase(row.original.status)
      },
      {
        header: "Payment Status",
        accessorKey: "payment_status",
        cell: ({ row }) => toTitleCase(row.original.payment_status || "CREDIT")
      },
      {
        header: "Total amount",
        accessorKey: "total_amount",
        cell: ({ row }) => formatCurrency(row.original.total_amount)
      },
      {
        header: "Pending amount",
        accessorKey: "pending_amount",
        cell: ({ row }) => formatCurrency(row.original.pending_amount)
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
        header: "Beat",
        accessorKey: "beat_name",
        cell: ({ row }) => row.original.beat_name || "—"
      },
      {
        header: "Salesman Phone",
        accessorKey: "salesman_phone",
        cell: ({ row }) => {
          const salesman = salesmanMap.get(row.original.salesman_id);
          return salesman?.phone_number || "—";
        }
      }
    ],
    [retailerMap, salesmanMap]
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
              href="/app/orders/new"
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
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500 disabled:opacity-60"
            >
              {exporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            <option value="ALL">Status</option>
            <option value="PENDING">Pending</option>
            <option value="READY_TO_SHIP">Ready to ship</option>
            <option value="OUT_FOR_DELIVERY">Out for delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="RETURNED">Returned</option>
            <option value="CANCELLED">Cancelled</option>
          </SelectBar>
          <SelectBar
            value={filters.paymentStatus}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, paymentStatus: event.target.value }));
              setPage(1);
            }}
          >
            <option value="ALL">Payment</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="CREDIT">Credit</option>
          </SelectBar>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <InputBar
              type="date"
              value={filters.fromDate}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, fromDate: event.target.value }));
                setPage(1);
              }}
              size="sm"
              className="text-xs"
            />
            <InputBar
              type="date"
              value={filters.toDate}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, toDate: event.target.value }));
                setPage(1);
              }}
              size="sm"
              className="text-xs"
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
          <DataTable
            columns={columns}
            data={orders}
            emptyLabel="No orders match the selected filters."
            onRowClick={(order) => setSelectedOrderId(order.id)}
          />
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
      {selectedOrderId ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 p-0 sm:p-4">
          <button
            type="button"
            aria-label="Close order detail"
            className="absolute inset-0 cursor-default"
            onClick={() => setSelectedOrderId(null)}
          />
          <aside className="relative h-dvh w-full overflow-y-auto border-l border-slate-200 bg-slate-50 p-4 shadow-xl sm:max-w-5xl sm:rounded-lg sm:border">
            <OrderDetailPanel orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} onOrderUpdate={() => loadOrders(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
