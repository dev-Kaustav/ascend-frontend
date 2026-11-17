"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch } from "@/lib/api";
import PeriodSelect, { ALL_TIME, describePeriod } from "@/components/ui/PeriodSelect";
import { formatCurrency, formatDate, formatCount } from "@/lib/format";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import LineChartCard from "@/components/charts/LineChartCard";
import BarChartCard from "@/components/charts/BarChartCard";
import InvoiceCell from "@/components/ui/InvoiceCell";

// Every figure here comes from the server (app/services/metrics.py): what shops owe is the same
// number the dashboard and Retailers › Outstanding show; this screen adds nothing up.

export default function AdminAccounting({ warehouseId }) {
  const [owed, setOwed] = useState(null);
  const [cancelled, setCancelled] = useState(null);
  const [payments, setPayments] = useState([]);
  const [credits, setCredits] = useState([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsTotalAmount, setPaymentsTotalAmount] = useState(null);
  const [paymentsDailyTotals, setPaymentsDailyTotals] = useState([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPageSize, setPaymentsPageSize] = useState(20);
  const [creditsTotal, setCreditsTotal] = useState(0);
  const [creditsTotalAmount, setCreditsTotalAmount] = useState(null);
  const [creditsPage, setCreditsPage] = useState(1);
  const [creditsPageSize, setCreditsPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentsError, setPaymentsError] = useState("");
  const [creditsError, setCreditsError] = useState("");
  const [paymentsDateRange, setPaymentsDateRange] = useState(ALL_TIME);
  const [creditsDateRange, setCreditsDateRange] = useState(ALL_TIME);

  useEffect(() => {
    let active = true;
    async function loadOwed() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (warehouseId) params.set("warehouse_id", String(warehouseId));
        const [summary, onCancelled] = await Promise.all([
          apiFetch(`${apiEndpoints.admin.outstandingSummary}?${params.toString()}`),
          apiFetch(apiEndpoints.admin.cancelledMoney)
        ]);
        if (!active) return;
        setOwed(summary);
        setCancelled(onCancelled);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load accounting data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadOwed();
    return () => {
      active = false;
    };
  }, [warehouseId]);

  useEffect(() => {
    let active = true;
    async function loadPayments() {
      setPaymentsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(paymentsPageSize));
        params.set("offset", String((paymentsPage - 1) * paymentsPageSize));
        if (paymentsDateRange.from) params.set("from_date", paymentsDateRange.from);
        if (paymentsDateRange.to) params.set("to_date", paymentsDateRange.to);
        const response = await apiFetch(`${apiEndpoints.admin.accountingPayments}?${params.toString()}`);
        if (!active) return;
        const items = response?.items || response || [];
        setPayments(items);
        setPaymentsTotal(response?.total ?? items.length);
        setPaymentsTotalAmount(response?.total_amount ?? null);
        setPaymentsDailyTotals(response?.daily_totals || []);
        setPaymentsError("");
      } catch (err) {
        if (!active) return;
        setPaymentsError(err?.message || "Unable to load payments.");
      } finally {
        if (active) setPaymentsLoading(false);
      }
    }
    loadPayments();
    return () => {
      active = false;
    };
  }, [paymentsPage, paymentsPageSize, paymentsDateRange]);

  useEffect(() => {
    let active = true;
    async function loadCredits() {
      setCreditsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(creditsPageSize));
        params.set("offset", String((creditsPage - 1) * creditsPageSize));
        if (creditsDateRange.from) params.set("from_date", creditsDateRange.from);
        if (creditsDateRange.to) params.set("to_date", creditsDateRange.to);
        const response = await apiFetch(`${apiEndpoints.admin.accountingCredits}?${params.toString()}`);
        if (!active) return;
        const items = response?.items || response || [];
        setCredits(items);
        setCreditsTotal(response?.total ?? items.length);
        setCreditsTotalAmount(response?.total_amount ?? null);
        setCreditsError("");
      } catch (err) {
        if (!active) return;
        setCreditsError(err?.message || "Unable to load credit notes.");
      } finally {
        if (active) setCreditsLoading(false);
      }
    }
    loadCredits();
    return () => {
      active = false;
    };
  }, [creditsPage, creditsPageSize, creditsDateRange]);

  const paymentsOverTime = useMemo(
    () =>
      paymentsDailyTotals.map((entry) => ({
        label: new Date(entry.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        amount: entry.amount || 0
      })),
    [paymentsDailyTotals]
  );

  const outstandingByRetailer = useMemo(
    () => (owed?.by_retailer || []).map((row) => ({ label: row.retailer_name, amount: row.pending })),
    [owed]
  );

  const paymentColumns = useMemo(
    () => [
      {
        header: "Order ID",
        accessorKey: "order_id",
        cell: ({ row }) => `#${row.original.order_id}`
      },
      {
        header: "Retailer",
        accessorKey: "retailer",
        cell: ({ row }) => row.original.retailer_name || row.original.retailer_id || "—"
      },
      {
        header: "Amount Paid",
        accessorKey: "amount",
        cell: ({ row }) => formatCurrency(row.original.amount)
      },
      {
        header: "Payment Mode",
        accessorKey: "transaction_reference",
        cell: ({ row }) => row.original.payment_mode || row.original.transaction_reference || "—"
      },
      {
        header: "Date",
        accessorKey: "created_at",
        cell: ({ row }) => formatDate(row.original.collection_date || row.original.created_at)
      }
    ],
    []
  );

  const creditColumns = useMemo(
    () => [
      {
        header: "Credit Note #",
        accessorKey: "credit_note_number",
        cell: ({ row }) => row.original.credit_note_number || row.original.id
      },
      {
        header: "Order",
        accessorKey: "order_id",
        cell: ({ row }) => `#${row.original.order_id}`
      },
      {
        header: "Invoice #",
        accessorKey: "invoice_number",
        cell: ({ row }) => <InvoiceCell invoiceNumber={row.original.original_invoice_number} />
      },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => formatCurrency(row.original.amount)
      },
      {
        header: "Reason",
        accessorKey: "reason",
        cell: ({ row }) => row.original.reason || "—"
      },
      {
        header: "Date",
        accessorKey: "created_at",
        cell: ({ row }) => formatDate(row.original.created_at)
      }
    ],
    []
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading accounting…
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
    <div className="space-y-6 max-lg:px-[2px] [&_.text-sm]:text-[14px] [&_.text-xs]:text-[12px]">
      <dl className="grid divide-line rounded-lg border border-line bg-white sm:grid-cols-3 sm:divide-x">
        {[
          ["Total outstanding", formatCurrency(owed?.total_outstanding || 0), "As of today, across all non-cancelled orders"],
          ["Total collected", formatCurrency(paymentsTotalAmount || 0), `${formatCount(paymentsTotal)} payments · ${describePeriod(paymentsDateRange)}`],
          ["Credits issued", formatCurrency(creditsTotalAmount || 0), `${formatCount(creditsTotal)} credit notes`],
        ].map(([label, value, caption]) => <div key={label} className="p-4"><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</dd><p className="mt-1 text-xs text-muted">{caption}</p></div>)}
      </dl>

      {cancelled?.payments_total ? (
        <p className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-2.5 text-sm text-[#92400e]">
          {formatCurrency(cancelled.payments_total)} recorded on {cancelled.orders} cancelled{" "}
          {cancelled.orders === 1 ? "order" : "orders"}
          {cancelled.invoices ? `, and ${cancelled.invoices} ${cancelled.invoices === 1 ? "invoice" : "invoices"} issued on them` : ""}.
          It counts in no total. Refund it or move it to the right order.{" "}
          <Link href="/app/orders?queue=all&status=CANCELLED" className="font-medium underline">
            Review cancelled orders
          </Link>
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <LineChartCard
          title="Payments collected over time"
          subtitle="Daily collection trend"
          data={paymentsOverTime}
          lines={[{ dataKey: "amount", name: "Amount", color: "#5e0b26" }]}
        />
        <BarChartCard
          title="Outstanding by retailer"
          subtitle="Open balance per account"
          data={outstandingByRetailer}
          bars={[{ dataKey: "amount", name: "Outstanding", color: "#5e0b26" }]}
        />
      </div>

      <SectionCard
        title="Payments"
        subtitle="Captured collections"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSelect
              label="Payments period"
              value={paymentsDateRange}
              onChange={(r) => { setPaymentsDateRange(r); setPaymentsPage(1); }}
            />
            <select
              value={paymentsPageSize}
              onChange={(event) => {
                setPaymentsPageSize(Number(event.target.value));
                setPaymentsPage(1);
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>
        }
      >
        {paymentsError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
            {paymentsError}
          </div>
        ) : (
          <>
            <DataTable mobileCardClassName="!rounded-lg !shadow-none [&_dt]:!text-muted [&_dt]:!normal-case [&_dt]:!tracking-normal"
              columns={paymentColumns}
              data={payments}
              emptyLabel={paymentsLoading ? "Loading payments..." : "No payments available."}
            />
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>
                Page {paymentsPage} of {Math.max(1, Math.ceil(paymentsTotal / paymentsPageSize))}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentsPage((prev) => Math.max(1, prev - 1))}
                  disabled={paymentsPage === 1}
                  className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentsPage((prev) => prev + 1)}
                  disabled={paymentsPage >= Math.ceil(paymentsTotal / paymentsPageSize)}
                  className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard
        title="Credit Notes"
        subtitle="Issued credits"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSelect
              label="Credits period"
              value={creditsDateRange}
              onChange={(r) => { setCreditsDateRange(r); setCreditsPage(1); }}
            />
            <select
              value={creditsPageSize}
              onChange={(event) => {
                setCreditsPageSize(Number(event.target.value));
                setCreditsPage(1);
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>
        }
      >
        {creditsError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
            {creditsError}
          </div>
        ) : (
          <>
            <DataTable mobileCardClassName="!rounded-lg !shadow-none [&_dt]:!text-muted [&_dt]:!normal-case [&_dt]:!tracking-normal"
              columns={creditColumns}
              data={credits}
              emptyLabel={creditsLoading ? "Loading credit notes..." : "No credit notes available."}
            />
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>
                Page {creditsPage} of {Math.max(1, Math.ceil(creditsTotal / creditsPageSize))}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreditsPage((prev) => Math.max(1, prev - 1))}
                  disabled={creditsPage === 1}
                  className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setCreditsPage((prev) => prev + 1)}
                  disabled={creditsPage >= Math.ceil(creditsTotal / creditsPageSize)}
                  className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
