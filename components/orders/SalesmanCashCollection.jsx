"use client";

import { useRef, useState } from "react";
import { Banknote } from "lucide-react";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/components/ui/ToastProvider";

export default function SalesmanCashCollection({ order, onRecorded }) {
  const [amount, setAmount] = useState("");
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
    if (!request.current) request.current = { amount, collection_id: crypto.randomUUID() };
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
      notify("Cash recorded. The order balance has been updated.");
      onRecorded();
    } catch (err) {
      if (err.status >= 400 && err.status < 500) {
        request.current = null;
        setUncertain(false);
        setError(err.message || "Unable to record cash.");
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

  return (
    <section id={`order-cash-${order.id}`} className="scroll-mt-28 rounded-2xl border border-emerald-200 bg-white p-4 sm:p-5" aria-labelledby={`cash-title-${order.id}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Banknote className="size-5" aria-hidden="true" /></span>
        <div><h3 id={`cash-title-${order.id}`} className="text-lg font-semibold">Record collected cash</h3><p className="mt-1 text-sm text-slate-500">Outstanding: <strong className="tabular-nums text-slate-900">{formatCurrency(order.pending_amount)}</strong></p></div>
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-slate-700" htmlFor={`cash-amount-${order.id}`}>Cash collected (₹)</label>
        <input id={`cash-amount-${order.id}`} type="number" inputMode="decimal" min="0.01" max={order.pending_amount} step="0.01" required value={amount} readOnly={saving || uncertain} onChange={(event) => setAmount(event.target.value)} aria-describedby={`cash-hint-${order.id}`} className="min-h-12 w-full rounded-xl border border-slate-200 px-4 text-base tabular-nums" placeholder="Enter amount received" />
        <p id={`cash-hint-${order.id}`} className="text-sm text-slate-500">This immediately records a cash payment against this order.</p>
        {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
        <button type="submit" disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-base font-semibold text-white disabled:opacity-60"><Banknote className="size-5" aria-hidden="true" />{saving ? "Recording…" : uncertain ? "Retry collection" : "Record cash payment"}</button>
      </form>
    </section>
  );
}
