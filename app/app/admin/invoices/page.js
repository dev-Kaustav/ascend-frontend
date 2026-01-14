"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber, toTitleCase } from "@/lib/format";
import StatCard from "@/components/layout/StatCard";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";

function getOrderDate(order) {
  return order?.created_at || order?.order_date || order?.date || null;
}

function getOrderTotal(order) {
  if (!order?.items?.length) return 0;
  return order.items.reduce((sum, item) => {
    const base = (item.quantity || 0) * (item.unit_price || 0) - (item.discount_amount || 0);
    const taxes = (item.taxes || []).reduce((taxSum, tax) => taxSum + base * ((tax.rate || 0) / 100), 0);
    return sum + base + taxes;
  }, 0);
}

export default function AdminInvoices() {
  const [orders, setOrders] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    status: "ALL",
    paymentStatus: "ALL"
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [ordersResponse, retailersResponse] = await Promise.all([
          apiFetch(apiEndpoints.admin.orders),
          apiFetch(apiEndpoints.admin.retailers)
        ]);
        if (!active) return;
        setOrders(ordersResponse || []);
        setRetailers(retailersResponse || []);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load invoices.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const invoiceOrders = useMemo(() => {
    return orders.filter((order) => order.invoice_number);
  }, [orders]);

  const retailerMap = useMemo(() => {
    const map = new Map();
    retailers.forEach((retailer) => {
      map.set(retailer.id, retailer.name);
    });
    return map;
  }, [retailers]);

  const filteredOrders = useMemo(() => {
    return invoiceOrders.filter((order) => {
      if (filters.search && !String(order.invoice_number).toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.status !== "ALL" && String(order.status).toUpperCase() !== filters.status) {
        return false;
      }
      if (
        filters.paymentStatus !== "ALL" &&
        String(order.payment_status || "UNPAID").toUpperCase() !== filters.paymentStatus
      ) {
        return false;
      }
      return true;
    });
  }, [filters, invoiceOrders]);

  const totals = useMemo(() => {
    const totalInvoices = invoiceOrders.length;
    const totalBilled = invoiceOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    const paidInvoices = invoiceOrders.filter(
      (order) => String(order.payment_status || "UNPAID").toUpperCase() === "PAID"
    ).length;
    return { totalInvoices, totalBilled, paidInvoices };
  }, [invoiceOrders]);

  const columns = useMemo(
    () => [
      {
        header: "Invoice #",
        accessorKey: "invoice_number",
        cell: ({ row }) => (
          <Link className="font-semibold text-slate-900 hover:underline" href={`/app/admin/orders/${row.original.id}`}>
            {row.original.invoice_number}
          </Link>
        )
      },
      {
        header: "Retailer",
        accessorKey: "to_entity_id",
        cell: ({ row }) => {
          const retailerId = row.original.to_entity_id;
          return retailerMap.get(retailerId) || row.original.to_entity_name || retailerId || "—";
        }
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
      },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => formatCurrency(getOrderTotal(row.original))
      },
      {
        header: "Date",
        accessorKey: "created_at",
        cell: ({ row }) => formatDate(getOrderDate(row.original))
      }
    ],
    [retailerMap]
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading invoices…
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
          title="Invoices"
          value={formatNumber(totals.totalInvoices)}
          subtitle="Issued invoices"
          accent="sky"
        />
        <StatCard
          title="Total Billed"
          value={formatCurrency(totals.totalBilled)}
          subtitle="Invoice value"
          accent="emerald"
        />
        <StatCard
          title="Paid Invoices"
          value={formatNumber(totals.paidInvoices)}
          subtitle="Fully paid"
          accent="amber"
        />
      </div>

      <SectionCard title="Invoice Filters" subtitle="Search invoice numbers or filter status">
        <div className="grid gap-4 md:grid-cols-3">
          <input
            type="text"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Search invoice"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
          />
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
          >
            <option value="ALL">Status</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={filters.paymentStatus}
            onChange={(event) => setFilters((prev) => ({ ...prev, paymentStatus: event.target.value }))}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
          >
            <option value="ALL">Payment</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="UNPAID">Unpaid</option>
          </select>
        </div>
      </SectionCard>

      <SectionCard title="Invoices" subtitle={`${formatNumber(filteredOrders.length)} invoices`}>
        <DataTable columns={columns} data={filteredOrders} emptyLabel="No invoices to display." />
      </SectionCard>
    </div>
  );
}
