"use client";

import { useEffect, useState } from "react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { getCoords } from "@/lib/geo";
import { can, cancelLabel as cancelLabelFor, nextStep } from "@/lib/policy";
import MobileActionBar, { BAR_ACTION_DANGER, BAR_ACTION_PRIMARY } from "@/components/layout/MobileActionBar";
import MobileSheet from "@/components/layout/MobileSheet";

// A rider or payment field: thumb-sized in the phone sheet, desk-sized in the desktop row.
const FIELD =
  "min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm lg:h-9 lg:min-h-0 lg:rounded-md lg:border-control lg:py-0";

// Narrower than the primary, never flex-1, so the next step keeps most of the bar.
const BAR_ACTION_MORE =
  "inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-60";

// The next step on an order, for whoever is looking at it (lib/policy decides which).
// At a desk it is one quiet panel; on a phone it is pinned in the thumb zone, with cancelling and
// anything in `moreActions` (the PDF) behind "More". `fallback` fills the bar for a role with no
// step to take (a salesman's PDF and cash collection).
export default function OrderActionBar({ order, role, drivers, onUpdate, fallback = null, moreActions = null }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // An error describes the inputs that were submitted; once they change it no longer applies.
  useEffect(() => setError(""), [form]);

  const step = nextStep(role, order);
  const canPrimary = Boolean(step);
  const canCancel = can(role, "cancel", order);
  const hasMore = canCancel || Boolean(moreActions);
  const primaryLabel = step?.label || null;
  // An order sent back to Accepted when the pickup step was removed keeps its rider: offer them.
  const driverId = form.driverId ?? (order.delivery_driver_id ? String(order.delivery_driver_id) : "");
  // Two transitions cannot be a single tap: sending out is rejected without a rider, and
  // "Mark Delivered" carries cash collection. Those open the sheet instead of submitting
  // straight from the bar.
  const needsInput = Boolean(step?.needs);

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
        {step.needs === "rider" && (
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-slate-500">Rider</span>
            <select
              value={driverId}
              onChange={(e) => setForm((prev) => ({ ...prev, driverId: e.target.value }))}
              className={FIELD}
            >
              <option value="">Select rider</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
        )}
        {step.needs === "payment" && order.pending_amount === 0 && (
          <p className="text-sm text-emerald-700">Already paid — nothing to collect.</p>
        )}
        {step.needs === "payment" && order.pending_amount !== 0 && (
          <div className="grid gap-2 sm:grid-cols-3">
            {order.pending_amount != null && (
              <p className="text-sm text-slate-600 sm:col-span-3">To collect: {formatCurrency(order.pending_amount)}</p>
            )}
            <select
              value={form.paymentStatus || ""}
              onChange={(e) => setForm((prev) => ({ ...prev, paymentStatus: e.target.value }))}
              className={FIELD}
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
                  className={FIELD}
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
                    className={FIELD}
                  />
                )}
              </>
            )}
          </div>
        )}
      </>
    );
  }

  const cancelLabel = cancelLabelFor(order);

  return (
    <>
      {/* Desktop: the next step as one row: its inputs, one dark primary, and cancelling as a
          quiet action at the far end. */}
      {(canPrimary || canCancel) && (
        <div className="hidden lg:block">
          <div className="rounded-lg border border-line bg-white p-4">
            <p className="mb-3 text-xs font-medium text-muted">Next step</p>
            {/* A rider fits beside the button; the payment fields take their own row above it. */}
            {step?.needs === "payment" ? <div className="mb-3 max-w-xl">{renderInputs()}</div> : null}
            <div className="flex flex-wrap items-end gap-3">
              {step?.needs === "rider" ? <div className="w-64">{renderInputs()}</div> : null}
              {canPrimary && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => submitAction(step.nextStatus)}
                  className="h-9 cursor-pointer rounded-md bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60"
                >
                  {saving ? "Saving…" : primaryLabel}
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => submitAction("CANCELLED")}
                  className="ml-auto h-9 cursor-pointer rounded-md px-3 text-sm font-medium text-[#b42318] transition-colors hover:bg-rose-50 disabled:opacity-60"
                >
                  {cancelLabel}
                </button>
              )}
            </div>
            {error && <p className="mt-2 text-sm text-[#c4242a]">{error}</p>}
          </div>
        </div>
      )}

      {/* Phones: the next step pinned in the thumb zone at full width. Cancelling sits behind
          "More", two taps away, so a slip of the thumb next to the primary cannot cancel an order. */}
      <MobileActionBar notice={error && !moreOpen ? <p className="text-xs text-rose-500">{error}</p> : null}>
        {canPrimary && (
          <button
            type="button"
            disabled={saving}
            onClick={() => (needsInput ? setSheetOpen(true) : submitAction(step.nextStatus))}
            className={BAR_ACTION_PRIMARY}
          >
            {saving ? "Saving…" : primaryLabel}
          </button>
        )}
        {!canPrimary && fallback}
        {hasMore && (
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
        {moreActions}
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
          onClick={() => submitAction(step.nextStatus)}
          className={`${BAR_ACTION_PRIMARY} w-full`}
        >
          {saving ? "Saving…" : primaryLabel}
        </button>
      </MobileSheet>

    </>
  );
}
