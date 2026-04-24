"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch, apiFetchBlob } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber, formatPercent, toTitleCase } from "@/lib/format";
import DataTable from "@/components/tables/DataTable";

function getOrderDate(order) {
  return order?.created_at || order?.order_date || order?.date || null;
}

function formatTaxes(taxes) {
  if (!taxes || taxes.length === 0) return "—";
  return taxes.map((tax) => `${tax.tax_type} ${formatPercent(tax.rate)}`).join(", ");
}

function InfoTile({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900 tabular-nums">{value || "—"}</p>
    </div>
  );
}

function DetailBlock({ title, children }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-950 text-balance">{title}</h3>
      {children}
    </section>
  );
}

export default function OrderDetailPanel({ orderId, onClose }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!orderId) return;
      setLoading(true);
      try {
        const response = await apiFetch(apiEndpoints.orders.detail(orderId));
        if (!active) return;
        setOrder(response);
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

  async function downloadInvoice() {
    if (!orderId || downloading) return;
    setDownloading(true);
    try {
      const { blob, filename } = await apiFetchBlob(apiEndpoints.orders.invoicePdf(orderId));
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `invoice-${orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const itemColumns = useMemo(
    () => [
      {
        header: "SKU",
        accessorKey: "sku_name",
        cell: ({ row }) => row.original.sku_name || `SKU ${row.original.sku_id}`
      },
      {
        header: "HSN",
        accessorKey: "hsn_code",
        cell: ({ row }) => row.original.hsn_code || "—"
      },
      {
        header: "Qty",
        accessorKey: "quantity",
        meta: { type: "number" },
        cell: ({ row }) => formatNumber(row.original.quantity)
      },
      {
        header: "MRP",
        accessorKey: "unit_price",
        meta: { type: "number" },
        cell: ({ row }) => formatCurrency(row.original.unit_price)
      },
      {
        header: "Discount",
        accessorKey: "discount_amount",
        meta: { type: "number" },
        cell: ({ row }) => formatCurrency(row.original.discount_amount || 0)
      },
      {
        header: "Taxable",
        accessorKey: "taxable_value",
        meta: { type: "number" },
        cell: ({ row }) => formatCurrency(row.original.taxable_value)
      },
      {
        header: "GST",
        accessorKey: "gst_amount",
        meta: { type: "number" },
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="font-semibold text-slate-700 tabular-nums">{formatCurrency(row.original.gst_amount)}</p>
            <p className="text-xs text-slate-400">{formatTaxes(row.original.taxes)}</p>
          </div>
        )
      },
      {
        header: "Final",
        accessorKey: "line_total",
        meta: { type: "number" },
        cell: ({ row }) => formatCurrency(row.original.line_total)
      }
    ],
    []
  );

  if (!orderId) return null;

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading order details...</div>;
  }

  if (error) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">{error}</div>;
  }

  if (!order) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Order not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">{formatDate(getOrderDate(order))}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950 text-balance">Order #{order.id}</h2>
          <p className="mt-1 text-sm text-slate-500 text-pretty">
            {toTitleCase(order.status)} · {order.invoice_number || "Invoice pending"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadInvoice}
            disabled={downloading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {downloading ? "Preparing..." : "Invoice PDF"}
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoTile label="Retailer" value={order.retailer_name || order.to_entity_id} />
        <InfoTile label="Warehouse" value={[order.warehouse_name, order.warehouse_state].filter(Boolean).join(", ")} />
        <InfoTile label="Payment" value={toTitleCase(order.payment_status || "CREDIT")} />
        <InfoTile label="Pending" value={formatCurrency(order.pending_amount)} />
        <InfoTile label="Salesman" value={order.salesman_name} />
        <InfoTile label="Driver" value={order.delivery_driver_name} />
        <InfoTile label="Retailer GSTIN" value={order.retailer_gst_number} />
        <InfoTile label="Grand Total" value={formatCurrency(order.grand_total || order.total_amount)} />
      </div>

      <DetailBlock title="Line Items">
        <DataTable
          columns={itemColumns}
          data={order.items || []}
          emptyLabel="No line items on this order."
          tableClassName="min-w-[1100px]"
        />
      </DetailBlock>

      <DetailBlock title="Totals">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoTile label="Taxable" value={formatCurrency(order.taxable_value)} />
          <InfoTile label="GST" value={formatCurrency(order.gst_amount)} />
          <InfoTile label="Subtotal" value={formatCurrency(order.subtotal)} />
          <InfoTile label="Grand Total" value={formatCurrency(order.grand_total)} />
        </div>
      </DetailBlock>

      <DetailBlock title="Payments">
        {order.payments?.length ? (
          <div className="space-y-2">
            {order.payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">{formatCurrency(payment.amount)}</p>
                  <p className="truncate text-xs text-slate-500">{payment.transaction_reference || "Transaction"}</p>
                </div>
                <p className="shrink-0 text-xs text-slate-500">{formatDate(payment.created_at)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-400">
            No payment history available.
          </div>
        )}
      </DetailBlock>

      <DetailBlock title="Credit Notes">
        {order.credit_notes?.length ? (
          <div className="space-y-2">
            {order.credit_notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{note.credit_note_number}</p>
                <p className="text-xs text-slate-500">{formatNumber(note.items?.length || 0)} items</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-400">
            No credit notes linked to this order.
          </div>
        )}
      </DetailBlock>
    </div>
  );
}
