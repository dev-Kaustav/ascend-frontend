"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/components/ui/ToastProvider";
import { FIELD_CONTROL } from "@/components/field/FieldSection";

export default function SalesmanCashCollection({ order, onRecorded }) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("CASH");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const request = useRef(null);
  const submitting = useRef(false);
  const { notify } = useToast();

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > Number(order.pending_amount)) {
      setError("Enter an amount greater than zero and no more than the outstanding balance.");
      return;
    }
    if (!request.current) request.current = { amount, payment_mode: mode, collection_id: crypto.randomUUID() };
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      await apiFetch(apiEndpoints.orders.cashCollections(order.id), {
        method: "POST",
        body: JSON.stringify(request.current)
      });
      request.current = null;
      setAmount("");
      setUncertain(false);
      notify("Payment saved. The order balance has been updated.");
      onRecorded();
    } catch (err) {
      if (err.status >= 400 && err.status < 500) {
        request.current = null;
        setUncertain(false);
        setError(err.message || "Unable to save the payment.");
      } else {
        // A lost response may follow a successful write. Retry the same collection ID.
        setUncertain(true);
        setError("Could not confirm the payment. Retry this collection to check it safely.");
      }
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  // Received | Mode, the same two columns as the new-order screen's payment card, then Submit.
  // Both fields lock while a submit is unconfirmed, so a retry resends exactly the same payment.
  const locked = saving || uncertain;
  return (
    <form id={`order-cash-${order.id}`} onSubmit={submit} className="space-y-3" aria-label="Record a payment">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-500">Received</span>
          <span className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400">₹</span>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              max={order.pending_amount}
              step="0.01"
              required
              value={amount}
              readOnly={locked}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
              className={`${FIELD_CONTROL} pl-7 text-right tabular-nums`}
            />
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-500">Mode</span>
          <span className="relative">
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              disabled={locked}
              className={`${FIELD_CONTROL} cursor-pointer appearance-none pr-9 font-semibold`}
            >
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CHEQUE">Cheque</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </span>
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-rose-600">{error}</p>
      ) : (
        <p className="text-xs text-slate-500">Balance due {formatCurrency(order.pending_amount)}.</p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="h-11 w-full cursor-pointer rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Submitting…" : uncertain ? "Retry" : "Submit"}
      </button>
    </form>
  );
}
