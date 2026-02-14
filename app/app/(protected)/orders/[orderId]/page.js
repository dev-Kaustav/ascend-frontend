"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiEndpoints, apiFetch, apiFetchCached } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber, toTitleCase } from "@/lib/format";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";

function getOrderDate(order) {
  return order?.created_at || order?.order_date || order?.date || null;
}

function formatTaxes(taxes) {
  if (!taxes || taxes.length === 0) return "—";
  return taxes.map((tax) => `${tax.tax_type} ${tax.rate}%`).join(", ");
}

export default function AdminOrderDetail() {
  const params = useParams();
  const orderId = params?.orderId;
  const [order, setOrder] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!orderId) return;
      try {
        const [orderResponse, skuResponse] = await Promise.all([
          apiFetch(apiEndpoints.orders.detail(orderId)),
          apiFetchCached(apiEndpoints.admin.skus)
        ]);
        if (!active) return;
        setOrder(orderResponse);
        setSkus(skuResponse || []);
        try {
          const invoiceResponse = await apiFetch(apiEndpoints.orders.invoice(orderId));
          if (active) setInvoice(invoiceResponse);
        } catch (invoiceError) {
          if (active) setInvoice(null);
        }
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load order details.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [orderId]);

  const skuMap = useMemo(() => {
    const map = new Map();
    skus.forEach((sku) => {
      map.set(sku.id, sku.name);
    });
    return map;
  }, [skus]);

  const itemColumns = useMemo(
    () => [
      {
        header: "SKU",
        accessorKey: "sku_id",
        cell: ({ row }) => skuMap.get(row.original.sku_id) || `SKU ${row.original.sku_id}`
      },
      {
        header: "Quantity",
        accessorKey: "quantity",
        cell: ({ row }) => formatNumber(row.original.quantity)
      },
      {
        header: "Unit Price",
        accessorKey: "unit_price",
        cell: ({ row }) => formatCurrency(row.original.unit_price)
      },
      {
        header: "Discount",
        accessorKey: "discount_amount",
        cell: ({ row }) => formatCurrency(row.original.discount_amount || 0)
      },
      {
        header: "GST",
        accessorKey: "taxes",
        cell: ({ row }) => formatTaxes(row.original.taxes)
      }
    ],
    [skuMap]
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading order details…
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

  if (!order) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Order not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title={`Order #${order.id}`}
        subtitle={`${toTitleCase(order.status)} • ${formatDate(getOrderDate(order))}`}
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Invoice</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{order.invoice_number || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Retailer</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {order.to_entity_name || order.to_entity_id || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Payment Status</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {toTitleCase(order.payment_status || "UNPAID")}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Warehouse</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {order.warehouse_name || order.warehouse_id || "—"}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Line Items" subtitle="SKU-level breakdown with GST and discounts">
        <DataTable columns={itemColumns} data={order.items || []} emptyLabel="No line items on this order." />
      </SectionCard>

      <SectionCard title="Payments" subtitle="Payment history on this order">
        {order.payments?.length ? (
          <div className="space-y-3">
            {order.payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(payment.amount)}</p>
                  <p className="text-xs text-slate-500">{payment.transaction_reference || "Transaction"}</p>
                </div>
                <p className="text-xs text-slate-500">{formatDate(payment.created_at)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
            No payment history available.
          </div>
        )}
      </SectionCard>

      <SectionCard title="Credit Notes" subtitle="Credits issued against this order">
        {order.credit_notes?.length ? (
          <div className="space-y-3">
            {order.credit_notes.map((note) => (
              <div key={note.id} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-sm font-semibold text-slate-900">Credit Note #{note.credit_note_number}</p>
                <p className="text-xs text-slate-500">Items: {note.items?.length || 0}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
            No credit notes linked to this order.
          </div>
        )}
      </SectionCard>

      <SectionCard title="Invoice Totals" subtitle="Taxable value and GST totals">
        {invoice ? (
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Taxable Value</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(invoice.taxable_value)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">GST</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(invoice.gst_amount)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Subtotal</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(invoice.subtotal)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Grand Total</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(invoice.grand_total)}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
            Invoice totals not available for this role.
          </div>
        )}
      </SectionCard>
    </div>
  );
}
