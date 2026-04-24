"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";
import LineChartCard from "@/components/charts/LineChartCard";
import BarChartCard from "@/components/charts/BarChartCard";
import PieChartCard from "@/components/charts/PieChartCard";

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetch(apiEndpoints.admin.summary);
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
    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => {
    return {
      totalOrders: summary?.orders?.total || 0,
      revenue: summary?.orders?.revenue || 0,
      outstanding: summary?.orders?.outstanding || 0,
      inventoryValue: summary?.inventory?.inventory_value ?? null,
      lowStockCount: summary?.inventory?.low_stock_count || 0,
      lowStockThreshold: summary?.inventory?.low_stock_threshold || 0
    };
  }, [summary]);

  const ordersTimeline = summary?.orders_over_time || [];
  const salesByWarehouse = summary?.sales_by_warehouse || [];
  const inventoryByWarehouse = summary?.inventory?.by_warehouse || [];
  const paymentStatusCounts = summary?.orders?.payment_status || {};
  const paymentStatusData = [
    { label: "Paid", value: paymentStatusCounts.PAID || 0, color: "#34d399" },
    { label: "Partial", value: paymentStatusCounts.PARTIAL || 0, color: "#f59e0b" },
    { label: "Credit", value: paymentStatusCounts.CREDIT || paymentStatusCounts.UNPAID || 0, color: "#f97316" }
  ];

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading admin overview…
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
      <div className="grid gap-4 lg:grid-cols-5">
        <StatCard
          title="Total Orders"
          value={formatNumber(metrics.totalOrders)}
          subtitle="Outgoing orders recorded"
          accent="sky"
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(metrics.revenue)}
          subtitle="Derived from outgoing orders"
          accent="emerald"
        />
        <StatCard
          title="Outstanding"
          value={formatCurrency(metrics.outstanding)}
          subtitle="Open against unpaid orders"
          accent="amber"
        />
        <StatCard
          title="Inventory Value"
          value={metrics.inventoryValue !== null ? formatCurrency(metrics.inventoryValue) : "—"}
          subtitle={metrics.inventoryValue !== null ? "Costed inventory on hand" : "Unit cost not available"}
          accent="sky"
        />
        <StatCard
          title="Low Stock SKUs"
          value={formatNumber(metrics.lowStockCount)}
          subtitle={`Below ${metrics.lowStockThreshold} units`}
          accent="rose"
        />
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

      <SectionCard title="Inventory value by warehouse" subtitle="Units on hand by location">
        <div className="grid gap-4 md:grid-cols-2">
          {inventoryByWarehouse.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
              No inventory records available.
            </div>
          ) : (
            inventoryByWarehouse.map((entry) => (
              <div
                key={entry.warehouse_id || entry.warehouse_name}
                className="rounded-2xl border border-slate-200 bg-white/70 p-4"
              >
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
