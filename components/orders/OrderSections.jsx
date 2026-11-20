"use client";

import { useState } from "react";
import Link from "next/link";
import { apiEndpoints, apiFetchBlob } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { can } from "@/lib/policy";
import { itemName, lineDiscount, lineQuantity, lineRate } from "@/lib/orderLines";
import { orderProgress, PAYMENT_LABEL, PAYMENT_TONE, STATUS_LABEL, STATUS_TONE } from "@/lib/orderStatus";

// The pieces of the desktop order desk (OrderDesk). Phones read an order through OrderCards.

export function Pill({ tone, children }) {
  return <span className={`inline-flex h-6 flex-none items-center whitespace-nowrap rounded px-2 text-xs font-medium ${tone}`}>{children}</span>;
}

export function StatusPill({ status }) {
  return <Pill tone={STATUS_TONE[status] || STATUS_TONE.PENDING}>{STATUS_LABEL[status] || status}</Pill>;
}

export function Section({ title, aside, children }) {
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

function downloadBlob({ blob, filename }, fallback) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename && filename !== "download" ? filename : fallback;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

async function downloadInvoicePdf(orderId) {
  downloadBlob(await apiFetchBlob(apiEndpoints.orders.invoicePdf(orderId)), `invoice-${orderId}.pdf`);
}

async function downloadOrderSummaryPdf(orderId) {
  downloadBlob(await apiFetchBlob(apiEndpoints.orders.summaryPdf(orderId)), `order-${orderId}-summary.pdf`);
}

// The order's one document: the invoice once dispatch has issued it, the order summary before.
// Who may download it, and when there is none, is lib/policy's call.
export function OrderDocumentButton({ order, className }) {
  const { role } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!can(role, "downloadPdf", order)) return null;
  const invoice = Boolean(order.invoice_number);

  async function download() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await (invoice ? downloadInvoicePdf(order.id) : downloadOrderSummaryPdf(order.id));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={download} disabled={busy} className={className}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 flex-none">
        <path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {busy ? "Preparing…" : failed ? "Download failed, retry" : invoice ? "Invoice PDF" : "Order summary PDF"}
    </button>
  );
}

// The money: what the order is worth, what has come in and what is still owed, as three equal
// figures. Owed turns maroon only when something is owed.
export function MoneySummary({ order }) {
  const total = order.grand_total ?? order.total_amount;
  const pending = Number(order.pending_amount) || 0;
  const cell = "min-w-0 bg-white px-4 py-3";
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
      <div className={cell}>
        <p className="text-xs text-muted">Order total</p>
        <p className="mt-1 truncate text-xl font-semibold tabular-nums text-ink">{formatCurrency(total)}</p>
      </div>
      <div className={cell}>
        <p className="text-xs text-muted">Received</p>
        <p className="mt-1 truncate text-xl font-semibold tabular-nums text-ink">{formatCurrency(order.amount_paid ?? 0)}</p>
      </div>
      <div className={cell}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted">Still owed</p>
          <Pill tone={PAYMENT_TONE[order.payment_status] || PAYMENT_TONE.CREDIT}>
            {PAYMENT_LABEL[order.payment_status] || "On credit"}
          </Pill>
        </div>
        <p className={`mt-1 truncate text-xl font-semibold tabular-nums ${pending > 0 ? "text-[#5e0b26]" : "text-muted"}`}>
          {formatCurrency(pending)}
        </p>
      </div>
    </div>
  );
}

// When, and by whom, the order reached each step: the latest entry for a status, because a
// declined rider sends the order back and it reaches "Accepted" again. "Placed" is the first
// entry instead, since later notes on a pending order (cash collected) are not its placing.
// The steps across the desk: a bar per step, its label, when and by whom. (Phones use
// OrderProgress in OrderCards.)
export function ProgressStrip({ order }) {
  // A delivered order has no step in progress: every step shows done.
  const steps = orderProgress(order).map((step) => (order.status === "DELIVERED" ? { ...step, current: false } : step));
  return (
    <ol className="grid rounded-lg border border-line bg-white px-4 py-4" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Order progress">
      {steps.map((step, index) => (
        <li key={step.status} aria-current={step.current ? "step" : undefined} className="relative min-w-0 pr-3">
          {/* The line to the next step: solid once that step is reached. */}
          {index < steps.length - 1 ? (
            <span aria-hidden="true" className={`absolute left-6 right-0 top-[11px] h-0.5 ${steps[index + 1].done ? "bg-ink" : "bg-line"}`} />
          ) : null}
          <span
            aria-hidden="true"
            className={`relative flex size-6 items-center justify-center rounded-full text-white ${
              step.current ? "bg-[#5e0b26] ring-4 ring-[#5e0b26]/15" : step.done ? "bg-ink" : "border-2 border-line bg-white"
            }`}
          >
            {step.done && !step.current ? (
              <svg viewBox="0 0 16 16" className="size-3.5"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            ) : step.current ? (
              <span className="size-2 rounded-full bg-white" />
            ) : null}
          </span>
          <p className={`mt-2.5 truncate text-sm ${step.done ? "font-semibold text-ink" : "text-muted"}`}>{step.label}</p>
          <p className="truncate text-xs tabular-nums text-muted">{step.entry ? formatDateTime(step.entry.created_at) : "Not yet"}</p>
          {step.entry?.changed_by_name ? <p className="truncate text-xs text-muted">by {step.entry.changed_by_name}</p> : null}
        </li>
      ))}
    </ol>
  );
}

// Who and where, as a grid of label-over-value cells, three to a row. The shop opens its screen.
export function Facts({ order }) {
  const place = [order.retailer_city, order.retailer_state].filter(Boolean).join(", ");
  const shop = order.to_entity_id
    ? <Link href={`/app/retailers/${order.to_entity_id}`} className="hover:underline">{order.retailer_name}</Link>
    : order.retailer_name;
  const rows = [
    ["Shop", order.retailer_name && shop, place],
    ["Salesman", order.salesman_name, order.salesman_phone],
    ["Rider", order.delivery_driver_name],
    ["Beat", order.beat_name],
    ["Warehouse", order.warehouse_name, order.warehouse_state],
    ["GSTIN", order.retailer_gst_number],
    ["Channel", order.channel === "ONLINE" ? "Online store" : "Offline"],
  ].filter(([, value]) => value);
  // Blank cells finish the last row, so the grid's hairlines never show through as grey blocks.
  const blanks = (3 - (rows.length % 3)) % 3;
  return (
    <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
      {rows.map(([label, value, sub]) => (
        <div key={label} className="min-w-0 bg-white px-4 py-3">
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="mt-0.5 truncate text-sm font-medium text-ink">{value}</dd>
          {sub ? <dd className="truncate text-xs text-muted">{sub}</dd> : null}
        </div>
      ))}
      {Array.from({ length: blanks }, (_, index) => <div key={`blank-${index}`} className="bg-white" />)}
    </dl>
  );
}

export function Lines({ order }) {
  const items = order.items || [];
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-soft text-xs text-muted">
            <th className="h-9 px-4 text-left font-medium">Item</th>
            <th className="h-9 px-3 text-right font-medium">Qty</th>
            <th className="h-9 px-3 text-right font-medium">Rate</th>
            <th className="h-9 px-3 text-right font-medium">Discount</th>
            <th className="h-9 px-4 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-muted">No items on this order.</td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id} className="border-b border-rule transition-colors hover:bg-surface-soft">
                <td className="px-4 py-2.5">
                  <p className="text-ink">{itemName(item)}</p>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{lineQuantity(item)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{lineRate(item)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted">{lineDiscount(item) || "—"}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-ink">{formatCurrency(item.line_total)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {/* Every figure here is the server's (finance.py); none is summed in the browser. */}
      <dl className="ml-auto w-full space-y-1.5 border-t border-line px-4 py-3 text-sm sm:max-w-xs sm:border-t-0">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Taxable value</dt>
          <dd className="tabular-nums">{formatCurrency(order.taxable_value)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">GST</dt>
          <dd className="tabular-nums">{formatCurrency(order.gst_amount)}</dd>
        </div>
        {Number(order.delivery_charge) ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Delivery charge (incl. GST)</dt>
            <dd className="tabular-nums">{formatCurrency(order.delivery_charge)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-semibold text-ink">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatCurrency(order.grand_total ?? order.total_amount)}</dd>
        </div>
      </dl>
    </div>
  );
}

const PAYMENT_MODE_LABEL = { CASH: "Cash", UPI: "UPI", CHEQUE: "Cheque", ONLINE: "Online" };

export function Payments({ order }) {
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

// A timeline, newest first: a dot per entry on one line, what happened and who did it, and when.
export function History({ trails = [] }) {
  if (!trails.length) return <p className="text-sm text-muted">No history recorded.</p>;
  // Latest first, like a stack: the server sends oldest first (created_at, then id).
  const entries = [...trails].reverse();
  return (
    <ol className="rounded-lg border border-line bg-white px-4 py-2">
      {entries.map((trail, index) => (
        <li key={trail.id} className="relative flex gap-3 py-2.5 text-sm">
          {index < entries.length - 1 ? <span aria-hidden="true" className="absolute bottom-[-10px] left-[4.5px] top-[22px] w-px bg-line" /> : null}
          <span aria-hidden="true" className={`relative mt-[6px] size-2.5 shrink-0 rounded-full ${index === 0 ? "bg-[#5e0b26]" : "bg-slate-300"}`} />
          <span className="min-w-0 flex-1">
            <span className="block text-ink">
              {trail.description || STATUS_LABEL[trail.order_status] || trail.order_status}
              {trail.changed_by_name ? <span className="text-muted"> · {trail.changed_by_name}</span> : null}
            </span>
            <span className="block text-xs tabular-nums text-muted">{formatDateTime(trail.created_at)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
