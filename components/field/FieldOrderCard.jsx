import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/format";
import { cn } from "@/lib/cn";

export default function FieldOrderCard({ order, children }) {
  const complete = order.status === "DELIVERED";
  const cancelled = order.status === "CANCELLED";
  return (
    <article className="field-order-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500">Order #{order.id}</span>
        <span className={cn("rounded-lg px-2 py-1 text-xs font-semibold", complete ? "bg-emerald-50 text-emerald-800" : cancelled ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700")}>
          {toTitleCase(order.status)}
        </span>
      </div>
      <Link href={`/app/orders/${order.id}`} className="field-order-title">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Package className="size-5" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <strong className="break-words">{order.retailer_name || `Retailer #${order.to_entity_id}`}</strong>
          <small>{order.invoice_number || "View order details"}</small>
        </span>
        <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
      </Link>
      <div className="field-order-summary">
        <span>{formatDate(order.created_at || order.order_date)}</span>
        <strong>{formatCurrency(order.total_amount)}</strong>
      </div>
      {children ? <div className="field-order-actions">{children}</div> : null}
    </article>
  );
}
