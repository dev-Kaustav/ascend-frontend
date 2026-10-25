"use client";

import { useParams } from "next/navigation";
import OrderDetailPanel from "@/components/orders/OrderDetailPanel";
import SalesmanOrderDetail from "@/components/orders/SalesmanOrderDetail";
import { useAuth } from "@/components/auth/AuthProvider";

export default function AdminOrderDetail() {
  const params = useParams();
  const orderId = params?.orderId;
  const { role } = useAuth();

  // Salesmen get the app-style screen; every other role keeps the full ops panel.
  if (role === "SALESMAN") return <SalesmanOrderDetail orderId={orderId} />;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <OrderDetailPanel orderId={orderId} />
    </div>
  );
}
