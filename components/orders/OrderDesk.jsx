"use client";

import { formatDate } from "@/lib/format";
import { useAuth } from "@/components/auth/AuthProvider";
import { OrderActionBar, useOrderDetail } from "@/components/orders/OrderDetailPanel";
import {
  Facts,
  History,
  Lines,
  MoneySummary,
  OrderDocumentButton,
  Payments,
  ProgressStrip,
  Section,
  StatusPill,
} from "@/components/orders/OrderSections";

// The desktop view of one order, opened from the orders queue. One question: "where is this order,
// and what is the next step?" The progress strip answers the first, the action panel the second;
// everything else (the shop, the lines, the money, the history) follows in reading order.
// Phones and the field roles get OrderDetailPanel, built from the same sections.

export default function OrderDesk({ orderId, onClose, onOrderUpdate }) {
  const { role } = useAuth();
  const { order, drivers, loading, error, reload } = useOrderDetail(orderId, role);

  function handleUpdate() {
    reload();
    onOrderUpdate?.();
  }

  if (!orderId) return null;
  if (loading && !order) return <p className="p-6 text-sm text-muted">Loading order #{orderId}…</p>;
  if (error && !order) return <p className="p-6 text-sm text-[#c4242a]">{error}</p>;
  if (!order) return <p className="p-6 text-sm text-muted">Order not found.</p>;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-semibold text-ink">Order #{order.id}</h2>
            <StatusPill status={order.status} />
          </div>
          <p className="mt-1 truncate text-sm text-muted">
            {order.retailer_name || "Unknown shop"} · placed {formatDate(order.created_at)}
            {order.invoice_number ? ` · invoice ${order.invoice_number}` : " · invoice not issued yet"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <OrderDocumentButton
            order={order}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-control bg-white px-3 text-sm font-medium text-ink hover:bg-raised disabled:opacity-60"
          />
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

      <MoneySummary order={order} />

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
