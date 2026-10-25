"use client";

import { useCallback, useEffect, useState } from "react";
import { FileDown, MapPin } from "lucide-react";
import { apiEndpoints, apiFetch, apiFetchBlob } from "@/lib/api";
import { formatDate, toTitleCase } from "@/lib/format";
import FieldSection from "@/components/field/FieldSection";
import MobileActionBar, { BAR_ACTION_PRIMARY } from "@/components/layout/MobileActionBar";
import SalesmanCashCollection from "@/components/orders/SalesmanCashCollection";

// The salesman's order screen, read like an app: who and what first, then the bill, then money,
// then the small print. Same card and type scale as the new-order screen (components/field).

const rupees = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatRupee = (value) => `₹${rupees.format(Number(value) || 0)}`;

const STATUS_STYLE = {
  PENDING: "bg-slate-100 text-slate-700",
  READY_TO_SHIP: "bg-sky-50 text-sky-700",
  OUT_FOR_DELIVERY: "bg-amber-50 text-amber-800",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  RETURNED: "bg-orange-50 text-orange-700",
  CANCELLED: "bg-rose-50 text-rose-700"
};
const STATUS_LABEL = { READY_TO_SHIP: "Ready to ship", OUT_FOR_DELIVERY: "On the road" };
const statusLabel = (status) => STATUS_LABEL[status] || toTitleCase(status || "");

const packOf = (item) => {
  const size = Number(item.units_per_pack) > 0 ? Number(item.units_per_pack) : 1;
  return { size, unit: size > 1 ? item.pack_type || "pack" : "pc" };
};
// "3 ladi" when the quantity is whole packs, "3 ladi + 4 pcs" when it is not, "40 pcs" by the piece.
const formatQuantity = (item) => {
  const { size, unit } = packOf(item);
  const quantity = Number(item.quantity) || 0;
  if (size === 1) return `${quantity} pcs`;
  const packs = Math.floor(quantity / size);
  const loose = quantity - packs * size;
  return [packs ? `${packs} ${unit}` : null, loose ? `${loose} pcs` : null].filter(Boolean).join(" + ") || "0";
};

export default function SalesmanOrderDetail({ orderId }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await apiFetch(apiEndpoints.orders.detail(orderId)));
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load this order.");
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function downloadInvoice() {
    if (downloading) return;
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

  if (error) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div>;
  }
  if (!order) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading order…</div>;
  }

  const items = order.items || [];
  const mrpTotal = items.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
  const discountTotal = items.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0);
  const received = (order.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const deliveryCharge = Number(order.delivery_charge) || 0;
  const address = [order.retailer_address_line1, order.retailer_city].filter(Boolean).join(", ");
  const details = [
    ["Invoice", order.invoice_number],
    ["Warehouse", order.warehouse_name],
    ["Driver", order.delivery_driver_name],
    ["Beat", order.beat_name],
    ["Shop GSTIN", order.retailer_gst_number]
  ].filter(([, value]) => value);

  const row = (label, value, className = "text-slate-600") => (
    <div key={label} className={`flex items-baseline justify-between gap-3 ${className}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {/* Who, when, where it stands */}
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
          <p className="text-base font-semibold tabular-nums text-slate-900">{formatRupee(order.grand_total)}</p>
        </div>
      </FieldSection>

      {/* Items first: it is what the shopkeeper asks about. */}
      <FieldSection title="Items" meta={`${items.length} item${items.length === 1 ? "" : "s"}`}>
        <ul className="divide-y divide-slate-100">
          {items.map((item) => {
            const { size, unit } = packOf(item);
            const perPiece = (Number(item.line_total) || 0) / (Number(item.quantity) || 1);
            return (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug text-slate-900">{item.sku_name || `SKU ${item.sku_id}`}</p>
                  <p className="text-xs tabular-nums text-slate-500">
                    {formatQuantity(item)}
                    {size > 1 ? ` · ${item.quantity} pcs` : ""} · {formatRupee(perPiece * size)} / {unit}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatRupee(item.line_total)}</p>
              </li>
            );
          })}
        </ul>
      </FieldSection>

      <FieldSection title="Bill summary">
        <dl className="space-y-1.5 text-sm">
          {row("MRP total", formatRupee(mrpTotal))}
          {row("Discount", `− ${formatRupee(discountTotal)}`, "text-emerald-700")}
          {deliveryCharge ? row("Delivery", formatRupee(deliveryCharge)) : null}
          {row("GST (included)", formatRupee(order.gst_amount), "text-slate-400")}
        </dl>
        <div className="border-t border-dashed border-slate-300" />
        <dl className="space-y-1.5 text-sm">
          {row("Order total", formatRupee(order.grand_total), "text-base font-semibold text-slate-900")}
          {received ? row("Received", `− ${formatRupee(received)}`) : null}
          {row(Number(order.pending_amount) > 0 ? "Balance due" : "Fully paid", formatRupee(order.pending_amount), "font-semibold text-slate-700")}
        </dl>
      </FieldSection>

      {/* Money: record a collection, and what has come in so far. */}
      {order.can_collect_cash || order.payments?.length ? (
        <FieldSection title="Payments">
          {order.can_collect_cash ? <SalesmanCashCollection key={order.id} order={order} onRecorded={load} /> : null}
          {order.payments?.length ? (
            <ul className="divide-y divide-slate-100">
              {order.payments.map((payment) => (
                <li key={payment.id} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0 text-sm">
                  <span className="text-slate-600">
                    {toTitleCase(payment.payment_mode || "Payment")} · {formatDate(payment.created_at)}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">{formatRupee(payment.amount)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </FieldSection>
      ) : null}

      {details.length ? (
        <FieldSection title="Details">
          <dl className="space-y-1.5 text-sm">
            {details.map(([label, value]) => row(label, value, "text-slate-600 [&>dd]:font-semibold [&>dd]:text-slate-900"))}
          </dl>
        </FieldSection>
      ) : null}

      {order.trails?.length ? (
        <FieldSection title="Timeline">
          <ol className="space-y-3">
            {order.trails.map((trail, index) => (
              <li key={trail.id} className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${index === order.trails.length - 1 ? "bg-slate-900" : "bg-emerald-500"}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{statusLabel(trail.order_status)}</p>
                    <p className="shrink-0 text-xs tabular-nums text-slate-400">{formatDate(trail.created_at)}</p>
                  </div>
                  {trail.description || trail.changed_by_name ? (
                    <p className="text-xs text-slate-500">
                      {[trail.description, trail.changed_by_name ? `by ${trail.changed_by_name}` : null].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </FieldSection>
      ) : null}

      {/* The invoice exists only once the order is dispatched; until then there is nothing to download. */}
      {order.invoice_number ? (
        <>
          <div className="hidden justify-end lg:flex">
            <button type="button" onClick={downloadInvoice} disabled={downloading} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-60">
              <FileDown className="h-4 w-4" />
              {downloading ? "Preparing…" : "Invoice PDF"}
            </button>
          </div>
          <MobileActionBar>
            <button type="button" onClick={downloadInvoice} disabled={downloading} className={`${BAR_ACTION_PRIMARY} gap-2`}>
              <FileDown className="h-4 w-4" />
              {downloading ? "Preparing…" : "Invoice PDF"}
            </button>
          </MobileActionBar>
        </>
      ) : null}
    </div>
  );
}
