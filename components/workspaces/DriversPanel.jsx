"use client";

import {  } from "react";

import AdminDrivers from "@/components/drivers/AdminDrivers";
import WarehouseDrivers from "@/components/drivers/WarehouseDrivers";
import { useAuth } from "@/components/auth/AuthProvider";

export default function DriversPage() {
  const { role } = useAuth();

  if (role === "ADMIN") return <AdminDrivers />;
  if (role === "WAREHOUSE_MANAGER") return <WarehouseDrivers />;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
      Drivers not available for this role.
    </div>
  );
}
