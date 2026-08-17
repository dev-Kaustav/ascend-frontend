"use client";

import { useMemo } from "react";
import { getAccessToken, getRoleFromToken } from "@/lib/auth";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import AccountantDashboard from "@/components/dashboard/AccountantDashboard";
import WarehouseDashboard from "@/components/dashboard/WarehouseDashboard";
import SalesmanDashboard from "@/components/dashboard/SalesmanDashboard";
import DriverDashboard from "@/components/dashboard/DriverDashboard";
import BrandDashboard from "@/components/dashboard/BrandDashboard";

export default function DashboardPage() {
  const role = useMemo(() => getRoleFromToken(getAccessToken()), []);

  if (role === "ADMIN") return <AdminDashboard />;
  if (role === "ACCOUNTANT") return <AccountantDashboard />;
  if (role === "WAREHOUSE_MANAGER") return <WarehouseDashboard />;
  if (role === "SALESMAN") return <SalesmanDashboard />;
  if (role === "DRIVER") return <DriverDashboard />;
  if (role === "BRAND") return <BrandDashboard />;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
      Dashboard not available for this role.
    </div>
  );
}
