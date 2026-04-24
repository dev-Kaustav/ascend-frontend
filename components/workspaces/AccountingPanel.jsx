"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch, apiFetchCached } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import SectionCard from "@/components/layout/SectionCard";
import StatCard from "@/components/layout/StatCard";
import DataTable from "@/components/tables/DataTable";
import LineChartCard from "@/components/charts/LineChartCard";
import BarChartCard from "@/components/charts/BarChartCard";

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

function getPaymentDate(payment) {
  return payment?.created_at || payment?.payment_date || payment?.date || null;
}

function getCreditNoteAmount(note) {
  if (!note) return 0;
  if (typeof note.amount === "number") return note.amount;
  if (note.amount !== undefined && note.amount !== null) {
    const parsed = Number(note.amount);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (!note.items?.length) return 0;
  const total = note.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export default function AdminAccounting() {
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [credits, setCredits] = useState([]);
  const [retailers, setRetailers] = useState([]);
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

  useEffect(() => {
    let active = true;
    async function loadOrders() {
      setLoading(true);
      try {
        const lookupsPromise = apiFetchCached(apiEndpoints.admin.lookups);
        const limit = 200;
        let offset = 0;
        let combined = [];
        let total = null;
        // Fetch in pages to respect backend limit (<=200)
        // Stop early if we read all or hit a short page.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const resp = await apiFetch(`${apiEndpoints.admin.orders}?limit=${limit}&offset=${offset}`);
          const items = resp?.items || [];
          combined = combined.concat(items);
          total = resp?.total ?? combined.length;
          offset += limit;
          if (!resp?.total || combined.length >= total || items.length < limit) break;
        }
        const lookupsResponse = await lookupsPromise;
        if (!active) return;
        setOrders(combined);
        setRetailers(lookupsResponse?.retailers || []);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load accounting data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadOrders();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadPayments() {
      setPaymentsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(paymentsPageSize));
        params.set("offset", String((paymentsPage - 1) * paymentsPageSize));
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
  }, [paymentsPage, paymentsPageSize]);

  useEffect(() => {
    let active = true;
    async function loadCredits() {
      setCreditsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(creditsPageSize));
        params.set("offset", String((creditsPage - 1) * creditsPageSize));
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
  }, [creditsPage, creditsPageSize]);

  const totals = useMemo(() => {
    const receivables = orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    const collected =
      paymentsTotalAmount !== null
        ? paymentsTotalAmount
        : payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const creditsTotal =
      creditsTotalAmount !== null
        ? creditsTotalAmount
        : credits.reduce((sum, note) => sum + getCreditNoteAmount(note), 0);

    return { receivables, collected, creditsTotal };
  }, [orders, payments, credits, paymentsTotalAmount, creditsTotalAmount]);

  const retailerMap = useMemo(() => {
    const map = new Map();
    retailers.forEach((retailer) => {
      map.set(retailer.id, retailer.name);
    });
    return map;
  }, [retailers]);

  const orderMap = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      map.set(order.id, order);
    });
    return map;
  }, [orders]);

  const paymentRows = useMemo(() => {
    return payments.map((payment) => {
      const order = orderMap.get(payment.order_id);
      const retailerId = order?.to_entity_id;
      return {
        ...payment,
        retailer_id: retailerId,
        retailer_name: retailerMap.get(retailerId)
      };
    });
  }, [orderMap, payments, retailerMap]);

  const paymentsOverTime = useMemo(() => {
    if (paymentsDailyTotals.length) {
      return paymentsDailyTotals.map((entry) => ({
        label: new Date(entry.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        amount: entry.amount || 0
      }));
    }
    const grouped = new Map();
    payments.forEach((payment) => {
      const date = getPaymentDate(payment);
      if (!date) return;
      const label = new Date(date).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      const current = grouped.get(label) || { label, amount: 0 };
      current.amount += payment.amount || 0;
      grouped.set(label, current);
    });
    return Array.from(grouped.values());
  }, [payments, paymentsDailyTotals]);

  const outstandingByRetailer = useMemo(() => {
    const grouped = new Map();
    orders.forEach((order) => {
      const status = String(order.payment_status || "CREDIT").toUpperCase();
      if (status === "PAID") return;
      const retailer = retailerMap.get(order.to_entity_id) || order.to_entity_name || order.to_entity_id || "Retailer";
      const label = typeof retailer === "string" ? retailer : `Retailer ${retailer}`;
      const current = grouped.get(label) || { label, amount: 0 };
      current.amount += getOrderTotal(order);
      grouped.set(label, current);
    });
    return Array.from(grouped.values());
  }, [orders, retailerMap]);

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
        cell: ({ row }) => formatDate(getPaymentDate(row.original))
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
        header: "Invoice #",
        accessorKey: "invoice_number",
        cell: ({ row }) => row.original.invoice_number || row.original.order_id || "—"
      },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => formatCurrency(getCreditNoteAmount(row.original))
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
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard
          title="Total Receivables"
          value={formatCurrency(totals.receivables)}
          subtitle="From outgoing orders"
          accent="sky"
        />
        <StatCard
          title="Total Collected"
          value={formatCurrency(totals.collected)}
          subtitle={`${formatNumber(paymentsTotal)} payments logged`}
          accent="emerald"
        />
        <StatCard
          title="Total Credits Issued"
          value={formatCurrency(totals.creditsTotal)}
          subtitle={`${formatNumber(creditsTotal)} credit notes`}
          accent="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LineChartCard
          title="Payments collected over time"
          subtitle="Daily collection trend"
          data={paymentsOverTime}
          lines={[{ dataKey: "amount", name: "Amount", color: "#14b8a6" }]}
        />
        <BarChartCard
          title="Outstanding by retailer"
          subtitle="Open balance per account"
          data={outstandingByRetailer}
          bars={[{ dataKey: "amount", name: "Outstanding", color: "#f97316" }]}
        />
      </div>

      <SectionCard
        title="Payments"
        subtitle="Captured collections"
        actions={
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
        }
      >
        {paymentsError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
            {paymentsError}
          </div>
        ) : (
          <>
            <DataTable
              columns={paymentColumns}
              data={paymentRows}
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
        }
      >
        {creditsError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
            {creditsError}
          </div>
        ) : (
          <>
            <DataTable
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
