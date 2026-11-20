"use client";

import dayjs from "dayjs";
import { MapPin } from "lucide-react";
import { formatCurrency, formatDate, formatDateTime, toTitleCase } from "@/lib/format";
import { itemName, lineDiscount, lineQuantity, lineRate } from "@/lib/orderLines";
import { orderProgress, statusLabel } from "@/lib/orderStatus";
import FieldSection from "@/components/field/FieldSection";

// The order, read like an app: one card per question (who and where it stands, what is on it, what
// it costs, what has been paid, the small print, what happened). OrderScreen stacks them for every
// role on a phone. Every figure is the server's (finance.py); none is added up here.

const STATUS_STYLE = {
  PENDING: "bg-amber-50 text-amber-800",
  READY_TO_SHIP: "bg-amber-50 text-amber-800",
  DRIVER_ASSIGNED: "bg-slate-100 text-slate-700",
  OUT_FOR_DELIVERY: "bg-sky-50 text-sky-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  RETURNED: "bg-orange-50 text-orange-700",
  CANCELLED: "bg-rose-50 text-rose-700",
};

function Row({ label, value, className = "text-slate-600" }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${className}`}>
      <dt>{label}</dt>
      <dd className="min-w-0 truncate text-right tabular-nums">{value}</dd>
    </div>
  );
}

/** Shop and address, where the order stands, its number, date and total. */
export function OrderHeaderCard({ order }) {
  const address = [order.retailer_address_line1, order.retailer_city].filter(Boolean).join(", ");
  return (
    <FieldSection>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-900">{order.retailer_name || "Retailer"}</p>
          {address ? (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span className="truncate">{address}</span>
            </p>
          ) : null}
        </div>
        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[order.status] || STATUS_STYLE.PENDING}`}>
          {statusLabel(order.status)}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-3">
        <p className="text-sm text-slate-500">
          Order #{order.id} · {formatDate(order.created_at)}
        </p>
        <p className="text-base font-semibold tabular-nums text-slate-900">{formatCurrency(order.grand_total)}</p>
      </div>
    </FieldSection>
  );
}

// The day the order was placed is in the header; a step on that day needs only its time.
function stepWhen(value, placed) {
  if (formatDate(value) === formatDate(placed)) return dayjs(value).format("HH:mm");
  return dayjs(value).format("D MMM HH:mm");
}

/** The four steps across in one row: dot, label, time. Who moved it is in the timeline. */
export function OrderProgress({ order }) {
  const steps = orderProgress(order);
  return (
    <ol className="grid grid-cols-4 rounded-2xl border border-slate-200 bg-white px-1 py-3" aria-label="Order progress">
      {steps.map((step, index) => (
        <li key={step.status} aria-current={step.current ? "step" : undefined} className="relative flex min-w-0 flex-col items-center px-1 text-center">
          {index < steps.length - 1 ? (
            <span aria-hidden="true" className={`absolute left-1/2 top-[5px] h-px w-full ${steps[index + 1].done ? "bg-slate-900" : "bg-slate-200"}`} />
          ) : null}
          <span
            aria-hidden="true"
            className={`relative h-2.5 w-2.5 rounded-full ${step.done ? (step.current ? "bg-[#5e0b26]" : "bg-slate-900") : "border border-slate-300 bg-white"}`}
          />
          <span className={`mt-1.5 text-xs leading-tight ${step.current ? "font-semibold text-slate-900" : step.done ? "text-slate-700" : "text-slate-400"}`}>
            {step.label}
          </span>
          <span className="mt-0.5 text-[11px] tabular-nums text-slate-400">
            {step.entry ? stepWhen(step.entry.created_at, order.created_at) : "—"}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Each line as its name and amount, with "3 ladi × ₹96.00" under it. */
export function OrderItemsCard({ order }) {
  const items = order.items || [];
  return (
    <FieldSection title="Items" meta={`${items.length} item${items.length === 1 ? "" : "s"}`}>
      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug text-slate-900">{itemName(item)}</p>
              <p className="text-xs tabular-nums text-slate-500">
                {lineQuantity(item)} × {lineRate(item)}
                {lineDiscount(item) ? ` · ${lineDiscount(item)} off` : ""}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(item.line_total)}</p>
          </li>
        ))}
      </ul>
    </FieldSection>
  );
}

/** The bill as the shop reads it: MRP, discount, delivery, total, what came in and what is due. */
export function OrderBillCard({ order }) {
  const pending = Number(order.pending_amount) || 0;
  return (
    <FieldSection title="Bill summary">
      <dl className="space-y-1.5 text-sm">
        <Row label="MRP total" value={formatCurrency(order.mrp_total)} />
        {Number(order.discount_total) ? <Row label="Discount" value={`− ${formatCurrency(order.discount_total)}`} className="text-emerald-700" /> : null}
        {Number(order.delivery_charge) ? <Row label="Delivery" value={formatCurrency(order.delivery_charge)} /> : null}
        <Row label="GST (included)" value={formatCurrency(order.gst_amount)} className="text-slate-400" />
      </dl>
      <div className="border-t border-dashed border-slate-300" />
      <dl className="space-y-1.5 text-sm">
        <Row label="Order total" value={formatCurrency(order.grand_total)} className="text-base font-semibold text-slate-900" />
        {Number(order.amount_paid) ? <Row label="Received" value={`− ${formatCurrency(order.amount_paid)}`} /> : null}
        <Row label={pending > 0 ? "Balance due" : "Fully paid"} value={formatCurrency(pending)} className={`font-semibold ${pending > 0 ? "text-[#5e0b26]" : "text-slate-700"}`} />
      </dl>
    </FieldSection>
  );
}

/** Money received against the order. `collect` is the salesman's cash form, when they may use it. */
export function OrderPaymentsCard({ order, collect = null }) {
  const payments = order.payments || [];
  if (!collect && !payments.length) return null;
  return (
    <FieldSection title="Payments">
      {collect}
      {payments.length ? (
        <ul className="divide-y divide-slate-100">
          {payments.map((payment) => (
            <li key={payment.id} className="flex items-baseline justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
              <span className="text-slate-600">
                {toTitleCase(payment.payment_mode || "Payment")} · {formatDate(payment.created_at)}
              </span>
              <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(payment.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </FieldSection>
  );
}

/** The small print: invoice, people, beat, warehouse, GSTIN, channel. Rows with no value drop out. */
export function OrderDetailsCard({ order }) {
  const rows = [
    ["Invoice", order.invoice_number],
    ["Salesman", [order.salesman_name, order.salesman_phone].filter(Boolean).join(" · ")],
    ["Rider", order.delivery_driver_name],
    ["Beat", order.beat_name],
    ["Warehouse", order.warehouse_name],
    ["Shop GSTIN", order.retailer_gst_number],
    ["Channel", order.channel === "ONLINE" ? "Online store" : null],
  ].filter(([, value]) => value);
  if (!rows.length) return null;
  return (
    <FieldSection title="Details">
      <dl className="space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <Row key={label} label={label} value={value} className="text-slate-600 [&>dd]:font-semibold [&>dd]:text-slate-900" />
        ))}
      </dl>
    </FieldSection>
  );
}

/** Credit notes raised against the order's invoice. */
export function OrderCreditNotesCard({ order }) {
  const notes = order.credit_notes || [];
  if (!notes.length) return null;
  return (
    <FieldSection title="Credit notes">
      <ul className="divide-y divide-slate-100">
        {notes.map((note) => (
          <li key={note.id} className="flex items-baseline justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
            <span className="min-w-0 truncate font-semibold text-slate-900">{note.credit_note_number}</span>
            <span className="shrink-0 text-xs text-slate-500">{formatDate(note.created_at)}</span>
          </li>
        ))}
      </ul>
    </FieldSection>
  );
}

/** What happened, latest first like a stack: the top entry is where the order is now. */
export function OrderTimelineCard({ order }) {
  const trails = order.trails || [];
  if (!trails.length) return null;
  return (
    <FieldSection title="Timeline">
      <ol className="space-y-3">
        {[...trails].reverse().map((trail, index) => (
          <li key={trail.id} className="flex items-start gap-3">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${index === 0 ? "bg-slate-900" : "bg-slate-300"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{trail.description || statusLabel(trail.order_status)}</p>
                <p className="shrink-0 text-xs tabular-nums text-slate-400">{formatDateTime(trail.created_at)}</p>
              </div>
              {trail.changed_by_name ? <p className="text-xs text-slate-500">by {trail.changed_by_name}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </FieldSection>
  );
}
