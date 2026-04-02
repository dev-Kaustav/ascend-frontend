"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";
import LineChartCard from "@/components/charts/LineChartCard";
import DataTable from "@/components/tables/DataTable";

function getPaymentDate(payment) {
  return payment?.created_at || payment?.payment_date || payment?.date || null;
}

export default function AdminCashCollection() {
  const [payments, setPayments] = useState([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [dailyTotals, setDailyTotals] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(pageSize));
        params.set("offset", String((page - 1) * pageSize));
        const response = await apiFetch(`${apiEndpoints.admin.accountingPayments}?${params.toString()}`);
        if (!active) return;
        const items = response?.items || response || [];
        setPayments(items);
        setPaymentsTotal(response?.total ?? items.length);
        setDailyTotals(response?.daily_totals || []);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load cash collection data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [page, pageSize]);

  const stats = useMemo(() => {
    const today = new Date();
    const last7 = new Date();
    last7.setDate(today.getDate() - 7);
    const last30 = new Date();
    last30.setDate(today.getDate() - 30);
    let collectedToday = 0;
    let collected7 = 0;
    let collected30 = 0;

    if (dailyTotals.length) {
      dailyTotals.forEach((entry) => {
        const date = new Date(entry.date);
        if (Number.isNaN(date.getTime())) return;
        if (date.toDateString() === today.toDateString()) {
          collectedToday += entry.amount || 0;
        }
        if (date >= last7) {
          collected7 += entry.amount || 0;
        }
        if (date >= last30) {
          collected30 += entry.amount || 0;
        }
      });
    } else {
      payments.forEach((payment) => {
        const dateValue = getPaymentDate(payment);
        if (!dateValue) return;
        const date = new Date(dateValue);
        if (date.toDateString() === today.toDateString()) {
          collectedToday += payment.amount || 0;
        }
        if (date >= last7) {
          collected7 += payment.amount || 0;
        }
        if (date >= last30) {
          collected30 += payment.amount || 0;
        }
      });
    }
    return { collectedToday, collected7, collected30 };
  }, [payments, dailyTotals]);

  const chartTotals = useMemo(() => {
    if (dailyTotals.length) {
      return dailyTotals.map((entry) => ({
        label: new Date(entry.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        value: entry.amount || 0
      }));
    }
    const grouped = new Map();
    payments.forEach((payment) => {
      const dateValue = getPaymentDate(payment);
      if (!dateValue) return;
      const label = new Date(dateValue).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      const current = grouped.get(label) || { label, value: 0 };
      current.value += payment.amount || 0;
      grouped.set(label, current);
    });
    return Array.from(grouped.values());
  }, [payments, dailyTotals]);

  const columns = useMemo(
    () => [
      {
        header: "Order ID",
        accessorKey: "order_id",
        cell: ({ row }) => `#${row.original.order_id}`
      },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => formatCurrency(row.original.amount)
      },
      {
        header: "Reference",
        accessorKey: "transaction_reference",
        cell: ({ row }) => row.original.transaction_reference || "—"
      },
      {
        header: "Date",
        accessorKey: "created_at",
        cell: ({ row }) => formatDate(getPaymentDate(row.original))
      }
    ],
    []
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading cash collection…
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
          title="Collected Today"
          value={formatCurrency(stats.collectedToday)}
          subtitle="Same-day receipts"
          accent="emerald"
        />
        <StatCard
          title="Last 7 Days"
          value={formatCurrency(stats.collected7)}
          subtitle="Weekly cash flow"
          accent="sky"
        />
        <StatCard
          title="Last 30 Days"
          value={formatCurrency(stats.collected30)}
          subtitle="Monthly receipts"
          accent="amber"
        />
      </div>

      <LineChartCard
        title="Daily cash collection"
        subtitle="Payments captured per day"
        data={chartTotals}
        lines={[{ dataKey: "value", name: "Collected", color: "#22c55e" }]}
      />

      <SectionCard
        title="Payment log"
        subtitle={`${formatNumber(paymentsTotal)} payments captured`}
        actions={
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        }
      >
        <DataTable columns={columns} data={payments} emptyLabel="No payment records yet." />
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>
            Page {page} of {Math.max(1, Math.ceil(paymentsTotal / pageSize))}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={page >= Math.ceil(paymentsTotal / pageSize)}
              className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
