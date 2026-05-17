"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";
import DateRangeFilter from "@/components/ui/DateRangeFilter";

export default function DailySalesPanel({ warehouseId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (warehouseId) params.set("warehouse_id", warehouseId);
        if (dateRange.from) params.set("from_date", dateRange.from);
        if (dateRange.to) params.set("to_date", dateRange.to);
        const response = await apiFetch(`${apiEndpoints.admin.dailySales}?${params.toString()}`);
        if (!active) return;
        setData(response);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load daily sales data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [warehouseId, dateRange]);

  function toggleExpand(date) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }

  const issueEntries = useMemo(() => {
    if (!data?.issue_breakdown) return [];
    const entries = Object.entries(data.issue_breakdown);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    return entries
      .sort(([, a], [, b]) => b - a)
      .map(([reason, count]) => ({
        reason,
        count,
        pct: total > 0 ? ((count / total) * 100).toFixed(1) : "0.0",
      }));
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading daily sales…
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
      <DateRangeFilter from={dateRange.from} to={dateRange.to} onChange={setDateRange} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Dispatched"
          value={formatNumber(data?.total_orders ?? 0)}
          subtitle="Orders placed"
          accent="sky"
        />
        <StatCard
          title="Delivered"
          value={formatNumber(data?.total_delivered ?? 0)}
          subtitle="Successfully fulfilled"
          accent="emerald"
        />
        <StatCard
          title="Cancelled"
          value={formatNumber(data?.total_cancelled ?? 0)}
          subtitle="Orders lost"
          accent="rose"
        />
        <StatCard
          title="Cancel Rate"
          value={`${data?.cancel_rate?.toFixed(1) ?? "0.0"}%`}
          subtitle="Of total dispatched"
          accent="amber"
        />
      </div>

      <SectionCard title="Daily breakdown" subtitle="Click a date to expand salesman detail">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400" />
                <th className="pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Date</th>
                <th className="pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 text-right">Orders</th>
                <th className="pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 text-right">Delivered</th>
                <th className="pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 text-right">Cancelled</th>
                <th className="pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 text-right">Amount</th>
                <th className="pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 text-right">Collected</th>
                <th className="pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 text-right">Pending</th>
              </tr>
            </thead>
            <tbody>
              {(data?.days || []).map((day) => {
                const isOpen = expanded.has(day.date);
                const pending = (day.total_amount || 0) - (day.collected || 0);
                return (
                  <React.Fragment key={day.date}>
                    <tr
                      onClick={() => toggleExpand(day.date)}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="py-3 pr-2 text-slate-400">{isOpen ? "▾" : "▸"}</td>
                      <td className="py-3 font-medium text-slate-700">{day.date}</td>
                      <td className="py-3 text-right text-slate-700">{day.total_orders}</td>
                      <td className="py-3 text-right text-emerald-600">{day.delivered}</td>
                      <td className="py-3 text-right text-rose-600">{day.cancelled}</td>
                      <td className="py-3 text-right text-slate-700">{formatCurrency(day.total_amount)}</td>
                      <td className="py-3 text-right text-emerald-600">{formatCurrency(day.collected)}</td>
                      <td className="py-3 text-right text-amber-600">{formatCurrency(pending)}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={8} className="px-2 pb-3">
                          <div className="bg-slate-50/50 rounded-2xl border border-slate-200 p-4 my-2">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr>
                                  <th className="pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Salesman</th>
                                  <th className="pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 text-right">Orders</th>
                                  <th className="pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 text-right">Delivered</th>
                                  <th className="pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 text-right">Cancelled</th>
                                  <th className="pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 text-right">Amount</th>
                                  <th className="pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 text-right">Cancel %</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(day.by_salesman || []).map((sm) => {
                                  const cancelPct = sm.orders > 0 ? ((sm.cancelled / sm.orders) * 100) : 0;
                                  return (
                                    <tr key={sm.salesman_id} className="border-b border-slate-100 last:border-b-0">
                                      <td className="py-2 text-slate-700">{sm.salesman_name}</td>
                                      <td className="py-2 text-right text-slate-700">{sm.orders}</td>
                                      <td className="py-2 text-right text-emerald-600">{sm.delivered}</td>
                                      <td className="py-2 text-right text-rose-600">{sm.cancelled}</td>
                                      <td className="py-2 text-right text-slate-700">{formatCurrency(sm.amount)}</td>
                                      <td className={`py-2 text-right font-medium ${cancelPct > 20 ? "text-rose-600" : "text-slate-700"}`}>
                                        {cancelPct.toFixed(1)}%
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {(!data?.days || data.days.length === 0) && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-slate-400">
                    No daily sales data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {issueEntries.length > 0 && (
        <SectionCard title="Issue analysis" subtitle="Cancellation reasons breakdown">
          <div className="flex flex-wrap gap-2">
            {issueEntries.map(({ reason, count, pct }) => (
              <span
                key={reason}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
              >
                <span className="font-medium">{reason.replace(/_/g, " ")}</span>
                <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                  {count}
                </span>
                <span className="text-slate-400">{pct}%</span>
              </span>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
