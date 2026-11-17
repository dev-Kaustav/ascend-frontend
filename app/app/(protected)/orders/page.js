"use client";

import OrdersQueue from "@/components/orders/OrdersQueue";
import WarehouseOrders from "@/components/orders/WarehouseOrders";
import SalesmanOrders from "@/components/orders/SalesmanOrders";
import DriverOrders from "@/components/orders/DriverOrders";
import { useAuth } from "@/components/auth/AuthProvider";
import useIsDesktop from "@/lib/hooks/useIsDesktop";

export default function OrdersPage() {
  const { role } = useAuth();
  const isDesktop = useIsDesktop();

  if (role === "ADMIN" || role === "ACCOUNTANT") return <OrdersQueue role={role} />;
  // The warehouse manager works the same queue at a desk; on a phone the field screen stays.
  if (role === "WAREHOUSE_MANAGER") {
    if (isDesktop === null) return null;
    return isDesktop ? <OrdersQueue role={role} /> : <WarehouseOrders />;
  }
  if (role === "SALESMAN") return <SalesmanOrders />;
  if (role === "DRIVER") return <DriverOrders />;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
      Orders not available for this role.
    </div>
  );
}
