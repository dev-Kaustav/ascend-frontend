"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch } from "@/lib/api";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";

export default function SalesmanDashboard() {
  const [counts, setCounts] = useState({ total: 0, booked: 0, delivered: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const resp = await apiFetch(apiEndpoints.orders.list);
        if (!active) return;
        const items = resp?.items || [];
        const total = resp?.total || items.length;
        const booked = items.filter((o) => o.status === "PENDING").length;
        const delivered = items.filter((o) => o.status === "DELIVERED").length;
        setCounts({ total, booked, delivered });
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load overview.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">Loading overview…</div>;
  if (error) return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Orders" value={counts.total} subtitle="Your orders" accent="sky" />
        <StatCard title="Pending" value={counts.booked} subtitle="Awaiting warehouse" accent="amber" />
        <StatCard title="Delivered" value={counts.delivered} subtitle="Successfully delivered" accent="emerald" />
      </div>
      <SectionCard title="Quick Actions" subtitle="Create and track your orders">
        <div className="flex flex-wrap gap-3">
          <Link href="/app/orders/new" className="rounded-full bg-slate-900 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white">
            Create Order
          </Link>
          <Link href="/app/orders" className="rounded-full border border-slate-200 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            View Orders
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
