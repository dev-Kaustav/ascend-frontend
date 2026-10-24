"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import SearchSelect from "@/components/ui/SearchSelect";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import { useToast } from "@/components/ui/ToastProvider";
import { apiEndpoints, apiFetch, apiFetchBlob, apiFetchCached } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";

const PAGE_SIZE = 50;

const TYPE_PILL = {
  IN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OUT: "border-rose-200 bg-rose-50 text-rose-700",
  RETURN: "border-amber-200 bg-amber-50 text-amber-700"
};

function monthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const qty = (value) => (value ? new Intl.NumberFormat("en-IN").format(value) : "—");

function Pager({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
      <span>
        Page {page} of {pageCount}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="cursor-pointer rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          className="cursor-pointer rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function StockLedgerPanel() {
  const { notify } = useToast();
  const [lookups, setLookups] = useState({ warehouses: [], brands: [], skus: [] });
  const [filters, setFilters] = useState({
    from: monthStart(),
    to: todayISO(),
    warehouseId: "",
    brandId: "",
    skuId: "",
    type: ""
  });
  const [data, setData] = useState({ summary: [], movements: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [summaryPage, setSummaryPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);

  useEffect(() => {
    apiFetchCached(apiEndpoints.admin.lookups)
      .then((response) =>
        setLookups({
          warehouses: response?.warehouses || [],
          brands: response?.brands || [],
          skus: response?.skus || []
        })
      )
      .catch(() => {});
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from_date", filters.from);
    if (filters.to) params.set("to_date", filters.to);
    if (filters.warehouseId) params.set("warehouse_id", filters.warehouseId);
    if (filters.brandId) params.set("brand_id", filters.brandId);
    if (filters.skuId) params.set("sku_id", filters.skuId);
    if (filters.type) params.set("transaction_type", filters.type);
    return params.toString();
  }, [filters]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch(`${apiEndpoints.admin.stockLedger}?${query}`)
      .then((response) => {
        if (!active) return;
        setData({ summary: response?.summary || [], movements: response?.movements || [] });
        setSummaryPage(1);
        setMovementPage(1);
        setError("");
      })
      .catch((err) => active && setError(err?.message || "Unable to load the stock ledger."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query]);

  const setFilter = (key, value) =>
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      // A SKU from another brand would silently empty the ledger.
      ...(key === "brandId" ? { skuId: "" } : {})
    }));

  const skuOptions = useMemo(
    () =>
      lookups.skus
        .filter((sku) => !filters.brandId || String(sku.brand_id) === filters.brandId)
        .map((sku) => ({ value: String(sku.id), label: sku.name, keywords: [sku.code] })),
    [lookups.skus, filters.brandId]
  );

  const totals = useMemo(
    () =>
      data.summary.reduce(
        (acc, row) => ({
          opening: acc.opening + row.opening,
          received: acc.received + row.received,
          dispatched: acc.dispatched + row.dispatched,
          returned: acc.returned + row.returned,
          closing: acc.closing + row.closing
        }),
        { opening: 0, received: 0, dispatched: 0, returned: 0, closing: 0 }
      ),
    [data.summary]
  );

  const download = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await apiFetchBlob(`${apiEndpoints.admin.stockLedgerExport}?${query}`);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "stock_ledger.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      notify(err?.message || "Unable to download the stock ledger.", { tone: "error" });
    } finally {
      setExporting(false);
    }
  };

  const summaryColumns = useMemo(
    () => [
      {
        header: "SKU",
        accessorKey: "sku_name",
        meta: { mobilePrimary: true },
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-slate-800">{row.original.sku_name}</p>
            <p className="text-xs text-slate-400">{[row.original.sku_code, row.original.brand_name].filter(Boolean).join(" · ")}</p>
          </div>
        )
      },
      { header: "Warehouse", accessorKey: "warehouse_name" },
      { header: "Opening", accessorKey: "opening", meta: { type: "number" }, cell: ({ getValue }) => qty(getValue()) },
      { header: "Received", accessorKey: "received", meta: { type: "number" }, cell: ({ getValue }) => qty(getValue()) },
      { header: "Dispatched", accessorKey: "dispatched", meta: { type: "number" }, cell: ({ getValue }) => qty(getValue()) },
      { header: "Returned", accessorKey: "returned", meta: { type: "number" }, cell: ({ getValue }) => qty(getValue()) },
      {
        header: "Closing",
        accessorKey: "closing",
        meta: { type: "number" },
        cell: ({ getValue }) => <span className="font-semibold text-slate-900">{qty(getValue())}</span>
      }
    ],
    []
  );

  const movementColumns = useMemo(
    () => [
      {
        header: "SKU",
        accessorKey: "sku_name",
        meta: { mobilePrimary: true },
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-slate-800">{row.original.sku_name}</p>
            <p className="text-xs text-slate-400">{row.original.warehouse_name}</p>
          </div>
        )
      },
      { header: "Date", accessorKey: "created_at", cell: ({ getValue }) => formatDateTime(getValue()) },
      {
        header: "Type",
        accessorKey: "transaction_type",
        cell: ({ row }) => (
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TYPE_PILL[row.original.transaction_type] || ""}`}>
            {row.original.type_label}
          </span>
        )
      },
      {
        header: "Reference",
        id: "reference",
        cell: ({ row }) => {
          const m = row.original;
          const parts = [
            m.order_id ? `Order #${m.order_id}` : null,
            m.invoice_number,
            m.credit_note_number ? `CN ${m.credit_note_number}` : null
          ].filter(Boolean);
          return parts.length ? parts.join(" · ") : "—";
        }
      },
      { header: "Party", accessorKey: "party", cell: ({ getValue }) => getValue() || "—" },
      {
        header: "Batch",
        accessorKey: "batch_id",
        meta: { mobileHidden: true },
        cell: ({ row }) =>
          row.original.batch_id
            ? `#${row.original.batch_id}${row.original.expiry_date ? ` · exp ${formatDate(row.original.expiry_date)}` : ""}`
            : "—"
      },
      { header: "In", accessorKey: "quantity_in", meta: { type: "number" }, cell: ({ getValue }) => qty(getValue()) },
      { header: "Out", accessorKey: "quantity_out", meta: { type: "number" }, cell: ({ getValue }) => qty(getValue()) },
      {
        header: "Balance",
        accessorKey: "balance",
        meta: { type: "number" },
        cell: ({ getValue }) => <span className="font-semibold text-slate-900">{new Intl.NumberFormat("en-IN").format(getValue())}</span>
      }
    ],
    []
  );

  const summaryPageCount = Math.max(1, Math.ceil(data.summary.length / PAGE_SIZE));
  const movementPageCount = Math.max(1, Math.ceil(data.movements.length / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <SectionCard
        title="Stock ledger"
        subtitle="Every receipt, dispatch and return, with running balances. The download uses the same filters."
        actions={
          <button
            type="button"
            onClick={download}
            disabled={exporting}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
          >
            <Download className="h-4 w-4" strokeWidth={2.25} />
            {exporting ? "Preparing…" : "Download Excel"}
          </button>
        }
      >
        <div className="space-y-3">
          <DateRangeFilter onChange={({ from, to }) => setFilters((prev) => ({ ...prev, from, to }))} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">From</span>
              <InputBar type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter("from", e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">To</span>
              <InputBar type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter("to", e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Movement</span>
              <SelectBar value={filters.type} onChange={(e) => setFilter("type", e.target.value)}>
                <option value="">All movements</option>
                <option value="IN">Receipts</option>
                <option value="OUT">Dispatches</option>
                <option value="RETURN">Returns</option>
              </SelectBar>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Warehouse</span>
              <SelectBar value={filters.warehouseId} onChange={(e) => setFilter("warehouseId", e.target.value)}>
                <option value="">All warehouses</option>
                {lookups.warehouses.map((w) => (
                  <option key={w.id} value={String(w.id)}>
                    {w.name}
                  </option>
                ))}
              </SelectBar>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Brand</span>
              <SelectBar value={filters.brandId} onChange={(e) => setFilter("brandId", e.target.value)}>
                <option value="">All brands</option>
                {lookups.brands.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </SelectBar>
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">SKU</span>
              <SearchSelect
                value={filters.skuId}
                onChange={(value) => setFilter("skuId", value)}
                options={skuOptions}
                placeholder="All SKUs — type to search"
                ariaLabel="Filter by SKU"
              />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ["Opening", totals.opening],
              ["Received", totals.received],
              ["Dispatched", totals.dispatched],
              ["Returned", totals.returned],
              ["Closing", totals.closing]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{new Intl.NumberFormat("en-IN").format(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-slate-400">
            Units across the filtered SKUs. Order, party and invoice references are recorded from 24 Oct 2026 onwards.
          </p>
        </div>
      </SectionCard>

      {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">{error}</div> : null}

      <SectionCard title="Stock summary" subtitle={loading ? "Loading…" : `${data.summary.length} SKU × warehouse rows`}>
        <DataTable
          columns={summaryColumns}
          data={data.summary.slice((summaryPage - 1) * PAGE_SIZE, summaryPage * PAGE_SIZE)}
          emptyLabel={loading ? "Loading…" : "No stock in this range."}
        />
        <Pager page={summaryPage} pageCount={summaryPageCount} onChange={setSummaryPage} />
      </SectionCard>

      <SectionCard title="Movements" subtitle={loading ? "Loading…" : `${data.movements.length} movements, newest first`}>
        <DataTable
          columns={movementColumns}
          data={data.movements.slice((movementPage - 1) * PAGE_SIZE, movementPage * PAGE_SIZE)}
          emptyLabel={loading ? "Loading…" : "No movements match these filters."}
          tableClassName="min-w-[1100px]"
        />
        <Pager page={movementPage} pageCount={movementPageCount} onChange={setMovementPage} />
      </SectionCard>
    </div>
  );
}
