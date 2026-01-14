"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import SectionCard from "@/components/layout/SectionCard";
import StatCard from "@/components/layout/StatCard";
import DataTable from "@/components/tables/DataTable";
import LineChartCard from "@/components/charts/LineChartCard";
import BarChartCard from "@/components/charts/BarChartCard";

function getOrderTotal(order) {
  if (!order?.items?.length) return 0;
  return order.items.reduce((sum, item) => {
    const base = (item.quantity || 0) * (item.unit_price || 0) - (item.discount_amount || 0);
    const taxes = (item.taxes || []).reduce((taxSum, tax) => taxSum + base * ((tax.rate || 0) / 100), 0);
    return sum + base + taxes;
  }, 0);
}

function getPaymentDate(payment) {
  return payment?.created_at || payment?.payment_date || payment?.date || null;
}

export default function AdminAccounting() {
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [credits, setCredits] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [ordersResponse, paymentsResponse, creditsResponse, retailersResponse] = await Promise.all([
          apiFetch(apiEndpoints.admin.orders),
          apiFetch(apiEndpoints.admin.accountingPayments),
          apiFetch(apiEndpoints.admin.accountingCredits),
          apiFetch(apiEndpoints.admin.retailers)
        ]);
        if (!active) return;
        setOrders(ordersResponse || []);
        setPayments(paymentsResponse || []);
        setCredits(creditsResponse || []);
        setRetailers(retailersResponse || []);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load accounting data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    const outgoingOrders = orders.filter((order) => String(order.order_type).toUpperCase() === "OUTGOING");
    const receivables = outgoingOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    const collected = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const creditsTotal = credits.reduce((sum, note) => {
      if (note.amount !== undefined) return sum + (note.amount || 0);
      if (note.items?.length) {
        return (
          sum +
          note.items.reduce((itemSum, item) => itemSum + (item.quantity || 0) * (item.unit_price || 0), 0)
        );
      }
      return sum;
    }, 0);

    return { receivables, collected, creditsTotal };
  }, [orders, payments, credits]);

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
  }, [payments]);

  const outstandingByRetailer = useMemo(() => {
    const grouped = new Map();
    orders.forEach((order) => {
      const status = String(order.payment_status || "UNPAID").toUpperCase();
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
        cell: ({ row }) => {
          if (row.original.amount !== undefined) return formatCurrency(row.original.amount);
          if (row.original.items?.length) {
            const sum = row.original.items.reduce(
              (total, item) => total + (item.quantity || 0) * (item.unit_price || 0),
              0
            );
            return formatCurrency(sum);
          }
          return "—";
        }
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
          subtitle={`${formatNumber(payments.length)} payments logged`}
          accent="emerald"
        />
        <StatCard
          title="Total Credits Issued"
          value={formatCurrency(totals.creditsTotal)}
          subtitle={`${formatNumber(credits.length)} credit notes`}
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

      <SectionCard title="Payments" subtitle="Captured collections">
        <DataTable columns={paymentColumns} data={paymentRows} emptyLabel="No payments available." />
      </SectionCard>

      <SectionCard title="Credit Notes" subtitle="Issued credits">
        <DataTable columns={creditColumns} data={credits} emptyLabel="No credit notes available." />
      </SectionCard>
    </div>
  );
}
