"use client";

import RoleGuard from "@/components/layout/RoleGuard";
import AppShell from "@/components/layout/AppShell";
import { warehouseNav } from "@/lib/navigation";

export default function WarehouseLayout({ children }) {
  return (
    <RoleGuard allowedRoles={["WAREHOUSE_MANAGER", "ADMIN"]}>
      <AppShell navItems={warehouseNav} roleLabel="Warehouse">
        {children}
      </AppShell>
    </RoleGuard>
  );
}
