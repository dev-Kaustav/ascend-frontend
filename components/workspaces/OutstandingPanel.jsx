"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch, apiFetchCached } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import DataTable from "@/components/tables/DataTable";
import InvoiceCell from "@/components/ui/InvoiceCell";

const PAGE_SIZE = 50;
const VIEWS = ["Bill-wise", "Salesman Summary", "Outlet Summary"];

export default function OutstandingPanel({ warehouseId }) {
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [salesmen, setSalesmen] = useState([]);
  const [salesmanId, setSalesmanId] = useState("");
  const [outletSearch, setOutletSearch] = useState("");
  const [view, setView] = useState("Bill-wise");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadLookups() {
      try {
        const resp = await apiFetchCached(apiEndpoints.admin.lookups);
        if (!active) return;
        setSalesmen(resp?.salesmen || []);
      } catch {}
    }
    loadLookups();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (warehouseId) params.set("warehouse_id", warehouseId);
        if (dateRange.from) params.set("from_date", dateRange.from);
        if (dateRange.to) params.set("to_date", dateRange.to);
        if (salesmanId) params.set("salesman_id", salesmanId);
        if (outletSearch.trim()) params.set("retailer_id", outletSearch.trim());
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String((page - 1) * PAGE_SIZE));

        const summaryParams = new URLSearchParams();
        if (warehouseId) summaryParams.set("warehouse_id", warehouseId);
        if (dateRange.from) summaryParams.set("from_date", dateRange.from);
        if (dateRange.to) summaryParams.set("to_date", dateRange.to);

        const [itemsResp, summaryResp] = await Promise.all([
          apiFetch(`${apiEndpoints.admin.outstanding}?${params.toString()}`),
          apiFetch(`${apiEndpoints.admin.outstandingSummary}?${summaryParams.toString()}`)
        ]);
        if (!active) return;
        setItems(itemsResp?.items || []);
        setTotal(itemsResp?.total ?? 0);
        setSummary(summaryResp);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load outstanding data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [warehouseId, dateRange, salesmanId, outletSearch, page]);

  const aging = summary?.aging || {};
  const agingSegments = useMemo(() => {
    const segments = [
      { key: "0_7", label: "0-7d", color: "bg-emerald-400", amount: aging["0_7"] || 0 },
      { key: "7_15", label: "7-15d", color: "bg-amber-400", amount: aging["7_15"] || 0 },
      { key: "15_30", label: "15-30d", color: "bg-orange-400", amount: aging["15_30"] || 0 },
      { key: "30_plus", label: "30d+", color: "bg-rose-500", amount: aging["30_plus"] || 0 },
    ];
    const totalAging = segments.reduce((s, seg) => s + seg.amount, 0);
    return segments.map((seg) => ({
      ...seg,
      pct: totalAging > 0 ? (seg.amount / totalAging) * 100 : 0,
    }));
  }, [aging]);

  const billColumns = useMemo(
    () => [
      {
        header: "Outlet",
        accessorKey: "retailer_name",
        cell: ({ row }) => row.original.retailer_name || "—",
      },
      {
        header: "Bill No",
        accessorKey: "invoice_number",
        cell: ({ row }) => <InvoiceCell invoiceNumber={row.original.invoice_number} />,
      },
      {
        header: "Order",
        accessorKey: "order_id",
        cell: ({ row }) => `#${row.original.order_id}`,
      },
      {
        header: "Date",
        accessorKey: "order_date",
        cell: ({ row }) => formatDate(row.original.order_date),
      },
      {
        header: "Amount",
        accessorKey: "grand_total",
        meta: { type: "number" },
        cell: ({ row }) => formatCurrency(row.original.grand_total),
      },
      {
        header: "Paid",
        accessorKey: "payments_total",
        meta: { type: "number" },
        cell: ({ row }) => {
          const modes = row.original.payment_modes;
          const modeEntries = modes ? Object.entries(modes).filter(([, v]) => v > 0) : [];
          return (
            <div>
              <span>{formatCurrency(row.original.payments_total)}</span>
              {modeEntries.length > 1 && (
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {modeEntries.map(([mode, amt]) => (
                    <span
                      key={mode}
                      className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                    >
                      {mode}:{formatCurrency(amt)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        },
      },
      {
        header: "Recovery",
        accessorKey: "recovery",
        meta: { type: "number" },
        cell: ({ row }) => {
          const gt = row.original.grand_total || 0;
          const pt = row.original.payments_total || 0;
          if (gt === 0) return "—";
          return `${((pt / gt) * 100).toFixed(1)}%`;
        },
      },
      {
        header: "CN",
        accessorKey: "credit_note_total",
        meta: { type: "number" },
        cell: ({ row }) => formatCurrency(row.original.credit_note_total),
      },
      {
        header: "Pending",
        accessorKey: "outstanding",
        meta: { type: "number" },
        cell: ({ row }) => (
          <span className="font-semibold text-rose-600">
            {formatCurrency(row.original.outstanding)}
          </span>
        ),
      },
    ],
    []
  );

  const salesmanSummaryData = summary?.by_salesman || [];
  const salesmanColumns = useMemo(
    () => [
      {
        header: "Salesman",
        accessorKey: "salesman_name",
        cell: ({ row }) => row.original.salesman_name || "—",
      },
      {
        header: "Total Credit",
        accessorKey: "total_credit",
        meta: { type: "number" },
        cell: ({ row }) => formatCurrency(row.original.total_credit),
      },
      {
        header: "Recovered",
        accessorKey: "recovered",
        meta: { type: "number" },
        cell: ({ row }) => formatCurrency(row.original.recovered),
      },
      {
        header: "Pending",
        accessorKey: "pending",
        meta: { type: "number" },
        cell: ({ row }) => (
          <span className="font-semibold text-rose-600">
            {formatCurrency(row.original.pending)}
          </span>
        ),
      },
      {
        header: "Recovery %",
        accessorKey: "recovery_rate",
        meta: { type: "number" },
        cell: ({ row }) => {
          const tc = row.original.total_credit || 0;
          const rec = row.original.recovered || 0;
          if (tc === 0) return "—";
          return `${((rec / tc) * 100).toFixed(1)}%`;
        },
      },
      {
        header: "Bills",
        accessorKey: "bills",
        meta: { type: "number" },
        cell: ({ row }) => row.original.bills ?? "—",
      },
    ],
    []
  );

  const outletSummaryData = summary?.by_retailer || [];
  const outletColumns = useMemo(
    () => [
      {
        header: "Outlet",
        accessorKey: "retailer_name",
        cell: ({ row }) => row.original.retailer_name || "—",
      },
      {
        header: "Bills",
        accessorKey: "bills",
        meta: { type: "number" },
        cell: ({ row }) => row.original.bills ?? "—",
      },
      {
        header: "Total Credit",
        accessorKey: "total_credit",
        meta: { type: "number" },
        cell: ({ row }) => formatCurrency(row.original.total_credit),
      },
      {
        header: "Recovered",
        accessorKey: "recovered",
        meta: { type: "number" },
        cell: ({ row }) => formatCurrency(row.original.recovered),
      },
      {
        header: "Pending",
        accessorKey: "pending",
        meta: { type: "number" },
        cell: ({ row }) => (
          <span className="font-semibold text-rose-600">
            {formatCurrency(row.original.pending)}
          </span>
        ),
      },
    ],
    []
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading && !summary) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading outstanding data…
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <DateRangeFilter
          from={dateRange.from}
          to={dateRange.to}
          onChange={(r) => { setDateRange(r); setPage(1); }}
        />
        <select
          value={salesmanId}
          onChange={(e) => { setSalesmanId(e.target.value); setPage(1); }}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
        >
          <option value="">All Salesmen</option>
          {salesmen.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          type="text"
          value={outletSearch}
          onChange={(e) => { setOutletSearch(e.target.value); setPage(1); }}
          placeholder="Search outlet…"
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none placeholder:text-slate-400"
        />
        {(dateRange.from || dateRange.to || salesmanId || outletSearch) && (
          <button
            type="button"
            onClick={() => {
              setDateRange({ from: "", to: "" });
              setSalesmanId("");
              setOutletSearch("");
              setPage(1);
            }}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-50"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Outstanding"
          value={formatCurrency(summary?.total_outstanding)}
          subtitle="Unpaid balance"
          accent="rose"
        />
        <StatCard
          title="Total Recovered"
          value={formatCurrency(summary?.total_recovered)}
          subtitle="Payments received"
          accent="emerald"
        />
        <StatCard
          title="Recovery Rate"
          value={summary?.recovery_rate != null ? `${Number(summary.recovery_rate).toFixed(1)}%` : "—"}
          subtitle="Of total credit"
          accent="amber"
        />
        <StatCard
          title="Credit Note Adj."
          value={formatCurrency(summary?.total_credit_notes)}
          subtitle="CN adjustments"
          accent="sky"
        />
      </div>

      {agingSegments.some((s) => s.amount > 0) && (
        <SectionCard title="Aging Analysis" subtitle="Outstanding by age bracket">
          <div className="flex h-8 w-full overflow-hidden rounded-full">
            {agingSegments.map((seg) =>
              seg.pct > 0 ? (
                <div
                  key={seg.key}
                  className={`${seg.color} transition-all`}
                  style={{ width: `${seg.pct}%` }}
                />
              ) : null
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            {agingSegments.map((seg) => (
              <div key={seg.key} className="flex items-center gap-2 text-xs text-slate-600">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${seg.color}`} />
                <span className="font-medium">{seg.label}</span>
                <span className="text-slate-400">{formatCurrency(seg.amount)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Outstanding Orders"
        subtitle={error && summary ? error : undefined}
        actions={
          <div className="flex flex-wrap gap-1">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  view === v
                    ? "bg-[#1a1b2e] text-white shadow-lg shadow-[#1a1b2e]/20"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        }
      >
        {view === "Bill-wise" && (
          <>
            <DataTable
              columns={billColumns}
              data={items}
              emptyLabel={loading ? "Loading…" : "No outstanding orders."}
            />
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Page {page} of {totalPages}</span>
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
                  disabled={page >= totalPages}
                  className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}

        {view === "Salesman Summary" && (
          <DataTable
            columns={salesmanColumns}
            data={salesmanSummaryData}
            emptyLabel={loading ? "Loading…" : "No salesman data."}
          />
        )}

        {view === "Outlet Summary" && (
          <DataTable
            columns={outletColumns}
            data={outletSummaryData}
            emptyLabel={loading ? "Loading…" : "No outlet data."}
          />
        )}
      </SectionCard>
    </div>
  );
}
