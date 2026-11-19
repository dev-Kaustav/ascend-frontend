"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { invalidateOrders, queryPath } from "@/lib/query";
import { getCoords } from "@/lib/geo";
import { formatCurrency, formatDate } from "@/lib/format";

import {
  CreditNotes,
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
import SalesmanCashCollection from "@/components/orders/SalesmanCashCollection";
import MobileActionBar, {
  BAR_ACTION_PRIMARY,
  BAR_ACTION_DANGER,
} from "@/components/layout/MobileActionBar";

// Narrower than the primary, never flex-1, so the next step keeps most of the bar.
const BAR_ACTION_MORE =
  "inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-60";
import MobileSheet from "@/components/layout/MobileSheet";
import { useAuth } from "@/components/auth/AuthProvider";

const ACTION_CONFIG = {
  PENDING: {
    primary: { label: "Accept Order", nextStatus: "READY_TO_SHIP" },
    cancel: true,
  },
  // One step: pick the rider and the order goes out (stock leaves, invoice issued). There is no
  // separate rider accept/pickup.
  READY_TO_SHIP: {
    primary: { label: "Assign rider & send out", nextStatus: "OUT_FOR_DELIVERY", showDriver: true },
    cancel: true,
  },
  OUT_FOR_DELIVERY: {
    primary: { label: "Mark Delivered", nextStatus: "DELIVERED", showPayment: true },
    cancel: true,
  },
};

const ROLE_ACTIONS = {
  ADMIN: ["PENDING", "READY_TO_SHIP", "OUT_FOR_DELIVERY"],
  WAREHOUSE_MANAGER: ["PENDING", "READY_TO_SHIP"],
  DRIVER: ["OUT_FOR_DELIVERY"],
  RETAILER: [],
  SALESMAN: [],
  ACCOUNTANT: [],
  BRAND: [],
};

// Mirrors the cancel rows of _ALLOWED_TRANSITIONS in
// ascend-backend/app/services/order.py — the backend stays authoritative,
// this only shapes which button is offered.
const CANCEL_ROLES_BY_STATUS = {
  PENDING: new Set(["ADMIN", "RETAILER"]),
  READY_TO_SHIP: new Set(["ADMIN", "WAREHOUSE_MANAGER", "RETAILER"]),
  OUT_FOR_DELIVERY: new Set(["ADMIN", "DRIVER"]),
};

// Whether this role can reach any transition that needs a driver chosen. Derived from
// ROLE_ACTIONS and ACTION_CONFIG rather than hardcoding role names, so granting a role a
// driver-requiring transition automatically grants it the lookup too.
//
// /admin/drivers is restricted to ADMIN and WAREHOUSE_MANAGER, so fetching it for every
// viewer meant a guaranteed 403 on every order a driver, salesman or accountant opened.
// It was swallowed by a .catch, leaving an empty list — harmless only because the roles
// that need the list are exactly the roles allowed to fetch it. That coincidence is not
// something to keep relying on: if a driver-requiring transition were ever granted to
// another role, the select would render empty and submitAction would reject with
// "Please select a driver" and nothing to select.

function roleNeedsDriverList(role) {
  return (ROLE_ACTIONS[role] || []).some((status) => ACTION_CONFIG[status]?.primary?.showDriver);
}

export function OrderActionBar({ order, role, drivers, onUpdate, secondaryActions = null }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // An error describes the inputs that were submitted; once they change it no longer applies.
  useEffect(() => setError(""), [form]);

  const config = ACTION_CONFIG[order.status] || {};
  const allowedStatuses = ROLE_ACTIONS[role] || [];
  const canPrimary = config.primary && allowedStatuses.includes(order.status);
  const canCancel = config.cancel && (CANCEL_ROLES_BY_STATUS[order.status]?.has(role) ?? false);
  const primaryLabel = canPrimary ? config.primary.label : null;
  // An order sent back to Accepted when the pickup step was removed keeps its rider: offer them.
  const driverId = form.driverId ?? (order.delivery_driver_id ? String(order.delivery_driver_id) : "");
  // Two transitions cannot be a single tap: sending out is rejected without a rider, and
  // "Mark Delivered" carries cash collection. Those open the sheet instead of submitting
  // straight from the bar.
  const needsInput = Boolean(canPrimary && (config.primary.showDriver || config.primary.showPayment));

  async function submitAction(nextStatus) {
    setSaving(true);
    setError("");
    try {
      const body = { status: nextStatus };
      if (order.status === "READY_TO_SHIP" && nextStatus === "OUT_FOR_DELIVERY") {
        if (!driverId) {
          setError("Please select a rider.");
          setSaving(false);
          return;
        }
        body.delivery_driver_id = Number(driverId);
      }
      if (nextStatus === "DELIVERED") {
        if (form.paymentStatus) body.payment_status = form.paymentStatus;
        if (form.paymentMode) body.payment_mode = form.paymentMode;
        // "Paid" settles the pending amount server-side; only "Partial" carries an amount.
        if (form.paymentStatus === "PARTIAL" && form.paymentAmount) body.payment_amount = Number(form.paymentAmount);
        // Best-effort, same rule as the driver's order list: a refused or failed location
        // must not block the delivery. Missing coordinates are recorded as missing.
        Object.assign(body, (await getCoords().catch(() => null)) || {});
      }
      await apiFetch(apiEndpoints.orders.updateStatus(order.id), {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setForm({});
      setSheetOpen(false);
      setMoreOpen(false);
      onUpdate();
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  // The driver and payment inputs, rendered identically in the desktop block and in the
  // mobile sheet. Defined once so the two layouts cannot drift apart.
  function renderInputs() {
    if (!canPrimary) return null;
    return (
      <>
        {config.primary.showDriver && (
          <select
            value={driverId}
            onChange={(e) => setForm((prev) => ({ ...prev, driverId: e.target.value }))}
            aria-label="Rider"
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm lg:h-9 lg:min-h-0 lg:rounded-md lg:border-control lg:py-0"
          >
            <option value="">Select rider</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
        {config.primary.showPayment && order.pending_amount === 0 && (
          <p className="text-sm text-emerald-700">Already paid — nothing to collect.</p>
        )}
        {config.primary.showPayment && order.pending_amount !== 0 && (
          <div className="grid gap-2 sm:grid-cols-3">
            {order.pending_amount != null && (
              <p className="text-sm text-slate-600 sm:col-span-3">To collect: {formatCurrency(order.pending_amount)}</p>
            )}
            <select
              value={form.paymentStatus || ""}
              onChange={(e) => setForm((prev) => ({ ...prev, paymentStatus: e.target.value }))}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm"
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
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm"
                >
                  <option value="">Mode</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
                {form.paymentStatus === "PARTIAL" && (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.paymentAmount || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, paymentAmount: e.target.value }))}
                    placeholder={order.pending_amount != null ? `Amount (of ${formatCurrency(order.pending_amount)})` : "Amount"}
                    className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm"
                  />
                )}
              </>
            )}
          </div>
        )}
      </>
    );
  }

  const cancelLabel = order.status === "OUT_FOR_DELIVERY" ? "Refused at Shop" : "Cancel Order";

  return (
    <>
      {/* Desktop: the next step as one quiet panel: its inputs, one primary, and cancelling as
          a red text action at the far end. */}
      {(canPrimary || canCancel) && (
        <div className="hidden lg:block">
          <div className="space-y-3 rounded-lg border border-line bg-white p-4">
            {canPrimary && (config.primary.showDriver || config.primary.showPayment) ? (
              <div className="max-w-md space-y-2">{renderInputs()}</div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {canPrimary && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => submitAction(config.primary.nextStatus)}
                  className={`h-9 cursor-pointer rounded-md px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${order.status === "PENDING" ? "bg-emerald-700 hover:bg-emerald-800 focus-visible:outline-emerald-700" : order.status === "READY_TO_SHIP" ? "bg-sky-700 hover:bg-sky-800 focus-visible:outline-sky-700" : "bg-accent hover:bg-accent-strong focus-visible:outline-ink"}`}
                >
                  {saving ? "Saving…" : primaryLabel}
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => submitAction("CANCELLED")}
                  className="ml-auto h-9 cursor-pointer px-2 text-sm font-medium text-[#c4242a] hover:underline disabled:opacity-60"
                >
                  {cancelLabel}
                </button>
              )}
            </div>
            {error && <p className="text-sm text-[#c4242a]">{error}</p>}
          </div>
        </div>
      )}

      {/* Phones: the next step pinned in the thumb zone at full width. Cancelling sits behind
          "More", two taps away, so a slip of the thumb next to the primary cannot cancel an order. secondaryActions keeps a bar present for roles with no transitions
          at all (a salesman sees Record collected cash). */}
      <MobileActionBar notice={error && !moreOpen ? <p className="text-xs text-rose-500">{error}</p> : null}>
        {canPrimary && (
          <button
            type="button"
            disabled={saving}
            onClick={() => (needsInput ? setSheetOpen(true) : submitAction(config.primary.nextStatus))}
            className={BAR_ACTION_PRIMARY}
          >
            {saving ? "Saving…" : primaryLabel}
          </button>
        )}
        {!canPrimary && secondaryActions}
        {canCancel && (
          <button
            type="button"
            disabled={saving}
            onClick={() => setMoreOpen(true)}
            className={BAR_ACTION_MORE}
          >
            More
          </button>
        )}
      </MobileActionBar>

      <MobileSheet open={moreOpen} title={`Order #${order.id}`} onClose={() => setMoreOpen(false)}>
        {canCancel && (
          <button
            type="button"
            disabled={saving}
            onClick={() => submitAction("CANCELLED")}
            className={`${BAR_ACTION_DANGER} w-full`}
          >
            {saving ? "Saving…" : cancelLabel}
          </button>
        )}
        {error && <p className="text-xs text-rose-500">{error}</p>}
      </MobileSheet>

      <MobileSheet open={sheetOpen} title={primaryLabel || "Confirm"} onClose={() => setSheetOpen(false)}>
        {renderInputs()}
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <button
          type="button"
          disabled={saving}
          onClick={() => submitAction(config.primary.nextStatus)}
          className={`${BAR_ACTION_PRIMARY} w-full`}
        >
          {saving ? "Saving…" : primaryLabel}
        </button>
      </MobileSheet>

    </>
  );
}

// Loads one order and, for roles that can assign one, the riders to choose from. Shared by this
// panel (phones and the field roles) and the desktop order desk.
export function useOrderDetail(orderId, role) {
  const queryClient = useQueryClient();
  const orderQuery = useQuery({ queryKey: queryPath(apiEndpoints.orders.detail(orderId)), enabled: Boolean(orderId) });
  // A failed rider list must not block the order: it shows with an empty rider picker.
  const driversQuery = useQuery({
    queryKey: queryPath(apiEndpoints.admin.drivers),
    enabled: roleNeedsDriverList(role),
    staleTime: 60_000,
  });

  return {
    order: orderQuery.data ?? null,
    drivers: driversQuery.data || [],
    loading: orderQuery.isPending && Boolean(orderId),
    error: orderQuery.error ? orderQuery.error.message || "Unable to load order details." : "",
    // After a status change or a payment: this order and everything it feeds (the lists, the queue
    // counts, the dashboard, what shops owe) refetch.
    reload: () => invalidateOrders(queryClient),
  };
}

// One order on a phone, and for the field roles at any width. Built from the same sections as the
// desktop order desk, stacked: what it is worth, where it is, then the shop, the lines, the money
// and the history. The next step stays pinned in the thumb zone by OrderActionBar.
export default function OrderDetailPanel({ orderId, onClose, onOrderUpdate }) {
  const { role } = useAuth();
  const { order, drivers, loading, error, reload: loadOrder } = useOrderDetail(orderId, role);

  function handleOrderUpdate() {
    loadOrder();
    onOrderUpdate?.();
  }

  if (!orderId) return null;
  if (loading && !order) return <p className="py-6 text-sm text-muted">Loading order #{orderId}…</p>;
  if (error && !order) return <p className="py-6 text-sm text-[#c4242a]">{error}</p>;
  if (!order) return <p className="py-6 text-sm text-muted">Order not found.</p>;

  const lineCount = (order.items || []).length;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="text-xl font-semibold text-ink">Order #{order.id}</h2>
            <StatusPill status={order.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {order.retailer_name || "Unknown shop"} · placed {formatDate(order.created_at)}
          </p>
          <p className="text-sm text-muted">
            {order.invoice_number ? `Invoice ${order.invoice_number}` : "Invoice not issued yet"}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order"
            className="-mr-2 flex h-11 w-11 flex-none items-center justify-center rounded-md text-muted hover:bg-raised hover:text-ink"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </header>

      <div className="space-y-2.5">
        <MoneySummary order={order} />
        <OrderDocumentButton
          order={order}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-control bg-white px-4 text-sm font-medium text-ink hover:bg-raised disabled:opacity-60 sm:h-9 sm:w-auto"
        />
      </div>

      {role === "SALESMAN" && order.can_collect_cash ? <SalesmanCashCollection key={order.id} order={order} onRecorded={handleOrderUpdate} /> : null}

      <Section title="Progress">
        <ProgressStrip order={order} />
      </Section>

      <OrderActionBar
        order={order}
        role={role}
        drivers={drivers}
        onUpdate={handleOrderUpdate}
        // A salesman has no status transitions (ROLE_ACTIONS.SALESMAN is []) but still gets a
        // bar for cash collection. The order's PDF is not repeated here: it sits under the total.
        secondaryActions={
          role === "SALESMAN" && order.can_collect_cash ? <a href={`#order-cash-${order.id}`} className={BAR_ACTION_PRIMARY}>Record collected cash</a> : null
        }
      />

      <Section title="Details">
        <Facts order={order} />
      </Section>

      <Section title="Items" aside={`${lineCount} ${lineCount === 1 ? "line" : "lines"}`}>
        <Lines order={order} />
      </Section>

      <Section title="Payments">
        <Payments order={order} />
      </Section>

      {order.credit_notes?.length ? (
        <Section title="Credit notes">
          <CreditNotes notes={order.credit_notes} />
        </Section>
      ) : null}

      <Section title="History">
        <History trails={order.trails} />
      </Section>
    </div>
  );
}
