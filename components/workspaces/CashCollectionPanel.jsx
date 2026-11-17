"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, formatCount, formatCompactCurrency } from "@/lib/format";
import PeriodSelect, { ALL_TIME, describePeriod, periodQuery } from "@/components/ui/PeriodSelect";
import SectionCard from "@/components/layout/SectionCard";
import { PeriodColumns } from "@/components/charts/LedgerCharts";
import DataTable from "@/components/tables/DataTable";

function getPaymentDate(payment) {
  return payment?.created_at || payment?.payment_date || payment?.date || null;
}

export default function AdminCashCollection() {
  const [period, setPeriod] = useState(ALL_TIME);
  const [totalAmount, setTotalAmount] = useState(null);
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
        const params = periodQuery(period);
        params.set("limit", String(pageSize));
        params.set("offset", String((page - 1) * pageSize));
        const response = await apiFetch(`${apiEndpoints.admin.accountingPayments}?${params.toString()}`);
        if (!active) return;
        const items = response?.items || response || [];
        setPayments(items);
        setTotalAmount(response?.total_amount ?? null);
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
  }, [page, pageSize, period]);

  const chartTotals = dailyTotals.map((entry) => ({
    label: entry.date,
    value: entry.amount
  }));

  const columns = useMemo(
    () => [
      {
        header: "Order",
        accessorKey: "order_id",
        cell: ({ row }) => `#${row.original.order_id}`
      },
      {
        header: "Amount",
        accessorKey: "amount",
        meta: { type: "number" },
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


  return (
    <div className="space-y-5 max-lg:px-[2px] [&_.text-sm]:text-[14px] [&_.text-xs]:text-[12px]">
      {error ? <p role="alert" className="text-sm text-rose-800">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Collections · {describePeriod(period)}</p>
        <PeriodSelect value={period} onChange={(value) => { setPeriod(value); setPage(1); }} />
      </div>
      <dl className="grid grid-cols-2 divide-x divide-line rounded-lg border border-line bg-white p-4">
        <div className="pr-4"><dt className="text-sm text-muted">Total collected</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{formatCurrency(totalAmount)}</dd></div>
        <div className="pl-4"><dt className="text-sm text-muted">Payments</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{formatCount(paymentsTotal)}</dd></div>
      </dl>

      <SectionCard title="Daily cash collection" subtitle={describePeriod(period)}>
        <PeriodColumns data={chartTotals} dataKey="value" format={formatCurrency} axisFormat={formatCompactCurrency} height={180} />
      </SectionCard>

      <SectionCard
        title="Payment log"
        subtitle={`${formatCount(paymentsTotal)} payments captured`}
        actions={
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        }
      >
        <DataTable mobileCardClassName="!rounded-lg !shadow-none [&_dt]:!text-muted [&_dt]:!normal-case [&_dt]:!tracking-normal" columns={columns} data={payments} emptyLabel={loading ? "Loading payments…" : "No payments in this period."} />
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>
            Page {page} of {Math.max(1, Math.ceil(paymentsTotal / pageSize))}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded-md border border-slate-200 px-3 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={page >= Math.ceil(paymentsTotal / pageSize)}
              className="rounded-md border border-slate-200 px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
