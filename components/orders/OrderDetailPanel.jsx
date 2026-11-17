"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetch, apiFetchBlob, apiFetchCached } from "@/lib/api";
import { getCoords } from "@/lib/geo";
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent, toTitleCase } from "@/lib/format";

import DataTable from "@/components/tables/DataTable";
import InvoiceCell from "@/components/ui/InvoiceCell";
import SalesmanCashCollection from "@/components/orders/SalesmanCashCollection";
import MobileActionBar, {
  BAR_ACTION_PRIMARY,
  BAR_ACTION_SECONDARY,
  BAR_ACTION_DANGER,
} from "@/components/layout/MobileActionBar";
import MobileSheet from "@/components/layout/MobileSheet";
import { useAuth } from "@/components/auth/AuthProvider";

function getOrderDate(order) {
  return order?.created_at || order?.order_date || order?.date || null;
}

function formatTaxes(taxes) {
  if (!taxes || taxes.length === 0) return "—";
  return taxes.map((tax) => `${tax.tax_type} ${formatPercent(tax.rate)}`).join(", ");
}

function InfoTile({ label, value, className = "" }) {
  return (
    <div className={`min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3 ${className}`}>
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900 tabular-nums">{value || "—"}</p>
    </div>
  );
}

function DetailBlock({ title, children }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-950 text-balance">{title}</h3>
      {children}
    </section>
  );
}

const STATUS_BADGE = {
  PENDING: "bg-slate-100 text-slate-700",
  READY_TO_SHIP: "bg-sky-50 text-sky-700 border border-sky-200",
  DRIVER_ASSIGNED: "bg-violet-50 text-violet-700 border border-violet-200",
  OUT_FOR_DELIVERY: "bg-amber-50 text-amber-700 border border-amber-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  RETURNED: "bg-orange-50 text-orange-700 border border-orange-200",
  CANCELLED: "bg-rose-50 text-rose-700 border border-rose-200",
};

const STATUS_TEXT = { DRIVER_ASSIGNED: "Awaiting Rider" };

function StatusBadge({ status }) {
  const cls = STATUS_BADGE[status] || "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest ${cls}`}>
      {STATUS_TEXT[status] || toTitleCase(status)}
    </span>
  );
}

function OrderTrailTimeline({ trails }) {
  if (!trails?.length) return null;
  return (
    <DetailBlock title="Order Trail">
      <div className="relative ml-1.5 border-l-2 border-slate-200 pl-5">
        {trails.map((trail, i) => {
          const isLast = i === trails.length - 1;
          return (
            <div key={trail.id} className={isLast ? "pb-0" : "pb-5"}>
              <div className="absolute -left-[5px] mt-0.5 h-2.5 w-2.5 rounded-full ring-4 ring-white" style={{
                backgroundColor: isLast ? "#1a1b2e" : "#10b981",
              }} />
              <div className="flex items-start justify-between gap-3">
                <StatusBadge status={trail.order_status} />
                <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">
                  {formatDateTime(trail.created_at)}
                </span>
              </div>
              {trail.description && (
                <p className="mt-1 text-xs text-slate-500">{trail.description}</p>
              )}
              {trail.changed_by_name && (
                <p className="mt-0.5 text-xs italic text-slate-400">by {trail.changed_by_name}</p>
              )}
            </div>
          );
        })}
      </div>
    </DetailBlock>
  );
}

const ACTION_CONFIG = {
  PENDING: {
    primary: { label: "Accept Order", nextStatus: "READY_TO_SHIP" },
    cancel: true,
  },
  READY_TO_SHIP: {
    primary: { label: "Assign Rider", nextStatus: "DRIVER_ASSIGNED", showDriver: true },
    cancel: true,
  },
  // The rider accepting is the pickup: stock leaves and the invoice is issued. Admin can
  // record it on the rider's behalf.
  DRIVER_ASSIGNED: {
    primary: { label: "Accept & Pick Up", adminLabel: "Mark Picked Up", nextStatus: "OUT_FOR_DELIVERY" },
    back: { nextStatus: "READY_TO_SHIP" },
    cancel: true,
  },
  OUT_FOR_DELIVERY: {
    primary: { label: "Mark Delivered", nextStatus: "DELIVERED", showPayment: true },
    cancel: true,
  },
  DELIVERED: {
    cancel: true,
  },
};

const ROLE_ACTIONS = {
  ADMIN: ["PENDING", "READY_TO_SHIP", "DRIVER_ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED"],
  WAREHOUSE_MANAGER: ["PENDING", "READY_TO_SHIP"],
  DRIVER: ["DRIVER_ASSIGNED", "OUT_FOR_DELIVERY"],
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
  DRIVER_ASSIGNED: new Set(["ADMIN", "WAREHOUSE_MANAGER", "RETAILER"]),
  OUT_FOR_DELIVERY: new Set(["ADMIN", "DRIVER"]),
  DELIVERED: new Set(["ADMIN"]),
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
// DRIVER_ASSIGNED -> READY_TO_SHIP: the rider declines, or the warehouse takes the order
// back to give it to someone else. Same transition, named for who is doing it.
const BACK_LABEL_BY_ROLE = {
  DRIVER: "Decline",
  WAREHOUSE_MANAGER: "Unassign Rider",
  ADMIN: "Unassign Rider",
};

function roleNeedsDriverList(role) {
  return (ROLE_ACTIONS[role] || []).some((status) => ACTION_CONFIG[status]?.primary?.showDriver);
}

export function OrderActionBar({ order, role, drivers, onUpdate, secondaryActions = null }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [backSheetOpen, setBackSheetOpen] = useState(false);
  // An error describes the inputs that were submitted; once they change it no longer applies.
  useEffect(() => setError(""), [form]);

  const config = ACTION_CONFIG[order.status] || {};
  const allowedStatuses = ROLE_ACTIONS[role] || [];
  const canPrimary = config.primary && allowedStatuses.includes(order.status);
  const canCancel = config.cancel && (CANCEL_ROLES_BY_STATUS[order.status]?.has(role) ?? false);
  const backLabel = config.back ? BACK_LABEL_BY_ROLE[role] : null;
  const primaryLabel = canPrimary ? (role === "ADMIN" && config.primary.adminLabel) || config.primary.label : null;
  // Two transitions cannot be a single tap: "Assign Rider" is rejected without a rider, and
  // "Mark Delivered" carries cash collection. Those open the sheet instead of submitting
  // straight from the bar.
  const needsInput = Boolean(canPrimary && (config.primary.showDriver || config.primary.showPayment));

  async function submitAction(nextStatus) {
    setSaving(true);
    setError("");
    try {
      const body = { status: nextStatus };
      if (nextStatus === "DRIVER_ASSIGNED") {
        if (!form.driverId) {
          setError("Please select a rider.");
          setSaving(false);
          return;
        }
        body.delivery_driver_id = Number(form.driverId);
      }
      if (order.status === "DRIVER_ASSIGNED" && nextStatus === "READY_TO_SHIP" && form.reason?.trim()) {
        body.reason = form.reason.trim();
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
      setBackSheetOpen(false);
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
            value={form.driverId || ""}
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

  const reasonInput = (
    <input
      type="text"
      maxLength={200}
      value={form.reason || ""}
      onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
      placeholder="Reason (optional)"
      aria-label="Reason"
      className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm"
    />
  );

  return (
    <>
      {/* Desktop: the next step as one quiet panel: its inputs, one near-black primary, the
          way back as a secondary, and cancelling as a red text action at the far end. */}
      {(canPrimary || canCancel || backLabel) && (
        <div className="hidden lg:block">
          <div className="space-y-3 rounded-lg border border-line bg-white p-4">
            {canPrimary && (config.primary.showDriver || config.primary.showPayment) ? (
              <div className="max-w-md space-y-2">{renderInputs()}</div>
            ) : null}
            {backLabel && <div className="max-w-md">{reasonInput}</div>}
            <div className="flex flex-wrap items-center gap-2">
              {canPrimary && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => submitAction(config.primary.nextStatus)}
                  className="h-9 cursor-pointer rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60"
                >
                  {saving ? "Saving…" : primaryLabel}
                </button>
              )}
              {backLabel && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => submitAction(config.back.nextStatus)}
                  className="h-9 cursor-pointer rounded-md border border-control bg-white px-4 text-sm font-medium text-ink hover:bg-raised disabled:opacity-60"
                >
                  {backLabel}
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

      {/* Phones: the same actions pinned in the thumb zone. secondaryActions keeps a bar
          present for roles with no transitions at all (a salesman sees only Invoice PDF),
          so the primary control never scrolls out of reach. */}
      <MobileActionBar notice={error ? <p className="text-xs text-rose-500">{error}</p> : null}>
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
        {backLabel && (
          <button
            type="button"
            disabled={saving}
            onClick={() => setBackSheetOpen(true)}
            className={BAR_ACTION_SECONDARY}
          >
            {backLabel}
          </button>
        )}
        {!canPrimary && secondaryActions}
        {canCancel && (
          <button
            type="button"
            disabled={saving}
            onClick={() => submitAction("CANCELLED")}
            className={BAR_ACTION_DANGER}
          >
            {cancelLabel}
          </button>
        )}
      </MobileActionBar>

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

      {backLabel && (
        <MobileSheet open={backSheetOpen} title={backLabel} onClose={() => setBackSheetOpen(false)}>
          {reasonInput}
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <button
            type="button"
            disabled={saving}
            onClick={() => submitAction(config.back.nextStatus)}
            className={`${BAR_ACTION_PRIMARY} w-full`}
          >
            {saving ? "Saving…" : backLabel}
          </button>
        </MobileSheet>
      )}
    </>
  );
}

// Loads one order and, for roles that can assign one, the riders to choose from. Shared by this
// panel (phones and the field roles) and the desktop order desk.
export function useOrderDetail(orderId, role) {
  const [order, setOrder] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState("");

  async function loadOrder() {
    if (!orderId) return;
    setLoading(true);
    try {
      const [response, driversResponse] = await Promise.all([
        apiFetch(apiEndpoints.orders.detail(orderId)),
        roleNeedsDriverList(role)
          ? apiFetchCached(apiEndpoints.admin.drivers, { ttl: 60000 }).catch(() => [])
          : Promise.resolve([]),
      ]);
      setOrder(response);
      setDrivers(driversResponse || []);
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load order details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
  }, [orderId, role]);

  return { order, drivers, loading, error, reload: loadOrder };
}

export async function downloadInvoicePdf(orderId) {
  const { blob, filename } = await apiFetchBlob(apiEndpoints.orders.invoicePdf(orderId));
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `invoice-${orderId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function OrderDetailPanel({ orderId, onClose, onOrderUpdate }) {
  const [downloading, setDownloading] = useState(false);
  const { role } = useAuth();
  const { order, drivers, loading, error, reload: loadOrder } = useOrderDetail(orderId, role);

  function handleOrderUpdate() {
    loadOrder();
    onOrderUpdate?.();
  }

  async function downloadInvoice() {
    if (!orderId || downloading) return;
    setDownloading(true);
    try {
      await downloadInvoicePdf(orderId);
    } finally {
      setDownloading(false);
    }
  }

  const itemColumns = useMemo(
    () => [
      {
        header: "SKU",
        accessorKey: "sku_code",
        cell: ({ row }) =>
          row.original.sku_code || row.original.sku_name || `SKU ${row.original.sku_id}`
      },
      {
        header: "HSN",
        accessorKey: "hsn_code",
        cell: ({ row }) => row.original.hsn_code || "—"
      },
      {
        header: "Qty",
        accessorKey: "quantity",
        meta: { type: "number" },
        cell: ({ row }) => formatNumber(row.original.quantity)
      },
      {
        header: "MRP",
        accessorKey: "unit_price",
        meta: { type: "number" },
        cell: ({ row }) => formatCurrency(row.original.unit_price)
      },
      {
        header: "Discount",
        accessorKey: "discount_amount",
        meta: { type: "number" },
        cell: ({ row }) => formatCurrency(row.original.discount_amount || 0)
      },
      {
        header: "Taxable",
        accessorKey: "taxable_value",
        meta: { type: "number" },
        cell: ({ row }) => formatCurrency(row.original.taxable_value)
      },
      {
        header: "GST",
        accessorKey: "gst_amount",
        meta: { type: "number" },
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="font-semibold text-slate-700 tabular-nums">{formatCurrency(row.original.gst_amount)}</p>
            <p className="text-xs text-slate-400">{formatTaxes(row.original.taxes)}</p>
          </div>
        )
      },
      {
        header: "Final",
        accessorKey: "line_total",
        meta: { type: "number" },
        cell: ({ row }) => formatCurrency(row.original.line_total)
      }
    ],
    []
  );

  if (!orderId) return null;

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading order details...</div>;
  }

  if (error) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">{error}</div>;
  }

  if (!order) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Order not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">{formatDate(getOrderDate(order))}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950 text-balance">Order #{order.id}</h2>
          <div className="mt-1.5 flex items-center gap-2">
            <StatusBadge status={order.status} />
            <InvoiceCell invoiceNumber={order.invoice_number} status={order.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* An invoice is issued at dispatch; before that the PDF endpoint 404s. */}
          {order.invoice_number ? (
            <button
              type="button"
              onClick={downloadInvoice}
              disabled={downloading}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {downloading ? "Preparing..." : "Invoice PDF"}
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>

      {role === "SALESMAN" && order.can_collect_cash ? <SalesmanCashCollection key={order.id} order={order} onRecorded={handleOrderUpdate} /> : null}

      {/* Two-up on phones: these values are short ("Credit", "-", a rupee amount), so one
          per row turned eight facts into eight screens' worth of scrolling. Long values
          span the full width. */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <InfoTile label="Retailer" value={order.retailer_name || order.to_entity_id} className="col-span-2 xl:col-span-1" />
        <InfoTile label="Warehouse" value={[order.warehouse_name, order.warehouse_state].filter(Boolean).join(", ")} className="col-span-2 xl:col-span-1" />
        <InfoTile label="Payment" value={toTitleCase(order.payment_status || "CREDIT")} />
        <InfoTile label="Pending" value={formatCurrency(order.pending_amount)} />
        <InfoTile label="Beat" value={order.beat_name} />
        <InfoTile label="Driver" value={order.delivery_driver_name} />
        <InfoTile label="Retailer GSTIN" value={order.retailer_gst_number} className="col-span-2 xl:col-span-1" />
        <InfoTile label="Grand Total" value={formatCurrency(order.grand_total || order.total_amount)} className="col-span-2 xl:col-span-1" />
      </div>

      <OrderTrailTimeline trails={order.trails} />

      <OrderActionBar
        order={order}
        role={role}
        drivers={drivers}
        onUpdate={handleOrderUpdate}
        // Roles with no status transitions (ROLE_ACTIONS.SALESMAN is []) still get a bar,
        // so the one thing they came for does not scroll away with the header.
        secondaryActions={
          role === "SALESMAN" && order.can_collect_cash ? <a href={`#order-cash-${order.id}`} className={BAR_ACTION_PRIMARY}>Record collected cash</a> :
          !order.invoice_number ? null :
          <button
            type="button"
            onClick={downloadInvoice}
            disabled={downloading}
            className={BAR_ACTION_PRIMARY}
          >
            {downloading ? "Preparing..." : "Invoice PDF"}
          </button>
        }
      />

      <DetailBlock title="Line Items">
        <DataTable
          columns={itemColumns}
          data={order.items || []}
          emptyLabel="No line items on this order."
          tableClassName="min-w-[1100px]"
        />
      </DetailBlock>

      <DetailBlock title="Totals">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoTile label="Taxable" value={formatCurrency(order.taxable_value)} />
          <InfoTile label="GST" value={formatCurrency(order.gst_amount)} />
          <InfoTile label="Subtotal" value={formatCurrency(order.subtotal)} />
          <InfoTile label="Grand Total" value={formatCurrency(order.grand_total)} />
        </div>
      </DetailBlock>

      <DetailBlock title="Payments">
        {order.payments?.length ? (
          <div className="space-y-2">
            {order.payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">{formatCurrency(payment.amount)}</p>
                  <p className="truncate text-xs text-slate-500">{payment.transaction_reference?.startsWith("SALESMAN-CASH-") ? `${toTitleCase(payment.payment_mode || "CASH")} collected by salesman` : payment.transaction_reference || "Transaction"}</p>
                </div>
                <p className="shrink-0 text-xs text-slate-500">{formatDate(payment.created_at)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-400">
            No payment history available.
          </div>
        )}
      </DetailBlock>

      <DetailBlock title="Credit Notes">
        {order.credit_notes?.length ? (
          <div className="space-y-2">
            {order.credit_notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{note.credit_note_number}</p>
                <p className="text-xs text-slate-500">{formatNumber(note.items?.length || 0)} items</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-400">
            No credit notes linked to this order.
          </div>
        )}
      </DetailBlock>
    </div>
  );
}
