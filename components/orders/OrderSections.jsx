"use client";

import { useState } from "react";
import { apiEndpoints, apiFetchBlob } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatCount, formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { ORDER_STEPS, PAYMENT_LABEL, PAYMENT_TONE, STATUS_LABEL, STATUS_TONE } from "@/lib/orderStatus";

// The pieces of one order's screen, shared by the desktop order desk and the phone panel so the
// two read the same. Each is laid out for a 390px phone first; the sm: rules restore the desk.

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

export async function downloadInvoicePdf(orderId) {
  downloadBlob(await apiFetchBlob(apiEndpoints.orders.invoicePdf(orderId)), `invoice-${orderId}.pdf`);
}

export async function downloadOrderSummaryPdf(orderId) {
  downloadBlob(await apiFetchBlob(apiEndpoints.orders.summaryPdf(orderId)), `order-${orderId}-summary.pdf`);
}

// The roles /orders/{id}/invoice.pdf and /summary.pdf serve; a rider would only get a 403.
const PDF_ROLES = new Set(["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALESMAN"]);

// The order's one document: the invoice once dispatch has issued it, the order summary before.
// A cancelled order that never shipped has neither.
export function OrderDocumentButton({ order, className }) {
  const { role } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!PDF_ROLES.has(role)) return null;
  if (!order.invoice_number && order.status === "CANCELLED") return null;
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

// The money first: what the order is worth and what is still owed. On a phone the total takes
// the full first row and the two smaller figures share the second.
export function MoneySummary({ order }) {
  const total = order.grand_total ?? order.total_amount;
  const pending = Number(order.pending_amount) || 0;
  return (
    <div className="grid grid-cols-2 rounded-lg border border-line bg-white sm:grid-cols-3">
      <div className="col-span-2 border-b border-line px-4 py-3 sm:col-span-1 sm:border-b-0 sm:border-r">
        <p className="text-[13px] text-muted">Order total</p>
        <p className="mt-0.5 text-[28px] font-bold leading-tight tabular-nums text-ink">{formatCurrency(total)}</p>
      </div>
      <div className="border-r border-line px-4 py-3">
        <p className="text-[13px] text-muted">Received</p>
        <p className="mt-1.5 text-lg tabular-nums text-ink">{formatCurrency(order.amount_paid ?? 0)}</p>
      </div>
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
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

// The header already gives the day the order was placed; a step on that day needs only its time.
function stepWhen(value, placed) {
  return formatDate(value) === formatDate(placed) ? formatDateTime(value).slice(-5) : formatDateTime(value);
}

// The steps across on the desk; on a phone narrow columns truncate every label, so the same steps
// run down the screen, one line each, with when and by whom on the right.
export function ProgressStrip({ order }) {
  const reached = stepTimes(order.trails);
  const interrupted = order.status === "CANCELLED" || order.status === "RETURNED";
  const currentIndex = ORDER_STEPS.findIndex((step) => step.status === order.status);
  // A rider declining sends the order back a step; the strip shows where it is now, not where it has been.
  const steps = ORDER_STEPS.map((step, index) => ({
    ...step,
    done: !interrupted && index <= currentIndex,
    current: !interrupted && index === currentIndex,
    entry: !interrupted && index <= currentIndex ? reached[step.status] : null,
  }));
  return (
    <>
      <ol className="rounded-lg border border-line bg-white px-4 sm:hidden" aria-label="Order progress">
        {steps.map((step) => (
          <li
            key={step.status}
            aria-current={step.current ? "step" : undefined}
            className="flex items-center gap-3 border-b border-rule py-2.5 text-sm last:border-0"
          >
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 flex-none rounded-full ${step.done ? (step.current ? "bg-data" : "bg-ink") : "border border-control bg-white"}`}
            />
            <span className={`min-w-0 flex-1 truncate ${step.current ? "font-semibold text-ink" : step.done ? "text-ink" : "text-muted"}`}>
              {step.label}
            </span>
            <span className="flex-none text-right text-xs tabular-nums text-muted">
              {step.entry ? stepWhen(step.entry.created_at, order.created_at) : "—"}
              {step.entry?.changed_by_name ? ` · ${step.entry.changed_by_name}` : null}
            </span>
          </li>
        ))}
      </ol>
      <ol className="hidden grid-cols-4 gap-2 sm:grid" aria-label="Order progress">
        {steps.map((step) => (
          <li key={step.status} aria-current={step.current ? "step" : undefined} className="min-w-0">
            <div className={`h-1 rounded-full ${step.done ? (step.current ? "bg-data" : "bg-ink") : "bg-raised"}`} />
            <p className={`mt-2 truncate text-sm ${step.done ? "font-medium text-ink" : "text-muted"}`}>{step.label}</p>
            <p className="truncate text-xs text-muted">{step.entry ? formatDateTime(step.entry.created_at) : "—"}</p>
            {step.entry?.changed_by_name ? <p className="truncate text-xs text-muted">{step.entry.changed_by_name}</p> : null}
          </li>
        ))}
      </ol>
    </>
  );
}

export function Facts({ order }) {
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
    <dl className="grid grid-cols-1 rounded-lg border border-line bg-white px-4 py-1 sm:grid-cols-2 sm:gap-x-6">
      {rows.map(([label, value, sub]) => (
        <div
          key={label}
          className="flex min-w-0 items-baseline justify-between gap-3 border-b border-rule py-2.5 last:border-0 sm:[&:nth-last-child(-n+2)]:border-0"
        >
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

function itemName(item) {
  return item.sku_name || item.sku_code || `SKU ${item.sku_id}`;
}

export function Lines({ order }) {
  const items = order.items || [];
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      {/* Phone: one row per line, name and amount on the first line, the arithmetic under it. */}
      <ul className="px-4 sm:hidden">
        {items.length === 0 ? <li className="py-6 text-center text-sm text-muted">No items on this order.</li> : null}
        {items.map((item) => (
          <li key={item.id} className="border-b border-rule py-3 last:border-0">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <p className="min-w-0 text-ink">{itemName(item)}</p>
              <p className="flex-none font-medium tabular-nums text-ink">{formatCurrency(item.line_total)}</p>
            </div>
            <p className="mt-0.5 text-xs tabular-nums text-muted">
              {formatCount(item.quantity)} × {formatCurrency(item.unit_price)}
              {Number(item.discount_amount) ? ` · ${formatCurrency(item.discount_amount)} off` : ""}
              {item.hsn_code ? ` · HSN ${item.hsn_code}` : ""}
            </p>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-sm sm:table">
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
                  <p className="text-ink">{itemName(item)}</p>
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
        <div className="flex justify-between gap-4 border-t border-line pt-1.5 font-semibold text-ink">
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

export function CreditNotes({ notes = [] }) {
  return (
    <ul className="rounded-lg border border-line bg-white px-4">
      {notes.map((note) => (
        <li key={note.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5 text-sm last:border-0">
          <span className="min-w-0 truncate text-ink">{note.credit_note_number}</span>
          <span className="flex-none text-xs text-muted">
            {formatCount(note.items?.length || 0)} {note.items?.length === 1 ? "item" : "items"} · {formatDate(note.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Newest first. On a phone the time drops under the entry instead of taking a 150px column.
export function History({ trails = [] }) {
  if (!trails.length) return <p className="text-sm text-muted">No history recorded.</p>;
  return (
    <ol className="rounded-lg border border-line bg-white px-4">
      {[...trails].reverse().map((trail) => (
        <li key={trail.id} className="grid grid-cols-1 gap-0.5 border-b border-rule py-2.5 text-sm last:border-0 sm:grid-cols-[9.5rem_1fr] sm:gap-4">
          <span className="order-2 text-xs tabular-nums text-muted sm:order-none sm:text-sm">{formatDateTime(trail.created_at)}</span>
          <span className="min-w-0">
            <span className="text-ink">{trail.description || STATUS_LABEL[trail.order_status] || trail.order_status}</span>
            {trail.changed_by_name ? <span className="text-muted"> · {trail.changed_by_name}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
