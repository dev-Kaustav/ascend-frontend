"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";
import LineChartCard from "@/components/charts/LineChartCard";
import BarChartCard from "@/components/charts/BarChartCard";
import PieChartCard from "@/components/charts/PieChartCard";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import WarehouseSelector from "@/components/ui/WarehouseSelector";

const PAYMENT_STATUS_COLORS = {
  PAID:    "#34d399",
  PARTIAL: "#f59e0b",
  CREDIT:  "#f97316",
  UNPAID:  "#f97316",
};

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [warehouseId, setWarehouseId] = useState(null);
  const [outstandingSummary, setOutstandingSummary] = useState(null);
  const [collectionSummary, setCollectionSummary] = useState(null);
  const [dailySales, setDailySales] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (dateRange.from) params.set("from_date", dateRange.from);
        if (dateRange.to) params.set("to_date", dateRange.to);
        if (warehouseId) params.set("warehouse_id", String(warehouseId));
        const qs = params.toString();
        const url = qs ? `${apiEndpoints.admin.summary}?${qs}` : apiEndpoints.admin.summary;
        const response = await apiFetch(url);
        if (!active) return;
        setSummary(response);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load admin dashboard data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [dateRange, warehouseId]);

  useEffect(() => {
    let active = true;
    async function loadDashboards() {
      try {
        const params = new URLSearchParams();
        if (warehouseId) params.set("warehouse_id", String(warehouseId));
        if (dateRange.from) params.set("from_date", dateRange.from);
        if (dateRange.to) params.set("to_date", dateRange.to);
        const qs = params.toString();

        const [os, cs, ds] = await Promise.allSettled([
          apiFetch(`${apiEndpoints.admin.outstandingSummary}${qs ? `?${qs}` : ""}`),
          apiFetch(`${apiEndpoints.admin.collectionsSummary}${warehouseId ? `?warehouse_id=${warehouseId}` : ""}`),
          apiFetch(`${apiEndpoints.admin.dailySales}${qs ? `?${qs}` : ""}`),
        ]);
        if (!active) return;
        if (os.status === "fulfilled") setOutstandingSummary(os.value);
        if (cs.status === "fulfilled") setCollectionSummary(cs.value);
        if (ds.status === "fulfilled") setDailySales(ds.value);
      } catch {}
    }
    loadDashboards();
    return () => { active = false; };
  }, [dateRange, warehouseId]);

  const metrics = useMemo(() => ({
    totalOrders:       summary?.orders?.total || 0,
    revenue:           summary?.orders?.revenue || 0,
    outstanding:       summary?.orders?.outstanding || 0,
    inventoryValue:    summary?.inventory?.inventory_value ?? null,
    lowStockCount:     summary?.inventory?.low_stock_count || 0,
    lowStockThreshold: summary?.inventory?.low_stock_threshold || 0,
  }), [summary]);

  const ordersTimeline     = summary?.orders_over_time || [];
  const salesByWarehouse   = summary?.sales_by_warehouse || [];
  const inventoryByWarehouse = summary?.inventory?.by_warehouse || [];
  const paymentStatusCounts  = summary?.orders?.payment_status || {};
  const paymentStatusData = Object.entries(paymentStatusCounts).map(([key, value]) => ({
    label: key.charAt(0) + key.slice(1).toLowerCase(),
    value,
    color: PAYMENT_STATUS_COLORS[key] || "#94a3b8",
  }));

  const isFiltered = Boolean(dateRange.from || dateRange.to);

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">Loading admin overview…</div>;
  }

  if (error) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {isFiltered ? "Filtered range" : "All time"}
          </p>
          <WarehouseSelector value={warehouseId} onChange={setWarehouseId} />
        </div>
        <DateRangeFilter from={dateRange.from} to={dateRange.to} onChange={setDateRange} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <StatCard title="Total Orders" value={formatNumber(metrics.totalOrders)} subtitle="Outgoing orders recorded" accent="sky" />
        <StatCard title="Total Revenue" value={formatCurrency(metrics.revenue)} subtitle="Derived from outgoing orders" accent="emerald" />
        <StatCard title="Outstanding" value={formatCurrency(metrics.outstanding)} subtitle="Open against unpaid orders" accent="amber" />
        <StatCard
          title="Inventory Value"
          value={metrics.inventoryValue !== null ? formatCurrency(metrics.inventoryValue) : "—"}
          subtitle={metrics.inventoryValue !== null ? "Costed inventory on hand" : "Unit cost not available"}
          accent="sky"
        />
        <StatCard title="Low Stock SKUs" value={formatNumber(metrics.lowStockCount)} subtitle={`Below ${metrics.lowStockThreshold} units`} accent="rose" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <LineChartCard
          title="Orders over time"
          subtitle="Outgoing orders"
          data={ordersTimeline}
          lines={[{ dataKey: "orders", name: "Orders", color: "#22c55e" }]}
        />
        <BarChartCard
          title="Sales by warehouse"
          subtitle="Order volume"
          data={salesByWarehouse}
          bars={[{ dataKey: "orders", name: "Orders", color: "#38bdf8" }]}
        />
        <PieChartCard title="Payment status" subtitle="Paid vs outstanding" data={paymentStatusData} />
      </div>

      {(outstandingSummary || collectionSummary) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {outstandingSummary && (
            <StatCard
              title="Total Outstanding"
              value={formatCurrency(outstandingSummary.total_outstanding || 0)}
              subtitle={`Recovery rate: ${outstandingSummary.recovery_rate || 0}%`}
              accent="rose"
            />
          )}
          {collectionSummary && (
            <StatCard
              title="Today's Collection"
              value={formatCurrency(collectionSummary.grand_total || 0)}
              subtitle={`${Object.keys(collectionSummary.by_mode || {}).length} payment modes`}
              accent="emerald"
            />
          )}
          {outstandingSummary && (
            <StatCard
              title="Recovery Rate"
              value={`${outstandingSummary.recovery_rate || 0}%`}
              subtitle={`Recovered: ${formatCurrency(outstandingSummary.total_recovered || 0)}`}
              accent="amber"
            />
          )}
        </div>
      )}

      {dailySales && dailySales.days?.length > 0 && (
        <SectionCard title="Today's Sales" subtitle="Salesman-level performance">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-1.5">
              <thead>
                <tr>
                  {["Salesman", "Dispatched", "Delivered", "Cancelled", "Amount"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(dailySales.days[0]?.by_salesman || []).slice(0, 7).map((sm) => (
                  <tr key={sm.salesman_id} className="rounded-2xl border border-slate-200 bg-white shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)]">
                    <td className="px-3 py-2.5 text-sm font-medium text-slate-800">{sm.salesman_name}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">{sm.orders}</td>
                    <td className="px-3 py-2.5 text-sm text-emerald-600 font-medium">{sm.delivered}</td>
                    <td className="px-3 py-2.5 text-sm text-rose-600 font-medium">{sm.cancelled}</td>
                    <td className="px-3 py-2.5 text-sm font-medium text-slate-900">{formatCurrency(sm.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a href="/finance?tab=daily-sales" className="mt-3 inline-block text-xs text-slate-500 hover:text-slate-800 cursor-pointer">
            View Full Daily Sales →
          </a>
        </SectionCard>
      )}

      <SectionCard title="Inventory value by warehouse" subtitle="Units on hand by location">
        <div className="grid gap-4 md:grid-cols-2">
          {inventoryByWarehouse.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
              No inventory records available.
            </div>
          ) : (
            inventoryByWarehouse.map((entry) => (
              <div key={entry.warehouse_id || entry.warehouse_name} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  {entry.warehouse_name || `WH-${entry.warehouse_id}`}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{formatNumber(entry.units)} units</p>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
