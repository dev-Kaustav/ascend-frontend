"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";
import LineChartCard from "@/components/charts/LineChartCard";
import BarChartCard from "@/components/charts/BarChartCard";
import PieChartCard from "@/components/charts/PieChartCard";

function getOrderTotal(order) {
  if (!order?.items?.length) return null;
  return order.items.reduce((sum, item) => {
    const base = (item.quantity || 0) * (item.unit_price || 0) - (item.discount_amount || 0);
    const taxes = (item.taxes || []).reduce((taxSum, tax) => {
      return taxSum + base * ((tax.rate || 0) / 100);
    }, 0);
    return sum + base + taxes;
  }, 0);
}

function getOrderDate(order) {
  return order?.created_at || order?.order_date || order?.date || null;
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [ordersResponse, inventoryResponse, warehouseResponse] = await Promise.all([
          apiFetch(apiEndpoints.admin.orders),
          apiFetch(apiEndpoints.admin.inventory),
          apiFetch(apiEndpoints.admin.warehouses)
        ]);
        if (!active) return;
        setOrders(ordersResponse || []);
        setInventory(inventoryResponse || []);
        setWarehouses(warehouseResponse || []);
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

  const warehouseMap = useMemo(() => {
    const map = new Map();
    warehouses.forEach((warehouse) => {
      map.set(warehouse.id, warehouse.name);
    });
    return map;
  }, [warehouses]);

  const metrics = useMemo(() => {
    const incoming = orders.filter((order) => String(order.order_type).toUpperCase() === "INCOMING");
    const outgoing = orders.filter((order) => String(order.order_type).toUpperCase() === "OUTGOING");
    const revenue = outgoing.reduce((sum, order) => sum + (getOrderTotal(order) || 0), 0);
    const outstanding = outgoing.reduce((sum, order) => {
      if (String(order.payment_status).toUpperCase() === "PAID") return sum;
      return sum + (getOrderTotal(order) || 0);
    }, 0);

    const valueCandidates = inventory
      .map((item) => {
        const unitCost = item.unit_cost ?? item.unit_price ?? item.cost ?? null;
        if (unitCost === null || unitCost === undefined) return null;
        return unitCost * (item.total_quantity || 0);
      })
      .filter((value) => value !== null);
    const inventoryValue = valueCandidates.length > 0 ? valueCandidates.reduce((sum, val) => sum + val, 0) : null;

    const quantities = inventory.map((item) => item.total_quantity || 0);
    const maxQty = quantities.length ? Math.max(...quantities) : 0;
    const lowStockThreshold = Math.max(10, Math.round(maxQty * 0.1));
    const lowStock = inventory.filter((item) => (item.total_quantity || 0) <= lowStockThreshold);

    return {
      incomingCount: incoming.length,
      outgoingCount: outgoing.length,
      totalOrders: orders.length,
      revenue,
      outstanding,
      inventoryValue,
      lowStockCount: lowStock.length,
      lowStockThreshold
    };
  }, [orders, inventory]);

  const ordersTimeline = useMemo(() => {
    const grouped = new Map();
    orders.forEach((order) => {
      const date = getOrderDate(order);
      if (!date) return;
      const label = new Date(date).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      const current = grouped.get(label) || { label, incoming: 0, outgoing: 0 };
      const type = String(order.order_type).toUpperCase();
      if (type === "INCOMING") current.incoming += 1;
      if (type === "OUTGOING") current.outgoing += 1;
      grouped.set(label, current);
    });
    return Array.from(grouped.values());
  }, [orders]);

  const salesByWarehouse = useMemo(() => {
    const grouped = new Map();
    orders.forEach((order) => {
      const warehouse =
        order.warehouse_name || warehouseMap.get(order.warehouse_id) || order.warehouse_id || "Unassigned";
      const label = typeof warehouse === "string" ? warehouse : `WH-${warehouse}`;
      const current = grouped.get(label) || { label, orders: 0 };
      current.orders += 1;
      grouped.set(label, current);
    });
    return Array.from(grouped.values());
  }, [orders, warehouseMap]);

  const paymentStatusData = useMemo(() => {
    const counts = {
      PAID: 0,
      PARTIAL: 0,
      UNPAID: 0
    };
    orders.forEach((order) => {
      const status = String(order.payment_status || "UNPAID").toUpperCase();
      if (counts[status] !== undefined) counts[status] += 1;
    });
    return [
      { label: "Paid", value: counts.PAID, color: "#34d399" },
      { label: "Partial", value: counts.PARTIAL, color: "#f59e0b" },
      { label: "Unpaid", value: counts.UNPAID, color: "#f97316" }
    ];
  }, [orders]);

  const inventoryByWarehouse = useMemo(() => {
    const grouped = new Map();
    inventory.forEach((item) => {
      const warehouse =
        item.warehouse_name || warehouseMap.get(item.warehouse_id) || item.warehouse_id || "Unassigned";
      const label = typeof warehouse === "string" ? warehouse : `WH-${warehouse}`;
      const current = grouped.get(label) || { label, units: 0 };
      current.units += item.total_quantity || 0;
      grouped.set(label, current);
    });
    return Array.from(grouped.values());
  }, [inventory, warehouseMap]);

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
          subtitle={`Incoming ${metrics.incomingCount} / Outgoing ${metrics.outgoingCount}`}
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
          subtitle="Incoming vs outgoing"
          data={ordersTimeline}
          lines={[
            { dataKey: "incoming", name: "Incoming", color: "#0ea5e9" },
            { dataKey: "outgoing", name: "Outgoing", color: "#22c55e" }
          ]}
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
              <div key={entry.label} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">{entry.label}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{formatNumber(entry.units)} units</p>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
