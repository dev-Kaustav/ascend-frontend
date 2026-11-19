"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiEndpoints, apiFetch, apiFetchBlob } from "@/lib/api";
import { invalidateOrders, queryPath } from "@/lib/query";
import { ORDERS_QUEUE_PAGE_SIZE } from "@/lib/screenData";
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

const PAGE_SIZE = ORDERS_QUEUE_PAGE_SIZE;
const ROLE_SETUP = {
  ADMIN: { canCreate: true, canExport: true, canAccept: true },
  ACCOUNTANT: { canCreate: true, canExport: true, canAccept: false },
  WAREHOUSE_MANAGER: { canCreate: false, canExport: false, canAccept: true },
};

function Pill({ tone, children }) {
  return <span className={`inline-flex h-6 flex-none items-center whitespace-nowrap rounded px-2 text-xs font-medium ${tone}`}>{children}</span>;
}

const ROW_BUTTON =
  "inline-flex min-h-9 max-lg:min-h-[44px] cursor-pointer items-center rounded-md border px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60";

export default function OrdersQueue({ role }) {
  const setup = ROLE_SETUP[role] || ROLE_SETUP.ACCOUNTANT;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();
  const { notify } = useToast();

  const queryClient = useQueryClient();
  const lookupsQuery = useQuery({ queryKey: queryPath(apiEndpoints.admin.lookups), staleTime: 5 * 60_000 });
  const salesmen = useMemo(
    () => [...(lookupsQuery.data?.salesmen || [])].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [lookupsQuery.data]
  );
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  // ?status= opens the All list on one status, e.g. the cancelled orders Finance asks to review.
  const [extra, setExtra] = useState(() => ({ channel: "ALL", paymentStatus: "ALL", status: searchParams.get("status") || "ALL", fromDate: "", toDate: "" }));
  const [showFilters, setShowFilters] = useState(() => Boolean(searchParams.get("status")));
  const [exporting, setExporting] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  // The queue and the salesman live in the URL (?queue=, ?salesman=), so a refresh or a shared link
  // opens the same list: one salesman's orders, counts and value are their sales at a glance.
  const requestedQueue = searchParams.get("queue");
  const salesmanId = searchParams.get("salesman") || "";
  const salesmanName = salesmen.find((sm) => String(sm.id) === salesmanId)?.name;
  const queue = useMemo(() => {
    const byKey = ORDER_QUEUES.find((q) => q.key === requestedQueue);
    if (byKey) return byKey;
    return ORDER_QUEUES.find((q) => q.key === "all");
  }, [requestedQueue]);

  function setParam(key, value) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setPage(1);
  }
  const chooseQueue = (key) => setParam("queue", key);

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
    if (salesmanId) params.set("salesman_id", salesmanId);
    return params;
  }

  // Counts and the page of orders are cached by their exact path: going back to a queue shows it at
  // once and refreshes behind, and paging or filtering keeps the old rows (dimmed) until the new
  // ones land. A response for a superseded filter can no longer overwrite the current one.
  const summaryQuery = useQuery({
    queryKey: queryPath(`${apiEndpoints.admin.orderStatusSummary}${salesmanId ? `?salesman_id=${salesmanId}` : ""}`),
  });
  const pageParams = listParams();
  pageParams.set("limit", String(PAGE_SIZE));
  pageParams.set("offset", String((page - 1) * PAGE_SIZE));
  const ordersQuery = useQuery({
    queryKey: queryPath(`${apiEndpoints.admin.orders}?${pageParams.toString()}`),
    enabled: Boolean(queue),
    placeholderData: keepPreviousData,
  });
  const summary = summaryQuery.isSuccess ? summaryQuery.data || {} : summaryQuery.isError ? {} : null;
  const orders = ordersQuery.data?.items || [];
  const total = ordersQuery.data?.total || 0;
  const totalValue = ordersQuery.data?.total_value ?? null;
  const loading = ordersQuery.isPending || ordersQuery.isPlaceholderData;
  const error = ordersQuery.error
    ? ordersQuery.error.message || "Couldn't load orders."
    : summaryQuery.error
      ? summaryQuery.error.message || "Couldn't load the order counts."
      : "";

  function refresh() {
    invalidateOrders(queryClient);
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
        <button type="button" className={`${ROW_BUTTON} border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:outline-emerald-700`} disabled={busyOrderId === order.id} onClick={() => acceptOrder(order)}>
          {busyOrderId === order.id ? "Accepting…" : "Accept"}
        </button>
      );
    }
    if (order.status === "READY_TO_SHIP" && setup.canAccept) {
      return (
        <button type="button" className={`${ROW_BUTTON} border-sky-700 bg-sky-700 text-white hover:bg-sky-800 focus-visible:outline-sky-700`} onClick={() => setSelectedOrderId(order.id)}>
          Send out
        </button>
      );
    }
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
      ...(queue?.key === "payment-due" ? [{
        header: "Balance due",
        accessorKey: "pending_amount",
        meta: { type: "number" },
        cell: ({ row }) => <span className="font-medium tabular-nums text-data">{formatCurrency(row.original.pending_amount)}</span>,
      }] : []),
      // All orders and Payment due can contain several fulfilment states.
      ...(["all", "payment-due"].includes(queue?.key)
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
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1)
    .filter((number) => number === 1 || number === pageCount || Math.abs(number - page) <= 2);
  const filtersActive = extra.channel !== "ALL" || extra.paymentStatus !== "ALL" || extra.status !== "ALL" || extra.fromDate || extra.toDate;

  return (
    <div className="space-y-5 max-lg:px-[2px] [&_.text-sm]:text-[14px] [&_.text-xs]:text-[12px]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.01em] text-ink">Orders</h1>
          <p className="mt-1 text-sm text-muted">
            {salesmanName ? <span className="font-medium text-ink">{salesmanName}&rsquo;s orders. </span> : null}
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

      <div role="group" aria-label="Filter orders" className="flex flex-wrap gap-2">
        {ORDER_QUEUES.map((q) => {
          const selected = queue?.key === q.key;
          const count = summary ? q.count(summary) : null;
          const attention = q.key === "to-accept" || q.key === "needs-rider";
          return (
            <button
              key={q.key}
              type="button"
              aria-pressed={selected}
              onClick={() => chooseQueue(q.key)}
              className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                selected
                  ? attention ? "border-amber-700 bg-amber-100 text-amber-950 ring-1 ring-amber-700" : "border-ink bg-ink text-white"
                  : attention ? "border-amber-400 bg-amber-50 text-amber-900 hover:border-amber-700 hover:bg-amber-100" : "border-control bg-white text-ink hover:border-ink hover:bg-raised"
              }`}
            >
              {q.label}
              <span className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${selected && !attention ? "bg-white/15 text-white" : attention ? "bg-amber-200/60 text-amber-950" : "bg-raised text-ink"}`}>
                {count === null ? "–" : count}
              </span>
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
          {/* SelectBar is always w-full; the wrapper sets its width. */}
          <div className="w-48">
            <SelectBar size="sm" aria-label="Salesman" value={salesmanId} onChange={(event) => setParam("salesman", event.target.value)}>
              <option value="">All salesmen</option>
              {salesmen.map((sm) => (
                <option key={sm.id} value={String(sm.id)}>{sm.name}</option>
              ))}
            </SelectBar>
          </div>
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
            {!loading && totalValue !== null && total ? (
              <span className="text-ink" title="Value of these orders, cancelled ones left out unless listed">
                {" · "}
                {formatCurrency(totalValue)}
              </span>
            ) : null}
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
            <DataTable mobileCardClassName="!rounded-lg !shadow-none [&_dt]:!text-muted [&_dt]:!normal-case [&_dt]:!tracking-normal"
              columns={columns}
              data={orders}
              emptyLabel={search || filtersActive ? "No orders match this search." : `Nothing in “${queue?.label || "this queue"}” right now.`}
              onRowClick={(order) => setSelectedOrderId(order.id)}
            />
          )}
        </div>

        {total > PAGE_SIZE ? (
          <nav aria-label="Order pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
            <span className="text-sm tabular-nums text-muted">{firstRow}–{lastRow} of {total} orders</span>
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="min-h-10 rounded-md border border-control bg-white px-3 text-sm hover:border-ink disabled:opacity-40">Previous</button>
              {pageNumbers.map((number, index) => (
                <span key={number} className="inline-flex items-center gap-1">
                  {index > 0 && number - pageNumbers[index - 1] > 1 ? <span className="px-1 text-muted">…</span> : null}
                  <button type="button" aria-label={`Page ${number}`} aria-current={number === page ? "page" : undefined} onClick={() => setPage(number)} className={`min-h-10 min-w-10 rounded-md border px-2 text-sm tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${number === page ? "border-ink bg-ink font-semibold text-white" : "border-control bg-white text-ink hover:border-ink hover:bg-raised"}`}>{number}</button>
                </span>
              ))}
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="min-h-10 rounded-md border border-control bg-white px-3 text-sm hover:border-ink disabled:opacity-40">Next</button>
              <label className="ml-2 flex items-center gap-2 text-sm text-muted">Go to page
                <select aria-label="Go to page" value={page} onChange={(event) => setPage(Number(event.target.value))} className="h-10 rounded-md border border-control bg-white px-2 tabular-nums text-ink">
                  {Array.from({ length: pageCount }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
                </select>
              </label>
            </div>
          </nav>
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
