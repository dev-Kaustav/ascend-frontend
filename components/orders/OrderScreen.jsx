"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import useOrderDetail from "@/lib/hooks/useOrderDetail";
import { can, nextStep } from "@/lib/policy";
import { BAR_ACTION_PRIMARY, BAR_ACTION_SECONDARY } from "@/components/layout/MobileActionBar";
import OrderActionBar from "@/components/orders/OrderActionBar";
import {
  OrderBillCard,
  OrderCreditNotesCard,
  OrderDetailsCard,
  OrderHeaderCard,
  OrderItemsCard,
  OrderPaymentsCard,
  OrderProgress,
  OrderTimelineCard,
} from "@/components/orders/OrderCards";
import { OrderDocumentButton } from "@/components/orders/OrderSections";
import SalesmanCashCollection from "@/components/orders/SalesmanCashCollection";

// One order as an app screen, the same for every role: the cards top to bottom and the next step
// in the thumb zone. What differs by role (the step, cancelling, the PDF, collecting cash) comes
// from lib/policy, not from this file. The office's desk view is OrderDesk.
export default function OrderScreen({ orderId }) {
  const { role } = useAuth();
  const { order, drivers, loading, error, reload } = useOrderDetail(orderId, role);

  if (error && !order) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div>;
  }
  if (loading || !order) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading order…</div>;
  }

  // The PDF fills the bar when the role has no step to take; otherwise it waits under "More".
  const hasStep = Boolean(nextStep(role, order));
  const pdf = (className) => <OrderDocumentButton order={order} className={`${className} gap-2`} />;

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <OrderHeaderCard order={order} />
      <OrderProgress order={order} />
      <OrderItemsCard order={order} />
      <OrderBillCard order={order} />
      <OrderPaymentsCard
        order={order}
        collect={can(role, "collectCash", order) ? <SalesmanCashCollection key={order.id} order={order} onRecorded={reload} /> : null}
      />
      <OrderDetailsCard order={order} />
      <OrderCreditNotesCard order={order} />
      <OrderTimelineCard order={order} />

      {can(role, "downloadPdf", order) ? (
        <div className="hidden justify-end lg:flex">
          <OrderDocumentButton order={order} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-60" />
        </div>
      ) : null}
      <OrderActionBar
        order={order}
        role={role}
        drivers={drivers}
        onUpdate={reload}
        fallback={can(role, "downloadPdf", order) ? pdf(BAR_ACTION_PRIMARY) : null}
        moreActions={hasStep && can(role, "downloadPdf", order) ? pdf(`${BAR_ACTION_SECONDARY} w-full`) : null}
      />
    </div>
  );
}
