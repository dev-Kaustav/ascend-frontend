"use client";

import RoleGuard from "@/components/layout/RoleGuard";
import AppShell from "@/components/layout/AppShell";
import { retailerNav } from "@/lib/navigation";

export default function RetailerLayout({ children }) {
  return (
    <RoleGuard allowedRoles={["RETAILER"]}>
      <AppShell navItems={retailerNav} roleLabel="Retailer">
        {children}
      </AppShell>
    </RoleGuard>
  );
}
