"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch } from "@/lib/api";
import FieldFeedback from "@/components/field/FieldFeedback";
import FieldHome from "@/components/field/FieldHome";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";
import DateRangeFilter from "@/components/ui/DateRangeFilter";

export default function WarehouseDashboard() {
  const [pendingTotal, setPendingTotal] = useState(0);
  const [inTransitTotal, setInTransitTotal] = useState(0);
  const [readyTotal, setReadyTotal] = useState(0);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (dateRange.from) params.set("from_date", dateRange.from);
        if (dateRange.to) params.set("to_date", dateRange.to);
        const url = params.toString()
          ? `${apiEndpoints.admin.orderStatusSummary}?${params.toString()}`
          : apiEndpoints.admin.orderStatusSummary;
        const [summary, recent] = await Promise.all([
          apiFetch(url),
          apiFetch(`${apiEndpoints.orders.list}?${params.toString()}&limit=3`)
        ]);
        if (!active) return;
        setPendingTotal(summary?.PENDING || 0);
        setReadyTotal(summary?.READY_TO_SHIP || 0);
        setRecentOrders(recent.items || []);
        setInTransitTotal(summary?.OUT_FOR_DELIVERY || 0);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load warehouse overview.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [dateRange]);

  if (loading) {
    return <FieldFeedback loading label="Loading warehouse overview…" />;
  }

  if (error) {
    return <FieldFeedback error={error} />;
  }

  return (
    <>
      <FieldHome role="WAREHOUSE_MANAGER" metrics={[{ label: "Pending", value: pendingTotal }, { label: "Ready", value: readyTotal }, { label: "In transit", value: inTransitTotal }]} orders={recentOrders} />
      <div className="hidden space-y-6 lg:block">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {dateRange.from || dateRange.to ? "Filtered range" : "All time"}
        </p>
        <DateRangeFilter from={dateRange.from} to={dateRange.to} onChange={setDateRange} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard title="Pending Orders" value={pendingTotal} subtitle="Ready to allocate stock" accent="amber" />
        <StatCard title="In Transit" value={inTransitTotal} subtitle="Drivers in transit" accent="sky" />
      </div>

      <SectionCard title="Dispatch Pipeline" subtitle="Assign drivers and update order status">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/app/orders"
            className="rounded-full bg-slate-900 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white"
          >
            Manage Orders
          </Link>
          <Link
            href="/app/operations?tab=drivers"
            className="rounded-full border border-slate-200 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500"
          >
            View Drivers
          </Link>
        </div>
      </SectionCard>
      </div>
    </>
  );
}
