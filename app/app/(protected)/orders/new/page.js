"use client";

import { Suspense } from "react";

import OrderForm from "@/components/orders/OrderForm";
import { useAuth } from "@/components/auth/AuthProvider";
import { can } from "@/lib/policy";

export default function OrderCreatePage() {
  const { role } = useAuth();

  // OrderForm reads ?retailer= (the Order button on a retailer card) via useSearchParams.
  if (can(role, "createOrder")) return <Suspense fallback={null}><OrderForm /></Suspense>;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
      Order creation not available for this role.
    </div>
  );
}
