"use client";

import {  } from "react";

import AdminOrderCreate from "@/components/orders/AdminOrderCreate";
import AccountantOrderCreate from "@/components/orders/AccountantOrderCreate";
import SalesmanOrderCreate from "@/components/orders/SalesmanOrderCreate";
import { useAuth } from "@/components/auth/AuthProvider";

export default function OrderCreatePage() {
  const { role } = useAuth();

  if (role === "ADMIN") return <AdminOrderCreate />;
  if (role === "ACCOUNTANT") return <AccountantOrderCreate />;
  if (role === "SALESMAN") return <SalesmanOrderCreate />;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
      Order creation not available for this role.
    </div>
  );
}
