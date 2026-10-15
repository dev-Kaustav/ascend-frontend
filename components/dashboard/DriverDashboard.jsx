"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch } from "@/lib/api";
import StatCard from "@/components/layout/StatCard";
import FieldFeedback from "@/components/field/FieldFeedback";
import FieldHome from "@/components/field/FieldHome";
import SectionCard from "@/components/layout/SectionCard";

export default function DriverDashboard() {
  const [counts, setCounts] = useState({ readyToShip: 0, inTransit: 0, delivered: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [recent, pickup, transit, delivered] = await Promise.all([
          apiFetch(`${apiEndpoints.orders.list}?limit=3`),
          apiFetch(`${apiEndpoints.orders.list}?status=READY_TO_SHIP&limit=1`),
          apiFetch(`${apiEndpoints.orders.list}?status=OUT_FOR_DELIVERY&limit=1`),
          apiFetch(`${apiEndpoints.orders.list}?status=DELIVERED&limit=1`)
        ]);
        if (!active) return;
        setCounts({ readyToShip: pickup.total || 0, inTransit: transit.total || 0, delivered: delivered.total || 0 });
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
      <FieldHome role="DRIVER" metrics={[{ label: "To pick up", value: counts.readyToShip }, { label: "In transit", value: counts.inTransit }, { label: "Delivered", value: counts.delivered }]} orders={recentOrders} />
      <div className="hidden space-y-6 lg:block">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <StatCard title="Ready to Pick Up" value={counts.readyToShip} subtitle="Waiting at warehouse" accent="amber" />
        <StatCard title="In Transit" value={counts.inTransit} subtitle="Currently delivering" accent="sky" />
        <StatCard title="Delivered" value={counts.delivered} subtitle="Completed deliveries" accent="emerald" />
      </div>

      <SectionCard title="Your Deliveries" subtitle="Pick up and deliver assigned orders">
        <Link href="/app/orders" className="hidden rounded-full bg-slate-900 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white lg:inline-block">
          View My Orders
        </Link>
        <p className="text-sm text-slate-500 lg:hidden">
          Your assigned pickups and deliveries for today.
        </p>
      </SectionCard>
      </div>
    </>
  );
}
