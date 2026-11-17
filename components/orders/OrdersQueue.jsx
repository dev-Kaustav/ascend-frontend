"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiEndpoints, apiFetch, apiFetchBlob } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { ORDER_QUEUES, PAYMENT_LABEL, PAYMENT_TONE, STATUS_LABEL, STATUS_TONE } from "@/lib/orderStatus";
import useIsDesktop from "@/lib/hooks/useIsDesktop";
import DataTable from "@/components/tables/DataTable";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import { useToast } from "@/components/ui/ToastProvider";
import OrderDesk from "@/components/orders/OrderDesk";
import OrderDetailPanel from "@/components/orders/OrderDetailPanel";

// The orders screen for the office roles. It answers "which orders need me now, and what do I do
// with each?": the queues across the top are the work in the order it happens, each one a filter
// with its count, and every row carries its next step in the last column.

const PAGE_SIZE = 25;
const ROLE_SETUP = {
  ADMIN: { canCreate: true, canExport: true, canAccept: true, defaultQueue: "to-accept" },
  ACCOUNTANT: { canCreate: true, canExport: true, canAccept: false, defaultQueue: "payment-due" },
  WAREHOUSE_MANAGER: { canCreate: false, canExport: false, canAccept: true, defaultQueue: "to-accept" },
};

function Pill({ tone, children }) {
  return <span className={`inline-flex h-6 flex-none items-center whitespace-nowrap rounded px-2 text-xs font-medium ${tone}`}>{children}</span>;
}

const ROW_BUTTON =
  "inline-flex h-8 items-center rounded-md border border-control bg-white px-3 text-sm font-medium text-ink hover:bg-raised disabled:opacity-60";

export default function OrdersQueue({ role }) {
  const setup = ROLE_SETUP[role] || ROLE_SETUP.ACCOUNTANT;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();
  const { notify } = useToast();

  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [extra, setExtra] = useState({ channel: "ALL", paymentStatus: "ALL", status: "ALL", fromDate: "", toDate: "" });
  const [exporting, setExporting] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const requestId = useRef(0);

  // The queue lives in the URL (?queue=), so a refresh or a shared link opens the same list.
  const requestedQueue = searchParams.get("queue");
  const queue = useMemo(() => {
    const byKey = ORDER_QUEUES.find((q) => q.key === requestedQueue);
    if (byKey) return byKey;
    if (!summary) return null;
    const preferred = ORDER_QUEUES.find((q) => q.key === setup.defaultQueue);
    if (preferred && preferred.count(summary) > 0) return preferred;
    return ORDER_QUEUES.find((q) => q.key !== "all" && q.count(summary) > 0) || ORDER_QUEUES.at(-1);
  }, [requestedQueue, summary, setup.defaultQueue]);

  function chooseQueue(key) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("queue", key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setPage(1);
  }

  // Search waits for a pause in typing; the field itself never unmounts while results load.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  function listParams() {
    const params = new URLSearchParams();
    const filter = queue?.filter || {};
    const status = queue?.key === "all" && extra.status !== "ALL" ? extra.status : filter.status;
    const paymentStatus = filter.payment_status || (extra.paymentStatus !== "ALL" ? extra.paymentStatus : null);
    if (status) params.set("status", status);
    if (paymentStatus) params.set("payment_status", paymentStatus);
    if (search) params.set("search", search);
    if (extra.channel !== "ALL") params.set("channel", extra.channel);
    if (extra.fromDate) params.set("from_date", extra.fromDate);
    if (extra.toDate) params.set("to_date", extra.toDate);
    return params;
  }

  async function loadSummary() {
    try {
      setSummary((await apiFetch(apiEndpoints.admin.orderStatusSummary)) || {});
    } catch (err) {
      setSummary({});
      setError(err?.message || "Couldn't load the order counts.");
    }
  }

  async function loadOrders() {
    if (!queue) return;
    const id = ++requestId.current;
    setLoading(true);
    try {
      const params = listParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String((page - 1) * PAGE_SIZE));
      const response = await apiFetch(`${apiEndpoints.admin.orders}?${params.toString()}`);
      if (id !== requestId.current) return; // a newer request has replaced this one
      setOrders(response?.items || []);
      setTotal(response?.total || 0);
      setError("");
    } catch (err) {
      if (id === requestId.current) setError(err?.message || "Couldn't load orders.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [queue?.key, page, search, extra]);

  function refresh() {
    loadSummary();
    loadOrders();
  }

  async function acceptOrder(order) {
    setBusyOrderId(order.id);
    try {
      await apiFetch(apiEndpoints.orders.updateStatus(order.id), {
        method: "PATCH",
        body: JSON.stringify({ status: "READY_TO_SHIP" }),
      });
      notify(`Order #${order.id} accepted. Assign a rider next.`);
      refresh();
    } catch (err) {
      // A stock shortage refuses the accept with the SKU and what is available; say it as is.
      notify(err?.payload?.detail || err?.message || "Couldn't accept the order.", { tone: "error" });
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const query = listParams().toString();
      const { blob, filename } = await apiFetchBlob(query ? `${apiEndpoints.admin.ordersExport}?${query}` : apiEndpoints.admin.ordersExport);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "orders.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      notify(err?.message || "Couldn't export orders.", { tone: "error" });
    } finally {
      setExporting(false);
    }
  }

  function nextStep(order) {
    const pending = Number(order.pending_amount) || 0;
    if (order.status === "PENDING" && setup.canAccept) {
      return (
        <button type="button" className={ROW_BUTTON} disabled={busyOrderId === order.id} onClick={() => acceptOrder(order)}>
          {busyOrderId === order.id ? "Accepting…" : "Accept"}
        </button>
      );
    }
    if (order.status === "READY_TO_SHIP" && setup.canAccept) {
      return (
        <button type="button" className={ROW_BUTTON} onClick={() => setSelectedOrderId(order.id)}>
          Assign rider
        </button>
      );
    }
    if (order.status === "DRIVER_ASSIGNED") return <span className="text-sm text-muted">Waiting on rider</span>;
    if (order.status === "OUT_FOR_DELIVERY") return <span className="text-sm text-muted">On the road</span>;
    if (order.status === "DELIVERED" && pending > 0) {
      return <span className="text-sm font-medium tabular-nums text-data">{formatCurrency(pending)} due</span>;
    }
    return <span className="text-sm text-muted">—</span>;
  }

  const columns = useMemo(
    () => [
      {
        header: "Order",
        accessorKey: "id",
        meta: { mobilePrimary: true },
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-ink">#{row.original.id}</p>
            <p className="text-xs text-muted">{formatDate(row.original.created_at)}</p>
          </div>
        ),
      },
      {
        header: "Shop",
        accessorKey: "retailer_name",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[22rem]">
            <p className="truncate text-ink">{row.original.retailer_name || "—"}</p>
            <p className="truncate text-xs text-muted">
              {[row.original.salesman_name, row.original.channel === "ONLINE" ? "Online store" : null].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        ),
      },
      {
        header: "Amount",
        accessorKey: "total_amount",
        meta: { type: "number" },
        cell: ({ row }) => <span className="tabular-nums text-ink">{formatCurrency(row.original.total_amount)}</span>,
      },
      {
        header: "Payment",
        accessorKey: "payment_status",
        cell: ({ row }) => {
          const status = row.original.payment_status || "CREDIT";
          return <Pill tone={PAYMENT_TONE[status] || PAYMENT_TONE.CREDIT}>{PAYMENT_LABEL[status] || status}</Pill>;
        },
      },
      // Inside a queue every row shares one status, so the column only appears under "All orders".
      ...(queue?.key === "all"
        ? [{
            header: "Status",
            accessorKey: "status",
            cell: ({ row }) => <Pill tone={STATUS_TONE[row.original.status] || STATUS_TONE.PENDING}>{STATUS_LABEL[row.original.status] || row.original.status}</Pill>,
          }]
        : []),
      {
        header: "Next step",
        id: "next",
        meta: { align: "right", mobileFullWidth: true },
        cell: ({ row }) => <div className="flex justify-end">{nextStep(row.original)}</div>,
      },
    ],
    [busyOrderId, setup.canAccept, queue?.key]
  );

  const counts = summary || {};
  const needsAction = (counts.PENDING || 0) + (counts.READY_TO_SHIP || 0);
  const firstRow = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = Math.min(page * PAGE_SIZE, total);
  const filtersActive = extra.channel !== "ALL" || extra.paymentStatus !== "ALL" || extra.status !== "ALL" || extra.fromDate || extra.toDate;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Orders</h1>
          <p className="mt-1 text-sm text-muted">
            {summary === null
              ? "Counting orders…"
              : needsAction
                ? `${needsAction} ${needsAction === 1 ? "order needs" : "orders need"} you: ${counts.PENDING || 0} to accept, ${counts.READY_TO_SHIP || 0} without a rider.`
                : "Nothing waiting on the office right now."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={refresh} className="h-9 rounded-md px-3 text-sm font-medium text-muted hover:bg-raised hover:text-ink">
            Refresh
          </button>
          {setup.canExport ? (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="h-9 rounded-md border border-control bg-white px-3 text-sm font-medium text-ink hover:bg-raised disabled:opacity-60"
            >
              {exporting ? "Exporting…" : "Export to Excel"}
            </button>
          ) : null}
          {setup.canCreate ? (
            <Link href="/app/orders/new" className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong">
              New order
            </Link>
          ) : null}
        </div>
      </header>

      {/* The queues: the work in the order it happens. Each is a filter showing its own count. */}
      <div role="tablist" aria-label="Order queues" className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-6 lg:gap-3 lg:overflow-visible lg:pb-0">
        {ORDER_QUEUES.map((q) => {
          const selected = queue?.key === q.key;
          const count = summary ? q.count(summary) : null;
          return (
            <button
              key={q.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => chooseQueue(q.key)}
              className={`flex min-w-[9.5rem] flex-none flex-col items-start rounded-lg border bg-white px-3.5 py-3 text-left transition-colors lg:min-w-0 ${
                selected ? "border-data bg-data-soft ring-1 ring-data" : "border-line hover:border-control"
              }`}
            >
              <span className={`text-[13px] ${selected ? "text-ink" : "text-muted"}`}>{q.label}</span>
              <span className="mt-0.5 text-xl font-semibold tabular-nums text-ink">{count === null ? "–" : count}</span>
            </button>
          );
        })}
      </div>

      <section className="rounded-lg border border-line bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <InputBar
            type="search"
            aria-label="Search orders"
            placeholder="Search order #, shop or invoice"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            size="sm"
            className="max-w-xs"
          />
          <button
            type="button"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((open) => !open)}
            className="h-9 rounded-md border border-control bg-white px-3 text-sm font-medium text-ink hover:bg-raised"
          >
            {filtersActive ? "Filters (on)" : "Filters"}
          </button>
          <span className="ml-auto text-sm tabular-nums text-muted">
            {loading ? "Loading…" : total ? `${firstRow}–${lastRow} of ${total}` : "0 orders"}
          </span>
        </div>

        {showFilters ? (
          <div className="grid gap-3 border-b border-line bg-surface-soft px-4 py-3 sm:grid-cols-2 lg:grid-cols-5">
            {queue?.key === "all" ? (
              <SelectBar size="sm" aria-label="Status" value={extra.status} onChange={(e) => { setExtra((p) => ({ ...p, status: e.target.value })); setPage(1); }}>
                <option value="ALL">Any status</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </SelectBar>
            ) : null}
            {queue?.key !== "payment-due" ? (
              <SelectBar size="sm" aria-label="Payment" value={extra.paymentStatus} onChange={(e) => { setExtra((p) => ({ ...p, paymentStatus: e.target.value })); setPage(1); }}>
                <option value="ALL">Any payment</option>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Part paid</option>
                <option value="CREDIT">On credit</option>
              </SelectBar>
            ) : null}
            <SelectBar size="sm" aria-label="Channel" value={extra.channel} onChange={(e) => { setExtra((p) => ({ ...p, channel: e.target.value })); setPage(1); }}>
              <option value="ALL">Online and offline</option>
              <option value="OFFLINE">Offline only</option>
              <option value="ONLINE">Online store only</option>
            </SelectBar>
            <label className="flex items-center gap-2 text-sm text-muted">
              From
              <InputBar size="sm" type="date" value={extra.fromDate} onChange={(e) => { setExtra((p) => ({ ...p, fromDate: e.target.value })); setPage(1); }} />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              To
              <InputBar size="sm" type="date" value={extra.toDate} onChange={(e) => { setExtra((p) => ({ ...p, toDate: e.target.value })); setPage(1); }} />
            </label>
            {filtersActive ? (
              <button
                type="button"
                onClick={() => { setExtra({ channel: "ALL", paymentStatus: "ALL", status: "ALL", fromDate: "", toDate: "" }); setPage(1); }}
                className="justify-self-start text-sm font-medium text-ink hover:underline"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span className="text-[#c4242a]">{error}</span>
            <button type="button" onClick={refresh} className="font-medium text-ink hover:underline">Retry</button>
          </div>
        ) : null}

        <div className={`px-1 pb-1 transition-opacity lg:px-1 ${loading && orders.length ? "opacity-60" : ""}`}>
          {loading && !orders.length ? (
            <p className="px-3 py-10 text-center text-sm text-muted">Loading orders…</p>
          ) : (
            <DataTable
              columns={columns}
              data={orders}
              emptyLabel={search || filtersActive ? "No orders match this search." : `Nothing in “${queue?.label || "this queue"}” right now.`}
              onRowClick={(order) => setSelectedOrderId(order.id)}
            />
          )}
        </div>

        {total > PAGE_SIZE ? (
          <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-8 rounded-md border border-control bg-white px-3 text-sm disabled:opacity-40">
              Previous
            </button>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={lastRow >= total} className="h-8 rounded-md border border-control bg-white px-3 text-sm disabled:opacity-40">
              Next
            </button>
          </div>
        ) : null}
      </section>

      {selectedOrderId ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <button type="button" aria-label="Close order" className="absolute inset-0 cursor-default" onClick={() => setSelectedOrderId(null)} />
          {isDesktop ? (
            <aside className="relative h-dvh w-full max-w-[760px] overflow-y-auto border-l border-line bg-canvas px-7 py-6 shadow-[0_0_40px_rgba(0,0,0,0.12)]">
              <OrderDesk orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} onOrderUpdate={refresh} />
            </aside>
          ) : (
            <aside className="relative h-dvh w-full overflow-y-auto bg-slate-50 p-4">
              <OrderDetailPanel orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} onOrderUpdate={refresh} />
            </aside>
          )}
        </div>
      ) : null}
    </div>
  );
}
