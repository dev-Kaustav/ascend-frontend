"use client";

import {  } from "react";

import AdminOrders from "@/components/orders/AdminOrders";
import AccountantOrders from "@/components/orders/AccountantOrders";
import WarehouseOrders from "@/components/orders/WarehouseOrders";
import SalesmanOrders from "@/components/orders/SalesmanOrders";
import DriverOrders from "@/components/orders/DriverOrders";
import { useAuth } from "@/components/auth/AuthProvider";

export default function OrdersPage() {
  const { role } = useAuth();

  if (role === "ADMIN") return <AdminOrders />;
  if (role === "ACCOUNTANT") return <AccountantOrders />;
  if (role === "WAREHOUSE_MANAGER") return <WarehouseOrders />;
  if (role === "SALESMAN") return <SalesmanOrders />;
  if (role === "DRIVER") return <DriverOrders />;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
      Orders not available for this role.
    </div>
  );
}
