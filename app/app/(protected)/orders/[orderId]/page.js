"use client";

import { useParams } from "next/navigation";
import OrderDetailPanel from "@/components/orders/OrderDetailPanel";

export default function AdminOrderDetail() {
  const params = useParams();
  const orderId = params?.orderId;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <OrderDetailPanel orderId={orderId} />
    </div>
  );
}
