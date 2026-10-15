"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch } from "@/lib/api";
import StatCard from "@/components/layout/StatCard";
import FieldFeedback from "@/components/field/FieldFeedback";
import FieldHome from "@/components/field/FieldHome";
import SectionCard from "@/components/layout/SectionCard";

export default function SalesmanDashboard() {
  const [counts, setCounts] = useState({ total: 0, booked: 0, delivered: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [recent, pending, delivered] = await Promise.all([
          apiFetch(`${apiEndpoints.orders.list}?limit=3`),
          apiFetch(`${apiEndpoints.orders.list}?status=PENDING&limit=1`),
          apiFetch(`${apiEndpoints.orders.list}?status=DELIVERED&limit=1`)
        ]);
        if (!active) return;
        setCounts({ total: recent.total || 0, booked: pending.total || 0, delivered: delivered.total || 0 });
        setRecentOrders(recent.items || []);
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

  if (loading) return <FieldFeedback loading label="Loading overview…" />;
  if (error) return <FieldFeedback error={error} />;

  return (
    <>
      <FieldHome role="SALESMAN" metrics={[{ label: "Orders", value: counts.total }, { label: "Pending", value: counts.booked }, { label: "Delivered", value: counts.delivered }]} orders={recentOrders} />
      <div className="hidden space-y-6 lg:block">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <StatCard title="Total Orders" value={counts.total} subtitle="Your orders" accent="sky" />
        <StatCard title="Pending" value={counts.booked} subtitle="Awaiting warehouse" accent="amber" />
        <StatCard title="Delivered" value={counts.delivered} subtitle="Successfully delivered" accent="emerald" />
      </div>

      <SectionCard title="Quick Actions" subtitle="Create and track your orders">
        <div className="hidden flex-wrap gap-3 lg:flex">
          <Link href="/app/orders/new" className="rounded-full bg-slate-900 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white">
            Create Order
          </Link>
          <Link href="/app/orders" className="rounded-full border border-slate-200 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            View Orders
          </Link>
        </div>
        <p className="text-sm text-slate-500 lg:hidden">
          Book a new order or review the ones you have already placed.
        </p>
      </SectionCard>
      </div>
    </>
  );
}
