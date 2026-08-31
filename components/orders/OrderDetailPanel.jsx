"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch, apiFetchBlob, apiFetchCached } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber, formatPercent, toTitleCase } from "@/lib/format";
import { getAccessToken, getRoleFromToken } from "@/lib/auth";
import DataTable from "@/components/tables/DataTable";
import InvoiceCell from "@/components/ui/InvoiceCell";

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

const STATUS_BADGE = {
  PENDING: "bg-slate-100 text-slate-700",
  READY_TO_SHIP: "bg-sky-50 text-sky-700 border border-sky-200",
  OUT_FOR_DELIVERY: "bg-amber-50 text-amber-700 border border-amber-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  RETURNED: "bg-orange-50 text-orange-700 border border-orange-200",
  CANCELLED: "bg-rose-50 text-rose-700 border border-rose-200",
};

function StatusBadge({ status }) {
  const cls = STATUS_BADGE[status] || "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest ${cls}`}>
      {toTitleCase(status)}
    </span>
  );
}

function OrderTrailTimeline({ trails }) {
  if (!trails?.length) return null;
  return (
    <DetailBlock title="Order Trail">
      <div className="relative ml-1.5 border-l-2 border-slate-200 pl-5">
        {trails.map((trail, i) => {
          const isLast = i === trails.length - 1;
          return (
            <div key={trail.id} className={isLast ? "pb-0" : "pb-5"}>
              <div className="absolute -left-[5px] mt-0.5 h-2.5 w-2.5 rounded-full ring-4 ring-white" style={{
                backgroundColor: isLast ? "#1a1b2e" : "#10b981",
              }} />
              <div className="flex items-start justify-between gap-3">
                <StatusBadge status={trail.order_status} />
                <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">
                  {formatDate(trail.created_at)}
                </span>
              </div>
              {trail.description && (
                <p className="mt-1 text-xs text-slate-500">{trail.description}</p>
              )}
              {trail.changed_by_name && (
                <p className="mt-0.5 text-xs italic text-slate-400">by {trail.changed_by_name}</p>
              )}
            </div>
          );
        })}
      </div>
    </DetailBlock>
  );
}

const ACTION_CONFIG = {
  PENDING: {
    primary: { label: "Mark Ready to Ship", nextStatus: "READY_TO_SHIP", showDriver: true },
    cancel: true,
  },
  READY_TO_SHIP: {
    primary: { label: "Mark Out for Delivery", nextStatus: "OUT_FOR_DELIVERY" },
    cancel: true,
  },
  OUT_FOR_DELIVERY: {
    primary: { label: "Mark Delivered", nextStatus: "DELIVERED", showPayment: true },
    cancel: true,
  },
  DELIVERED: {
    cancel: true,
  },
};

const ROLE_ACTIONS = {
  ADMIN: ["PENDING", "READY_TO_SHIP", "OUT_FOR_DELIVERY", "DELIVERED"],
  WAREHOUSE_MANAGER: ["PENDING"],
  DRIVER: ["READY_TO_SHIP", "OUT_FOR_DELIVERY"],
  RETAILER: [],
  SALESMAN: [],
  ACCOUNTANT: [],
  BRAND: [],
};

// Mirrors the four cancel rows of _ALLOWED_TRANSITIONS in
// ascend-backend/app/services/order.py — the backend stays authoritative,
// this only shapes which button is offered.
const CANCEL_ROLES_BY_STATUS = {
  PENDING: new Set(["ADMIN", "RETAILER"]),
  READY_TO_SHIP: new Set(["ADMIN", "WAREHOUSE_MANAGER", "RETAILER"]),
  OUT_FOR_DELIVERY: new Set(["ADMIN", "DRIVER"]),
  DELIVERED: new Set(["ADMIN"]),
};

function OrderActionBar({ order, role, drivers, onUpdate }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const config = ACTION_CONFIG[order.status] || {};
  const allowedStatuses = ROLE_ACTIONS[role] || [];
  const canPrimary = config.primary && allowedStatuses.includes(order.status);
  const canCancel = config.cancel && (CANCEL_ROLES_BY_STATUS[order.status]?.has(role) ?? false);

  if (!canPrimary && !canCancel) return null;

  async function submitAction(nextStatus) {
    setSaving(true);
    setError("");
    try {
      const body = { status: nextStatus };
      if (nextStatus === "READY_TO_SHIP") {
        if (!form.driverId) {
          setError("Please select a driver.");
          setSaving(false);
          return;
        }
        body.delivery_driver_id = Number(form.driverId);
      }
      if (nextStatus === "DELIVERED") {
        if (form.paymentStatus) body.payment_status = form.paymentStatus;
        if (form.paymentMode) body.payment_mode = form.paymentMode;
        if (form.paymentAmount) body.payment_amount = Number(form.paymentAmount);
      }
      await apiFetch(apiEndpoints.orders.updateStatus(order.id), {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setForm({});
      onUpdate();
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DetailBlock title="Actions">
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        {canPrimary && (
          <div className="space-y-2">
            {config.primary.showDriver && (
              <select
                value={form.driverId || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, driverId: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select driver</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
            {config.primary.showPayment && (
              <div className="grid gap-2 sm:grid-cols-3">
                <select
                  value={form.paymentStatus || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Payment (optional)</option>
                  <option value="PAID">Paid</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="CREDIT">Credit</option>
                </select>
                {form.paymentStatus && form.paymentStatus !== "CREDIT" && (
                  <>
                    <select
                      value={form.paymentMode || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, paymentMode: e.target.value }))}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Mode</option>
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.paymentAmount || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, paymentAmount: e.target.value }))}
                      placeholder="Amount"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </>
                )}
              </div>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => submitAction(config.primary.nextStatus)}
              className="cursor-pointer rounded-full bg-[#1a1b2e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : config.primary.label}
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {canCancel && (
            <button
              type="button"
              disabled={saving}
              onClick={() => submitAction("CANCELLED")}
              className="cursor-pointer rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 disabled:opacity-60"
            >
              {order.status === "OUT_FOR_DELIVERY" ? "Refused at Shop" : "Cancel Order"}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
      </div>
    </DetailBlock>
  );
}

export default function OrderDetailPanel({ orderId, onClose, onOrderUpdate }) {
  const [order, setOrder] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const role = useMemo(() => getRoleFromToken(getAccessToken()), []);

  async function loadOrder() {
    if (!orderId) return;
    setLoading(true);
    try {
      const [response, driversResponse] = await Promise.all([
        apiFetch(apiEndpoints.orders.detail(orderId)),
        apiFetchCached(apiEndpoints.admin.drivers, { ttl: 60000 }).catch(() => []),
      ]);
      setOrder(response);
      setDrivers(driversResponse || []);
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load order details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  function handleOrderUpdate() {
    loadOrder();
    onOrderUpdate?.();
  }

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
        accessorKey: "sku_code",
        cell: ({ row }) =>
          row.original.sku_code || row.original.sku_name || `SKU ${row.original.sku_id}`
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
          <div className="mt-1.5 flex items-center gap-2">
            <StatusBadge status={order.status} />
            <InvoiceCell invoiceNumber={order.invoice_number} status={order.status} />
          </div>
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
        <InfoTile label="Beat" value={order.beat_name} />
        <InfoTile label="Driver" value={order.delivery_driver_name} />
        <InfoTile label="Retailer GSTIN" value={order.retailer_gst_number} />
        <InfoTile label="Grand Total" value={formatCurrency(order.grand_total || order.total_amount)} />
      </div>

      <OrderTrailTimeline trails={order.trails} />

      <OrderActionBar
        order={order}
        role={role}
        drivers={drivers}
        onUpdate={handleOrderUpdate}
      />

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
