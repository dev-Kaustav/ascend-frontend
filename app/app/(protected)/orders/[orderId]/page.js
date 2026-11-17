"use client";

import { useParams } from "next/navigation";
import OrderDesk from "@/components/orders/OrderDesk";
import OrderDetailPanel from "@/components/orders/OrderDetailPanel";
import SalesmanOrderDetail from "@/components/orders/SalesmanOrderDetail";
import { useAuth } from "@/components/auth/AuthProvider";
import useIsDesktop from "@/lib/hooks/useIsDesktop";

const OFFICE_ROLES = new Set(["ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER"]);

export default function AdminOrderDetail() {
  const params = useParams();
  const orderId = params?.orderId;
  const { role } = useAuth();
  const isDesktop = useIsDesktop();

  // Salesmen get the app-style screen; the office roles get the order desk at a desk; everyone
  // else, and every phone, keeps the full ops panel.
  if (role === "SALESMAN") return <SalesmanOrderDetail orderId={orderId} />;
  if (isDesktop === null) return null;
  if (isDesktop && OFFICE_ROLES.has(role)) {
    return (
      <div className="mx-auto max-w-[880px]">
        <OrderDesk orderId={orderId} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <OrderDetailPanel orderId={orderId} />
    </div>
  );
}
