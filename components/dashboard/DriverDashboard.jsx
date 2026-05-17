"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch } from "@/lib/api";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";

export default function DriverDashboard() {
  const [counts, setCounts] = useState({ readyToShip: 0, inTransit: 0, delivered: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const resp = await apiFetch(apiEndpoints.orders.list);
        if (!active) return;
        const items = resp?.items || [];
        const readyToShip = items.filter((o) => o.status === "READY_TO_SHIP").length;
        const inTransit = items.filter((o) => o.status === "OUT_FOR_DELIVERY").length;
        const delivered = items.filter((o) => o.status === "DELIVERED").length;
        setCounts({ readyToShip, inTransit, delivered });
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
        <StatCard title="Ready to Pick Up" value={counts.readyToShip} subtitle="Waiting at warehouse" accent="amber" />
        <StatCard title="In Transit" value={counts.inTransit} subtitle="Currently delivering" accent="sky" />
        <StatCard title="Delivered Today" value={counts.delivered} subtitle="Completed deliveries" accent="emerald" />
      </div>
      <SectionCard title="Your Deliveries" subtitle="Pick up and deliver assigned orders">
        <Link href="/app/orders" className="inline-block rounded-full bg-slate-900 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white">
          View My Orders
        </Link>
      </SectionCard>
    </div>
  );
}
