"use client";

import { useMemo, useState } from "react";
import { formatCount, formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { ORDER_STEPS, PAYMENT_LABEL, PAYMENT_TONE, STATUS_LABEL, STATUS_TONE } from "@/lib/orderStatus";
import { useAuth } from "@/components/auth/AuthProvider";
import { OrderActionBar, downloadInvoicePdf, useOrderDetail } from "@/components/orders/OrderDetailPanel";

// The desktop view of one order, opened from the orders queue. One question: "where is this order,
// and what is the next step?" The progress strip answers the first, the action panel the second;
// everything else (the shop, the lines, the money, the history) follows in reading order.
// Phones and the field roles keep OrderDetailPanel.

function Pill({ tone, children }) {
  return <span className={`inline-flex h-6 flex-none items-center whitespace-nowrap rounded px-2 text-xs font-medium ${tone}`}>{children}</span>;
}

function Section({ title, aside, children }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {aside ? <span className="text-xs text-muted">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

// When, and by whom, the order reached each step: the latest entry for a status, because a
// declined rider sends the order back and it reaches "Accepted" again. "Placed" is the first
// entry instead, since later notes on a pending order (cash collected) are not its placing.
function stepTimes(trails = []) {
  const reached = {};
  for (const trail of trails) {
    if (trail.order_status === "PENDING" && reached.PENDING) continue;
    reached[trail.order_status] = trail;
  }
  return reached;
}

function ProgressStrip({ order }) {
  const reached = stepTimes(order.trails);
  const interrupted = order.status === "CANCELLED" || order.status === "RETURNED";
  const currentIndex = ORDER_STEPS.findIndex((step) => step.status === order.status);
  // A rider declining sends the order back a step; the strip shows where it is now, not where it has been.
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="Order progress">
      {ORDER_STEPS.map((step, index) => {
        const done = !interrupted && index <= currentIndex;
        const current = !interrupted && index === currentIndex;
        const entry = done ? reached[step.status] : null;
        return (
          <li key={step.status} aria-current={current ? "step" : undefined} className="min-w-0">
            <div className={`h-1 rounded-full ${done ? (current ? "bg-data" : "bg-ink") : "bg-raised"}`} />
            <p className={`mt-2 truncate text-sm ${done ? "font-medium text-ink" : "text-muted"}`}>{step.label}</p>
            <p className="truncate text-xs text-muted">
              {entry ? formatDateTime(entry.created_at) : "—"}
            </p>
            {entry?.changed_by_name ? <p className="truncate text-xs text-muted">{entry.changed_by_name}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

function taxTotals(items = []) {
  const totals = new Map();
  for (const item of items) {
    for (const tax of item.taxes || []) {
      const amount = ((Number(item.taxable_value) || 0) * (Number(tax.rate) || 0)) / 100;
      totals.set(tax.tax_type, (totals.get(tax.tax_type) || 0) + amount);
    }
  }
  return [...totals.entries()];
}

function Facts({ order }) {
  const place = [order.retailer_city, order.retailer_state].filter(Boolean).join(", ");
  const rows = [
    ["Shop", order.retailer_name, place],
    ["Salesman", order.salesman_name, order.salesman_phone],
    ["Rider", order.delivery_driver_name],
    ["Beat", order.beat_name],
    ["Warehouse", order.warehouse_name, order.warehouse_state],
    ["GSTIN", order.retailer_gst_number],
    ["Channel", order.channel === "ONLINE" ? "Online store" : "Offline"],
  ].filter(([, value]) => value);
  return (
    <dl className="grid grid-cols-2 gap-x-6 rounded-lg border border-line bg-white px-4 py-1">
      {rows.map(([label, value, sub]) => (
        <div key={label} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-rule py-2.5 [&:nth-last-child(-n+2)]:border-0">
          <dt className="shrink-0 text-sm text-muted">{label}</dt>
          <dd className="min-w-0 truncate text-right text-sm text-ink" title={sub ? `${value} · ${sub}` : value}>
            {value}
            {sub ? <span className="text-muted"> · {sub}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Lines({ order }) {
  const items = order.items || [];
  const taxes = taxTotals(items);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th className="h-9 px-4 text-left font-normal">Item</th>
            <th className="h-9 px-3 text-right font-normal">Qty</th>
            <th className="h-9 px-3 text-right font-normal">Rate</th>
            <th className="h-9 px-3 text-right font-normal">Discount</th>
            <th className="h-9 px-4 text-right font-normal">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-muted">No items on this order.</td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id} className="border-b border-rule">
                <td className="px-4 py-2.5">
                  <p className="text-ink">{item.sku_name || item.sku_code || `SKU ${item.sku_id}`}</p>
                  {item.hsn_code ? <p className="text-xs text-muted">HSN {item.hsn_code}</p> : null}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatCount(item.quantity)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(item.unit_price)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                  {Number(item.discount_amount) ? formatCurrency(item.discount_amount) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink">{formatCurrency(item.line_total)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {/* Tax is summed per kind here rather than repeated on every line. */}
      <dl className="ml-auto w-full max-w-xs space-y-1.5 px-4 py-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Taxable value</dt>
          <dd className="tabular-nums">{formatCurrency(order.taxable_value)}</dd>
        </div>
        {taxes.map(([type, amount]) => (
          <div key={type} className="flex justify-between gap-4">
            <dt className="text-muted">{type}</dt>
            <dd className="tabular-nums">{formatCurrency(amount)}</dd>
          </div>
        ))}
        {Number(order.delivery_charge) ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Delivery charge</dt>
            <dd className="tabular-nums">{formatCurrency(order.delivery_charge)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 border-t border-line pt-1.5 font-semibold text-ink">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatCurrency(order.grand_total ?? order.total_amount)}</dd>
        </div>
      </dl>
    </div>
  );
}

function Payments({ order }) {
  const payments = order.payments || [];
  if (!payments.length) {
    return <p className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted">No payment recorded yet.</p>;
  }
  return (
    <ul className="rounded-lg border border-line bg-white px-4">
      {payments.map((payment) => (
        <li key={payment.id} className="flex items-center justify-between gap-4 border-b border-rule py-2.5 text-sm last:border-0">
          <div className="min-w-0">
            <p className="text-ink">{PAYMENT_MODE_LABEL[payment.payment_mode] || payment.payment_mode || "Payment"}</p>
            <p className="truncate text-xs text-muted">
              {payment.transaction_reference?.startsWith("SALESMAN-CASH-")
                ? "Collected by the salesman"
                : payment.transaction_reference || "—"}
              {" · "}
              {formatDateTime(payment.created_at)}
            </p>
          </div>
          <p className="shrink-0 font-semibold tabular-nums text-ink">{formatCurrency(payment.amount)}</p>
        </li>
      ))}
    </ul>
  );
}

const PAYMENT_MODE_LABEL = { CASH: "Cash", UPI: "UPI", CHEQUE: "Cheque", ONLINE: "Online" };

function History({ trails = [] }) {
  if (!trails.length) return <p className="text-sm text-muted">No history recorded.</p>;
  return (
    <ol className="rounded-lg border border-line bg-white px-4">
      {[...trails].reverse().map((trail) => (
        <li key={trail.id} className="grid grid-cols-[9.5rem_1fr] gap-4 border-b border-rule py-2.5 text-sm last:border-0">
          <span className="tabular-nums text-muted">{formatDateTime(trail.created_at)}</span>
          <span className="min-w-0">
            <span className="text-ink">{trail.description || STATUS_LABEL[trail.order_status] || trail.order_status}</span>
            {trail.changed_by_name ? <span className="text-muted"> · {trail.changed_by_name}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function OrderDesk({ orderId, onClose, onOrderUpdate }) {
  const { role } = useAuth();
  const { order, drivers, loading, error, reload } = useOrderDetail(orderId, role);
  const [downloading, setDownloading] = useState(false);
  const total = order ? order.grand_total ?? order.total_amount : 0;
  const paid = useMemo(() => (order?.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0), [order]);

  function handleUpdate() {
    reload();
    onOrderUpdate?.();
  }

  async function downloadInvoice() {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadInvoicePdf(orderId);
    } finally {
      setDownloading(false);
    }
  }

  if (!orderId) return null;
  if (loading && !order) return <p className="p-6 text-sm text-muted">Loading order #{orderId}…</p>;
  if (error && !order) return <p className="p-6 text-sm text-[#c4242a]">{error}</p>;
  if (!order) return <p className="p-6 text-sm text-muted">Order not found.</p>;

  const pending = Number(order.pending_amount) || 0;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-semibold text-ink">Order #{order.id}</h2>
            <Pill tone={STATUS_TONE[order.status] || STATUS_TONE.PENDING}>{STATUS_LABEL[order.status] || order.status}</Pill>
          </div>
          <p className="mt-1 truncate text-sm text-muted">
            {order.retailer_name || "Unknown shop"} · placed {formatDate(order.created_at)}
            {order.invoice_number ? ` · invoice ${order.invoice_number}` : " · invoice not issued yet"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {order.invoice_number ? (
            <button
              type="button"
              onClick={downloadInvoice}
              disabled={downloading}
              className="h-9 rounded-md border border-control bg-white px-3 text-sm font-medium text-ink hover:bg-raised disabled:opacity-60"
            >
              {downloading ? "Preparing…" : "Invoice PDF"}
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close order"
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-raised hover:text-ink"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </header>

      {/* The money first: what the order is worth and what is still owed. */}
      <div className="grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-white">
        <div className="px-4 py-3">
          <p className="text-[13px] text-muted">Order total</p>
          <p className="mt-0.5 text-[28px] font-bold leading-tight tabular-nums text-ink">{formatCurrency(total)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[13px] text-muted">Received</p>
          <p className="mt-1.5 text-lg tabular-nums text-ink">{formatCurrency(paid)}</p>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-muted">Still owed</p>
            <Pill tone={PAYMENT_TONE[order.payment_status] || PAYMENT_TONE.CREDIT}>
              {PAYMENT_LABEL[order.payment_status] || "On credit"}
            </Pill>
          </div>
          <p className={`mt-1.5 text-lg tabular-nums ${pending > 0 ? "font-semibold text-data" : "text-muted"}`}>
            {formatCurrency(pending)}
          </p>
        </div>
      </div>

      <ProgressStrip order={order} />

      <OrderActionBar order={order} role={role} drivers={drivers} onUpdate={handleUpdate} />

      <Section title="Details">
        <Facts order={order} />
      </Section>

      <Section title="Items" aside={`${(order.items || []).length} ${(order.items || []).length === 1 ? "line" : "lines"}`}>
        <Lines order={order} />
      </Section>

      <Section title="Payments">
        <Payments order={order} />
      </Section>

      <Section title="History">
        <History trails={order.trails} />
      </Section>
    </div>
  );
}
