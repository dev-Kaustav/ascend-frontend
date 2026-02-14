"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";
import LineChartCard from "@/components/charts/LineChartCard";
import BarChartCard from "@/components/charts/BarChartCard";

export default function BrandDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetch(apiEndpoints.brand.dashboard);
        if (!active) return;
        setData(response || {});
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load brand dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const totalSecondarySales = data?.total_secondary_sales ?? data?.total_sales ?? null;
  const skuMovement = data?.sku_movement || data?.top_skus || [];
  const warehousePerformance = data?.warehouse_performance || data?.distributor_performance || [];
  const salesOverTime = data?.sales_over_time || data?.sales_timeline || [];
  const salesByLocation = data?.sales_by_location || [];

  const topSkuData = useMemo(() => {
    return skuMovement.map((sku) => ({
      label: sku.sku_name || sku.label || `SKU ${sku.sku_id || ""}`,
      quantity: sku.quantity || sku.units || sku.value || 0
    }));
  }, [skuMovement]);

  const salesTimeline = useMemo(() => {
    return salesOverTime.map((point) => ({
      label: point.label || point.date || point.period || "—",
      value: point.value || point.sales || point.amount || 0
    }));
  }, [salesOverTime]);

  const performanceData = useMemo(() => {
    return warehousePerformance.map((entry) => ({
      label: entry.warehouse_name || entry.distributor || entry.label || "Location",
      value: entry.performance || entry.sales || entry.value || 0
    }));
  }, [warehousePerformance]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading brand dashboard…
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
      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard
          title="Total Secondary Sales"
          value={totalSecondarySales !== null ? formatCurrency(totalSecondarySales) : "—"}
          subtitle="Retailer sell-out"
          accent="emerald"
        />
        <StatCard
          title="SKU Movement"
          value={formatNumber(skuMovement.length)}
          subtitle="SKUs tracked"
          accent="sky"
        />
        <StatCard
          title="Distributor Performance"
          value={formatNumber(warehousePerformance.length)}
          subtitle="Active locations"
          accent="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LineChartCard
          title="Sales over time"
          subtitle="Secondary sales trend"
          data={salesTimeline}
          lines={[{ dataKey: "value", name: "Sales", color: "#14b8a6" }]}
        />
        <BarChartCard
          title="Top SKUs"
          subtitle="Highest movement"
          data={topSkuData}
          bars={[{ dataKey: "quantity", name: "Units", color: "#38bdf8" }]}
        />
      </div>

      <SectionCard title="Sales by location" subtitle="Heatmap snapshot">
        {salesByLocation.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {salesByLocation.map((entry) => (
              <div key={entry.location || entry.label} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">{entry.location || entry.label}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(entry.value || entry.sales)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
            No location heatmap data available.
          </div>
        )}
      </SectionCard>

      <SectionCard title="Warehouse / distributor performance" subtitle="Read-only summary">
        {performanceData.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {performanceData.map((entry) => (
              <div key={entry.label} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">{entry.label}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(entry.value)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
            No distributor performance data available.
          </div>
        )}
      </SectionCard>
    </div>
  );
}
