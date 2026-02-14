"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch, apiFetchCached } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";
import BarChartCard from "@/components/charts/BarChartCard";
import DataTable from "@/components/tables/DataTable";

function getOrderTotal(order) {
  if (!order) return 0;
  if (typeof order.total_amount === "number") return order.total_amount;
  if (order.total_amount !== undefined && order.total_amount !== null) {
    const parsed = Number(order.total_amount);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (!order?.items?.length) return 0;
  return order.items.reduce((sum, item) => {
    const base = (item.quantity || 0) * (item.unit_price || 0) - (item.discount_amount || 0);
    const taxes = (item.taxes || []).reduce((taxSum, tax) => taxSum + base * ((tax.rate || 0) / 100), 0);
    return sum + base + taxes;
  }, 0);
}

export default function AdminSalesmen() {
  const [orders, setOrders] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const lookupsPromise = apiFetchCached(apiEndpoints.admin.lookups);
        const limit = 200;
        let offset = 0;
        let combined = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const resp = await apiFetch(`${apiEndpoints.admin.orders}?limit=${limit}&offset=${offset}`);
          const items = resp?.items || [];
          combined = combined.concat(items);
          offset += limit;
          if (!resp?.total || combined.length >= resp.total || items.length < limit) break;
        }
        const lookupsResponse = await lookupsPromise;
        if (!active) return;
        setOrders(combined);
        setSalesmen(lookupsResponse?.salesmen || []);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load salesman analytics.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const salesmenMap = useMemo(() => {
    const map = new Map();
    salesmen.forEach((salesman) => {
      map.set(salesman.id, salesman.name);
    });
    return map;
  }, [salesmen]);

  const stats = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      const salesmanId = order.salesman_id || 0;
      const name = salesmenMap.get(salesmanId) || (salesmanId ? `Salesman ${salesmanId}` : "Unassigned");
      const entry =
        map.get(salesmanId) || {
          id: salesmanId,
          name,
          orders: 0,
          delivered: 0,
          total: 0,
          outstanding: 0,
          retailers: new Set()
        };
      entry.orders += 1;
      if (String(order.status).toUpperCase() === "DELIVERED") {
        entry.delivered += 1;
      }
      const total = getOrderTotal(order);
      entry.total += total;
      if (String(order.payment_status || "UNPAID").toUpperCase() !== "PAID") {
        entry.outstanding += total;
      }
      if (order.to_entity_id) {
        entry.retailers.add(order.to_entity_id);
      }
      map.set(salesmanId, entry);
    });

    return Array.from(map.values()).map((entry) => ({
      ...entry,
      retailerCount: entry.retailers.size
    }));
  }, [orders, salesmenMap]);

  const chartData = useMemo(() => {
    return stats
      .slice()
      .sort((a, b) => b.total - a.total)
      .map((entry) => ({
        label: entry.name.length > 14 ? `${entry.name.slice(0, 14)}...` : entry.name,
        value: entry.total
      }));
  }, [stats]);

  const totals = useMemo(() => {
    const totalOrders = stats.reduce((sum, entry) => sum + entry.orders, 0);
    const totalSales = stats.reduce((sum, entry) => sum + entry.total, 0);
    const totalOutstanding = stats.reduce((sum, entry) => sum + entry.outstanding, 0);
    return { totalOrders, totalSales, totalOutstanding };
  }, [stats]);

  const columns = useMemo(
    () => [
      {
        header: "Salesman",
        accessorKey: "name",
        cell: ({ row }) => row.original.name
      },
      {
        header: "Orders",
        accessorKey: "orders",
        cell: ({ row }) => formatNumber(row.original.orders)
      },
      {
        header: "Retailers",
        accessorKey: "retailerCount",
        cell: ({ row }) => formatNumber(row.original.retailerCount)
      },
      {
        header: "Delivered",
        accessorKey: "delivered",
        cell: ({ row }) => formatNumber(row.original.delivered)
      },
      {
        header: "Sales",
        accessorKey: "total",
        cell: ({ row }) => formatCurrency(row.original.total)
      },
      {
        header: "Outstanding",
        accessorKey: "outstanding",
        cell: ({ row }) => formatCurrency(row.original.outstanding)
      }
    ],
    []
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading salesman analytics…
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
          title="Orders"
          value={formatNumber(totals.totalOrders)}
          subtitle="All outgoing orders"
          accent="sky"
        />
        <StatCard
          title="Sales Value"
          value={formatCurrency(totals.totalSales)}
          subtitle="Billed value"
          accent="emerald"
        />
        <StatCard
          title="Outstanding"
          value={formatCurrency(totals.totalOutstanding)}
          subtitle="Unpaid + partial"
          accent="amber"
        />
      </div>

      <BarChartCard
        title="Sales by salesman"
        subtitle="Total billed value"
        data={chartData}
        bars={[{ dataKey: "value", name: "Sales", color: "#38bdf8" }]}
      />

      <SectionCard title="Salesman performance" subtitle={`${formatNumber(stats.length)} salesmen`}>
        <DataTable columns={columns} data={stats} emptyLabel="No salesman performance data available." />
      </SectionCard>
    </div>
  );
}
