"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch, apiFetchBlob, apiFetchCached } from "@/lib/api";
import { formatCount, formatCurrency, formatDate } from "@/lib/format";
import PeriodSelect, { ALL_TIME, describePeriod, periodQuery } from "@/components/ui/PeriodSelect";
import DataTable from "@/components/tables/DataTable";
import SkuCell from "@/components/ui/SkuCell";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import { roleCanManageInventory } from "@/lib/workspaceRoutes";
import { useAuth } from "@/components/auth/AuthProvider";

const BUTTON = "inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-md border border-control bg-white px-3 text-sm font-medium text-ink hover:border-ink hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-default disabled:opacity-50 lg:min-h-9";
const VIEWS = [
  { key: "all", label: "All SKUs", empty: "No SKUs match your search." },
  { key: "running_low", label: "Running low", empty: "No SKUs have fewer than 14 days of available stock at this period’s dispatch pace." },
  { key: "out_of_stock", label: "Out of stock", empty: "Every SKU has stock available." },
  { key: "expiring", label: "Expiring in 60 days", empty: "Nothing expires in the next 60 days." },
];

export default function WarehouseInventory() {
  const { role } = useAuth();
  const [period, setPeriod] = useState(ALL_TIME);
  const [warehouse, setWarehouse] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [overview, setOverview] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [skuMovements, setSkuMovements] = useState([]);
  const [drawerError, setDrawerError] = useState("");
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [retry, setRetry] = useState(0);
  const dialog = useRef(null);
  const selected = overview?.skus.find((sku) => sku.sku_id === selectedId);

  useEffect(() => {
    let active = true;
    apiFetchCached(apiEndpoints.admin.lookups).then((data) => { if (active) setWarehouses(data.warehouses || []); }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    const params = periodQuery(period);
    if (warehouse) params.set("warehouse_id", warehouse);
    setLoading(true);
    Promise.all([
      apiFetch(`${apiEndpoints.admin.inventoryOverview}?${params}`),
      apiFetch(`${apiEndpoints.admin.stockLedger}?${params}`),
    ]).then(([stock, movements]) => {
      if (active) { setOverview(stock); setLedger(movements); setError(""); }
    }).catch((err) => { if (active) setError(err.message || "Couldn't load inventory."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period, warehouse, retry]);
  useEffect(() => {
    if (!selectedId) return;
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => { element.close(); document.body.style.overflow = previousOverflow; };
  }, [selectedId]);
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    const params = periodQuery(period);
    if (warehouse) params.set("warehouse_id", warehouse);
    params.set("sku_id", selectedId);
    setDrawerLoading(true);
    setSkuMovements([]);
    setDrawerError("");
    apiFetch(`${apiEndpoints.admin.stockLedger}?${params}`).then((data) => { if (active) setSkuMovements(data.movements || []); })
      .catch((err) => { if (active) setDrawerError(err.message || "Couldn't load SKU movements."); })
      .finally(() => { if (active) setDrawerLoading(false); });
    return () => { active = false; };
  }, [selectedId, period, warehouse]);

  const rows = useMemo(() => (overview?.skus || []).filter((sku) =>
    (view === "all" || sku[view]) && `${sku.name} ${sku.code || ""}`.toLowerCase().includes(search.toLowerCase())
  ), [overview, view, search]);
  const movements = useMemo(() => (ledger?.movements || []).filter((row) =>
    (!kind || row.transaction_type === kind) && `${row.sku_name} ${row.sku_code || ""}`.toLowerCase().includes(search.toLowerCase())
  ), [ledger, kind, search]);
  const columns = useMemo(() => [
    { header: "SKU", accessorKey: "name", meta: { mobilePrimary: true }, cell: ({ row }) => <button type="button" className="w-full cursor-pointer text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink" onClick={() => setSelectedId(row.original.sku_id)}><SkuCell sku={row.original} /></button> },
    ...[["On hand", "on_hand"], ["Reserved", "reserved"], ["Available", "available"], ["Received", "received"], ["Dispatched", "dispatched"]].map(([header, key]) => ({ header, accessorKey: key, meta: { type: "number" }, cell: ({ row }) => formatCount(row.original[key]) })),
    { header: "Lasts", accessorKey: "days_left", meta: { type: "number" }, cell: ({ row }) => <span className={row.original.running_low ? "font-medium text-amber-800" : ""}>{row.original.days_left === null ? "—" : `${formatCount(row.original.days_left)} days`}</span> },
    { header: "Earliest expiry", accessorKey: "earliest_expiry", cell: ({ row }) => <span className={row.original.expiring ? "text-amber-800" : ""}>{formatDate(row.original.earliest_expiry)}</span> },
    { header: "Value", accessorKey: "value", meta: { type: "number" }, cell: ({ row }) => formatCurrency(row.original.value) },
  ], []);
  const movementColumns = useMemo(() => [
    { header: "Date", accessorKey: "created_at", cell: ({ row }) => formatDate(row.original.created_at) },
    { header: "SKU", accessorKey: "sku_name", meta: { mobilePrimary: true } },
    { header: "Warehouse", accessorKey: "warehouse_name" },
    { header: "Movement", accessorKey: "type_label" },
    { header: "In", accessorKey: "quantity_in", meta: { type: "number" }, cell: ({ row }) => formatCount(row.original.quantity_in) },
    { header: "Out", accessorKey: "quantity_out", meta: { type: "number" }, cell: ({ row }) => formatCount(row.original.quantity_out) },
    { header: "Balance", accessorKey: "balance", meta: { type: "number" }, cell: ({ row }) => formatCount(row.original.balance) },
  ], []);

  async function download() {
    setExporting(true);
    setExportError("");
    try {
      const params = periodQuery(period);
      if (warehouse) params.set("warehouse_id", warehouse);
      if (kind) params.set("transaction_type", kind);
      const { blob, filename } = await apiFetchBlob(`${apiEndpoints.admin.stockLedgerExport}?${params}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = filename || "stock-ledger.xlsx"; link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setExportError(err.message || "Couldn't download the ledger."); }
    finally { setExporting(false); }
  }
  const totals = overview?.totals;
  return (
    <div className="space-y-5 tabular-nums max-lg:px-[2px] [&_.text-sm]:text-[14px] [&_.text-xs]:text-[12px]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-[24px] font-semibold text-ink">Inventory</h1><p className="mt-1 hidden text-sm text-muted lg:block">Stock available to sell, batches to watch, and every movement.</p></div>
        <div className="flex gap-2"><button type="button" className={BUTTON} onClick={download} disabled={exporting}>{exporting ? "Downloading…" : "Download Excel"}</button>{roleCanManageInventory(role) ? <Link className="inline-flex min-h-[44px] items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong lg:min-h-9" href="/app/operations/inventory/add">Receive stock</Link> : null}</div>
      </header>
      <div className="flex flex-wrap items-center gap-2 max-lg:[&_select]:min-h-[44px]">
        <PeriodSelect value={period} onChange={(value) => { setPeriod(value); setPage(1); }} />
        <div className="w-44"><SelectBar size="sm" aria-label="Warehouse" value={warehouse} onChange={(event) => { setWarehouse(event.target.value); setPage(1); }}><option value="">All warehouses</option>{warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectBar></div>
        <InputBar type="search" size="sm" aria-label="Search SKU" placeholder="Search SKU name or code" className="min-w-[180px] flex-1 lg:max-w-xs" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <button type="button" className={`${BUTTON} ml-auto`} onClick={() => setRetry((value) => value + 1)}>Refresh</button>
      </div>
      {error || exportError ? <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error || exportError} <button type="button" className="font-semibold underline" onClick={() => setRetry((value) => value + 1)}>Retry</button></div> : null}
      <section aria-label="Current stock totals" className="rounded-lg border border-line bg-white">
        <dl className="grid grid-cols-2 divide-line lg:grid-cols-4">
          {[["Stock value", totals ? formatCurrency(totals.value) : "…"], ["Units on hand", totals ? formatCount(totals.on_hand) : "…"], ["Reserved", totals ? formatCount(totals.reserved) : "…"], ["Available to sell", totals ? formatCount(totals.available) : "…"]].map(([label, value], index) => <div key={label} className={`p-4 ${index ? "lg:border-l" : ""} ${index % 2 ? "max-lg:border-l" : ""} ${index > 1 ? "max-lg:border-t" : ""}`}><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</dd></div>)}
        </dl>
        <p className="border-t border-line px-4 py-2 text-xs text-muted">Stock as of today · Last movement {overview?.last_movement_at ? formatDate(overview.last_movement_at) : "not recorded"}{totals?.unpriced_skus ? ` · ${totals.unpriced_skus} SKUs have no landing price` : ""}{totals?.expired ? ` · ${formatCount(totals.expired)} expired units excluded from available stock` : ""}</p>
      </section>
      <section className="rounded-lg border border-line bg-white p-4" aria-busy={loading}>
        <div role="group" aria-label="Stock views" className="mb-3 flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible [&_button]:shrink-0">{VIEWS.map((item) => <button key={item.key} type="button" aria-pressed={view === item.key} className={`${BUTTON} ${view === item.key ? "!border-ink !bg-ink !text-white" : item.key !== "all" && overview?.counts[item.key] ? "!border-amber-400 !bg-amber-50 !text-amber-900" : ""}`} onClick={() => setView(item.key)}>{item.label}<span className="ml-2 tabular-nums">{overview?.counts[item.key] ?? "…"}</span></button>)}</div>
        <p className="mb-2 hidden text-xs text-muted lg:block">Received and dispatched: {describePeriod(period)} · Lasts: available stock at this period’s dispatch pace · Select a SKU for batches</p>
        <DataTable mobileCardClassName="!rounded-lg !shadow-none [&_dt]:!text-muted [&_dt]:!normal-case [&_dt]:!tracking-normal" columns={columns} renderMobileRow={(sku) => (
          <button type="button" onClick={() => setSelectedId(sku.sku_id)} className="w-full rounded-md border border-line bg-white p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink">
            <SkuCell sku={sku} />
            <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 text-sm tabular-nums">
              {[["On hand", formatCount(sku.on_hand)], ["Reserved", formatCount(sku.reserved)], ["Available", formatCount(sku.available)], ["Received", formatCount(sku.received)], ["Dispatched", formatCount(sku.dispatched)], ["Value", formatCurrency(sku.value)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd>{value}</dd></div>)}
            </dl>
            <p className="mt-2 text-xs text-muted">Lasts {sku.days_left === null ? "—" : `${sku.days_left} days`} · Expiry {formatDate(sku.earliest_expiry)}</p>
          </button>
        )} data={rows} containerClassName="max-h-[400px] overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-white" onRowClick={(sku) => setSelectedId(sku.sku_id)} emptyLabel={loading ? "Loading stock…" : search ? "No SKUs match your search." : VIEWS.find((item) => item.key === view).empty} />
        {totals ? <p className="border-t border-line pt-3 text-right text-sm tabular-nums text-muted">All SKUs · Received {formatCount(totals.received)} · Dispatched {formatCount(totals.dispatched)} · Returned {formatCount(totals.returned)} · Value {formatCurrency(totals.value)}</p> : null}
      </section>
      <section className="rounded-lg border border-line bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold text-ink">Movements</h2><div className="w-44"><SelectBar size="sm" aria-label="Movement type" value={kind} onChange={(event) => { setKind(event.target.value); setPage(1); }}><option value="">All movements</option><option value="IN">Receipts</option><option value="OUT">Dispatches</option><option value="RETURN">Returns</option></SelectBar></div></div>
        <DataTable mobileCardClassName="!rounded-lg !shadow-none [&_dt]:!text-muted [&_dt]:!normal-case [&_dt]:!tracking-normal" columns={movementColumns} data={movements.slice((page - 1) * 50, page * 50)} containerClassName="max-h-[440px] overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-white" emptyLabel={loading ? "Loading movements…" : `No stock moved ${period.key === "all" ? "in this view" : `during ${describePeriod(period).toLowerCase()}`}. Last movement ${overview?.last_movement_at ? formatDate(overview.last_movement_at) : "not recorded"}.`} />
        {!movements.length && period.key !== "all" ? <button type="button" className={`${BUTTON} mt-3`} onClick={() => setPeriod(ALL_TIME)}>Show all time</button> : null}
        {movements.length > 50 ? <div className="mt-3 flex items-center justify-end gap-2 text-sm text-muted"><span>{(page - 1) * 50 + 1}–{Math.min(page * 50, movements.length)} of {movements.length}</span><button type="button" className={BUTTON} disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><button type="button" className={BUTTON} disabled={page * 50 >= movements.length} onClick={() => setPage(page + 1)}>Next</button></div> : null}
      </section>
      {selected ? <dialog ref={dialog} onCancel={() => setSelectedId(null)} onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setSelectedId(null); }} aria-labelledby="sku-title" className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-[760px] overflow-y-auto border-0 border-l border-line bg-canvas p-4 text-ink backdrop:bg-black/30 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="sku-title" className="text-xl font-semibold">{selected.name}</h2><p className="text-sm text-muted">{selected.code}</p></div><button type="button" autoFocus className={BUTTON} onClick={() => setSelectedId(null)}>Close</button></div>
        <div className="space-y-5">
          <section className="rounded-lg border border-line bg-white p-4"><h3 className="mb-3 font-semibold">Stock by warehouse</h3>{selected.warehouses.length ? selected.warehouses.map((item) => <div key={item.warehouse_id} className="flex flex-wrap justify-between gap-2 border-b border-line py-2 last:border-0"><span>{item.name}</span><span className="text-sm tabular-nums">{formatCount(item.total_quantity)} on hand · {formatCount(item.reserved_quantity)} reserved · {formatCount(item.available_quantity)} available</span></div>) : <p className="text-sm text-muted">This SKU has never been stocked here.</p>}</section>
          <section className="rounded-lg border border-line bg-white p-4"><h3 className="mb-2 font-semibold">Batches</h3><DataTable mobileCardClassName="!rounded-lg !shadow-none [&_dt]:!text-muted [&_dt]:!normal-case [&_dt]:!tracking-normal" data={selected.batches} emptyLabel="No batches have stock remaining." columns={[
            { header: "Batch", accessorKey: "id", cell: ({ row }) => `#${row.original.id}` },
            { header: "Warehouse", accessorKey: "warehouse_name" },
            { header: "Expiry", accessorKey: "expiry_date", cell: ({ row }) => formatDate(row.original.expiry_date) },
            { header: "Remaining", accessorKey: "remaining", meta: { type: "number" } },
            { header: "Reserved", accessorKey: "reserved", meta: { type: "number" } },
          ]} /></section>
          <section className="rounded-lg border border-line bg-white p-4"><h3 className="mb-2 font-semibold">Movements · {describePeriod(period)}</h3>{drawerError ? <p role="alert" className="text-sm text-rose-800">{drawerError}</p> : <DataTable mobileCardClassName="!rounded-lg !shadow-none [&_dt]:!text-muted [&_dt]:!normal-case [&_dt]:!tracking-normal" columns={movementColumns.filter((column) => column.accessorKey !== "sku_name")} data={skuMovements} emptyLabel={drawerLoading ? "Loading SKU movements…" : "No movements for this SKU in this period."} />}</section>
        </div>
      </dialog> : null}
    </div>
  );
}
