"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetchCached } from "@/lib/api";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";

export default function AccountantDashboard() {
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
        setError(err?.message || "Unable to load accountant overview.");
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
        Loading accountant overview…
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
        <StatCard title="Pending Orders" value={pendingTotal} subtitle="Awaiting warehouse processing" accent="amber" />
        <StatCard title="Out for Delivery" value={outForDeliveryTotal} subtitle="Assigned to drivers" accent="sky" />
      </div>

      <SectionCard title="Punch Orders" subtitle="Record orders submitted by salesmen">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/app/orders/new"
            className="rounded-full bg-slate-900 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white"
          >
            Create Order
          </Link>
          <Link
            href="/app/orders"
            className="rounded-full border border-slate-200 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500"
          >
            View Orders
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
