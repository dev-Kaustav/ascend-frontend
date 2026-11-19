"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Search } from "lucide-react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/format";
import FieldFeedback from "@/components/field/FieldFeedback";
import FieldOrderCard from "@/components/field/FieldOrderCard";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import OrderDetailPanel from "@/components/orders/OrderDetailPanel";
import InvoiceCell from "@/components/ui/InvoiceCell";

const STATUS_OPTIONS = [
  ["ALL", "All orders"],
  ["PENDING", "Pending"],
  ["READY_TO_SHIP", "Ready to ship"],
  ["OUT_FOR_DELIVERY", "On the road"],
  ["DELIVERED", "Delivered"],
  ["CANCELLED", "Cancelled"]
];

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
  const [filters, setFilters] = useState({ status: "ALL", search: "" });
  // What is typed; copied into filters.search after a pause so each keystroke is not a request.
  const [searchText, setSearchText] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  async function loadOrders(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(pageSize), offset: String((page - 1) * pageSize) });
      if (filters.status !== "ALL") params.set("status", filters.status);
      if (filters.search) params.set("search", filters.search);
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

  useEffect(() => {
    const search = searchText.trim();
    if (search === filters.search) return undefined;
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search }));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, filters.search]);

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

  const firstLoad = loading && !orders.length && !filters.search && filters.status === "ALL";
  if (firstLoad) return <FieldFeedback loading label="Loading orders…" />;

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Shop, order # or invoice"
            aria-label="Search orders"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-base text-slate-800 placeholder:text-slate-400 focus:border-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/25 lg:text-sm"
          />
        </div>
        {/* A native select: on a phone it opens the system picker, so six statuses cost one control. */}
        <div className="relative shrink-0">
          <select
            aria-label="Filter orders by status"
            value={filters.status}
            onChange={(e) => { setFilters((prev) => ({ ...prev, status: e.target.value })); setPage(1); }}
            className={`h-11 cursor-pointer appearance-none rounded-xl border bg-white pl-3 pr-8 text-base font-semibold lg:text-sm ${
              filters.status === "ALL" ? "border-slate-200 text-slate-600" : "border-slate-900 text-slate-900"
            }`}
          >
            {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        <Link
          href="/app/orders/new"
          className="hidden h-11 shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white lg:inline-flex"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New order
        </Link>
      </div>

      {error ? <FieldFeedback error={error} onRetry={() => loadOrders()} /> : null}

      <SectionCard className="field-list-section" title="Orders" subtitle={loading ? "Loading…" : `${total} ${total === 1 ? "order" : "orders"}`}>
        <DataTable
          renderMobileRow={(order, renderCell) => <FieldOrderCard order={order}>{renderCell("actions")}</FieldOrderCard>}
          columns={columns}
          data={orders}
          emptyLabel={filters.search || filters.status !== "ALL" ? "No orders match." : "No orders yet."}
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

      {/* Phones: one floating button in the thumb zone, above the bottom nav. */}
      <Link
        href="/app/orders/new"
        className="fixed right-4 z-20 inline-flex h-14 items-center gap-2 rounded-full bg-slate-900 pl-5 pr-6 text-base font-semibold text-white shadow-lg shadow-slate-900/25 bottom-[calc(var(--field-nav-height)+env(safe-area-inset-bottom,0px)+16px)] lg:hidden"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
        New order
      </Link>

      {selectedOrderId && (
        <SectionCard title="Order Detail">
          <OrderDetailPanel orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
        </SectionCard>
      )}
    </div>
  );
}
