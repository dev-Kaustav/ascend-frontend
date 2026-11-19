"use client";

import dynamic from "next/dynamic";
import { useAuth } from "@/components/auth/AuthProvider";

// One chunk per role: a rider's phone downloads the rider's dashboard, not the admin's charts.
const AdminDashboard = dynamic(() => import("@/components/dashboard/AdminDashboard"));
const AccountantDashboard = dynamic(() => import("@/components/dashboard/AccountantDashboard"));
const WarehouseDashboard = dynamic(() => import("@/components/dashboard/WarehouseDashboard"));
const SalesmanDashboard = dynamic(() => import("@/components/dashboard/SalesmanDashboard"));
const DriverDashboard = dynamic(() => import("@/components/dashboard/DriverDashboard"));
const BrandDashboard = dynamic(() => import("@/components/dashboard/BrandDashboard"));

export default function DashboardPage() {
  const { role } = useAuth();

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
