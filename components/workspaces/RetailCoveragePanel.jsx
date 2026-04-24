"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch, apiFetchCached } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";
import LineChartCard from "@/components/charts/LineChartCard";
import BarChartCard from "@/components/charts/BarChartCard";
import DataTable from "@/components/tables/DataTable";

const COVERAGE_WINDOWS = [
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
  { label: "180 days", value: 180 }
];

function getOrderDate(order) {
  return order?.created_at || order?.order_date || order?.date || null;
}

function getOrderTotal(order) {
  if (!order) return 0;
  if (typeof order.total_amount === "number") return order.total_amount;
  if (order.total_amount !== undefined && order.total_amount !== null) {
    const parsed = Number(order.total_amount);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (!order?.items?.length) return 0;
  const total = order.items.reduce((sum, item) => {
    const base = (item.quantity || 0) * (item.unit_price || 0) - (item.discount_amount || 0);
    return sum + base;
  }, 0);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export default function AdminRetailCoverage() {
  const [orders, setOrders] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [windowDays, setWindowDays] = useState(COVERAGE_WINDOWS[0].value);
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
        setRetailers(lookupsResponse?.retailers || []);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load retailer coverage data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const outgoingOrders = useMemo(() => {
    return orders;
  }, [orders]);

  const retailerMap = useMemo(() => {
    const map = new Map();
    retailers.forEach((retailer) => {
      map.set(retailer.id, retailer.name);
    });
    return map;
  }, [retailers]);

  const coverageStats = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowDays);
    const billedRetailerIds = new Set();
    outgoingOrders.forEach((order) => {
      const orderDate = getOrderDate(order);
      if (!orderDate) return;
      if (new Date(orderDate) < cutoff) return;
      if (order.to_entity_id) billedRetailerIds.add(order.to_entity_id);
    });
    const billedRetailers = billedRetailerIds.size;
    const totalRetailers = retailers.length;
    const coverage = totalRetailers ? Math.round((billedRetailers / totalRetailers) * 100) : 0;
    return { billedRetailers, totalRetailers, coverage };
  }, [outgoingOrders, retailers.length, windowDays]);

  const monthlyCoverage = useMemo(() => {
    const points = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
      const retailerIds = new Set();
      outgoingOrders.forEach((order) => {
        const orderDate = getOrderDate(order);
        if (!orderDate) return;
        const date = new Date(orderDate);
        if (date >= monthDate && date < nextMonth && order.to_entity_id) {
          retailerIds.add(order.to_entity_id);
        }
      });
      points.push({
        label: monthDate.toLocaleDateString("en-IN", { month: "short" }),
        value: retailerIds.size
      });
    }
    return points;
  }, [outgoingOrders]);

  const retailerRows = useMemo(() => {
    const map = new Map();
    outgoingOrders.forEach((order) => {
      const retailerId = order.to_entity_id;
      if (!retailerId) return;
      const entry =
        map.get(retailerId) || {
          id: retailerId,
          name: retailerMap.get(retailerId) || `Retailer ${retailerId}`,
          orders: 0,
          total: 0,
          lastBilled: null
        };
      entry.orders += 1;
      entry.total += getOrderTotal(order);
      const orderDate = getOrderDate(order);
      if (orderDate && (!entry.lastBilled || new Date(orderDate) > new Date(entry.lastBilled))) {
        entry.lastBilled = orderDate;
      }
      map.set(retailerId, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [outgoingOrders, retailerMap]);

  const topRetailers = useMemo(() => {
    return retailerRows.slice(0, 8).map((row) => ({
      label: row.name.length > 16 ? `${row.name.slice(0, 16)}...` : row.name,
      value: row.total
    }));
  }, [retailerRows]);

  const columns = useMemo(
    () => [
      {
        header: "Retailer",
        accessorKey: "name",
        cell: ({ row }) => row.original.name
      },
      {
        header: "Orders",
        accessorKey: "orders",
        cell: ({ row }) => formatNumber(row.original.orders)
      },
      {
        header: "Total Billed",
        accessorKey: "total",
        cell: ({ row }) => formatCurrency(row.original.total)
      },
      {
        header: "Last Billed",
        accessorKey: "lastBilled",
        cell: ({ row }) => formatDate(row.original.lastBilled)
      }
    ],
    []
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading retail coverage…
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
      <SectionCard
        title="Retail Coverage"
        subtitle="Track billed retailers and coverage momentum."
        actions={
          <select
            value={windowDays}
            onChange={(event) => setWindowDays(Number(event.target.value))}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
          >
            {COVERAGE_WINDOWS.map((window) => (
              <option key={window.value} value={window.value}>
                {window.label}
              </option>
            ))}
          </select>
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <StatCard
            title="Billed Retailers"
            value={formatNumber(coverageStats.billedRetailers)}
            subtitle={`Within last ${windowDays} days`}
            accent="emerald"
          />
          <StatCard
            title="Total Retailers"
            value={formatNumber(coverageStats.totalRetailers)}
            subtitle="Onboarded in system"
            accent="sky"
          />
          <StatCard
            title="Coverage"
            value={formatPercent(coverageStats.coverage)}
            subtitle="Billed / total"
            accent="amber"
          />
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <LineChartCard
          title="Monthly billed retailers"
          subtitle="Unique retailers with invoices"
          data={monthlyCoverage}
          lines={[{ dataKey: "value", name: "Retailers", color: "#0ea5e9" }]}
        />
        <BarChartCard
          title="Top billed retailers"
          subtitle="Highest billed value"
          data={topRetailers}
          bars={[{ dataKey: "value", name: "Billed", color: "#14b8a6" }]}
        />
      </div>

      <SectionCard title="Retailer billing table" subtitle={`${retailerRows.length} retailers with invoices`}>
        <DataTable columns={columns} data={retailerRows} emptyLabel="No retailer billing records yet." />
      </SectionCard>
    </div>
  );
}
