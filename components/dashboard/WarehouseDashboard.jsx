"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetchCached } from "@/lib/api";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";

export default function WarehouseDashboard() {
  const [pendingTotal, setPendingTotal] = useState(0);
  const [outForDeliveryTotal, setOutForDeliveryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const summary = await apiFetchCached(apiEndpoints.admin.orderStatusSummary, { ttl: 60000 });
        if (!active) return;
        setPendingTotal(summary?.PENDING || 0);
        setOutForDeliveryTotal(summary?.OUT_FOR_DELIVERY || 0);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load warehouse overview.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading warehouse overview…
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
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard title="Pending Orders" value={pendingTotal} subtitle="Ready to allocate stock" accent="amber" />
        <StatCard title="Out for Delivery" value={outForDeliveryTotal} subtitle="Drivers in transit" accent="sky" />
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
  );
}
