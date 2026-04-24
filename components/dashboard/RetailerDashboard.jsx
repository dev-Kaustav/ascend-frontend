"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber, toTitleCase } from "@/lib/format";
import SectionCard from "@/components/layout/SectionCard";
import StatCard from "@/components/layout/StatCard";
import DataTable from "@/components/tables/DataTable";

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

function getOrderDate(order) {
  return order?.created_at || order?.order_date || order?.date || null;
}

export default function RetailerDashboard() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetch(apiEndpoints.retailer.orders);
        if (!active) return;
        setOrders(response || []);
        setSelectedOrder((response || [])[0] || null);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load retailer orders.");
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
    const outstanding = orders.reduce((sum, order) => {
      const status = String(order.payment_status || "UNPAID").toUpperCase();
      if (status === "PAID") return sum;
      return sum + getOrderTotal(order);
    }, 0);
    return {
      totalOrders: orders.length,
      outstanding
    };
  }, [orders]);

  const columns = useMemo(
    () => [
      {
        header: "Invoice #",
        accessorKey: "invoice_number",
        cell: ({ row }) => row.original.invoice_number || "—"
      },
      {
        header: "Date",
        accessorKey: "created_at",
        cell: ({ row }) => formatDate(getOrderDate(row.original))
      },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => formatCurrency(getOrderTotal(row.original))
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => toTitleCase(row.original.status)
      },
      {
        header: "Payment",
        accessorKey: "payment_status",
        cell: ({ row }) => toTitleCase(row.original.payment_status || "UNPAID")
      }
    ],
    []
  );

  function handleDownload(order) {
    if (!order) return;
    const blob = new Blob([JSON.stringify(order, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoice-${order.invoice_number || order.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading retailer dashboard…
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
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Total Orders Placed"
          value={formatNumber(totals.totalOrders)}
          subtitle="Retail orders"
          accent="sky"
        />
        <StatCard
          title="Outstanding Amount"
          value={formatCurrency(totals.outstanding)}
          subtitle="Pending payment"
          accent="amber"
        />
      </div>

      <SectionCard title="Order History" subtitle={`${orders.length} orders`}>
        <DataTable
          columns={columns}
          data={orders}
          emptyLabel="No orders found."
          onRowClick={(order) => setSelectedOrder(order)}
        />
      </SectionCard>

      <SectionCard title="Order Detail" subtitle="Items and invoice download">
        {selectedOrder ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Invoice</p>
                <p className="text-sm font-semibold text-slate-900">{selectedOrder.invoice_number || "—"}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(selectedOrder)}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-600"
              >
                Download JSON
              </button>
            </div>
            <div className="space-y-2">
              {(selectedOrder.items || []).map((item) => (
                <div key={item.id || item.sku_id} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                  <p className="text-sm font-semibold text-slate-900">SKU {item.sku_id}</p>
                  <p className="text-xs text-slate-500">
                    Qty {formatNumber(item.quantity)} • {formatCurrency(item.unit_price)} • Discount {formatCurrency(item.discount_amount || 0)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
            Select an order to see details.
          </div>
        )}
      </SectionCard>
    </div>
  );
}
