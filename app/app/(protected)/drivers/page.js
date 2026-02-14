"use client";

import { useMemo } from "react";
import { getAccessToken, getRoleFromToken } from "@/lib/auth";
import AdminDrivers from "@/components/drivers/AdminDrivers";
import WarehouseDrivers from "@/components/drivers/WarehouseDrivers";

export default function DriversPage() {
  const role = useMemo(() => getRoleFromToken(getAccessToken()), []);

  if (role === "ADMIN") return <AdminDrivers />;
  if (role === "WAREHOUSE_MANAGER") return <WarehouseDrivers />;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
      Drivers not available for this role.
    </div>
  );
}
