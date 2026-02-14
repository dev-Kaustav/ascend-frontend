"use client";

import { useMemo } from "react";
import { getAccessToken, getRoleFromToken } from "@/lib/auth";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import AccountantDashboard from "@/components/dashboard/AccountantDashboard";
import WarehouseDashboard from "@/components/dashboard/WarehouseDashboard";
import BrandDashboard from "@/components/dashboard/BrandDashboard";
import RetailerDashboard from "@/components/dashboard/RetailerDashboard";

export default function DashboardPage() {
  const role = useMemo(() => getRoleFromToken(getAccessToken()), []);

  if (role === "ADMIN") return <AdminDashboard />;
  if (role === "ACCOUNTANT") return <AccountantDashboard />;
  if (role === "WAREHOUSE_MANAGER") return <WarehouseDashboard />;
  if (role === "BRAND") return <BrandDashboard />;
  if (role === "RETAILER") return <RetailerDashboard />;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
      Dashboard not available for this role.
    </div>
  );
}
