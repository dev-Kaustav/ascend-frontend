"use client";

import RoleGuard from "@/components/layout/RoleGuard";
import AppShell from "@/components/layout/AppShell";
import { accountantNav } from "@/lib/navigation";

export default function AccountantLayout({ children }) {
  return (
    <RoleGuard allowedRoles={["ACCOUNTANT", "ADMIN"]}>
      <AppShell navItems={accountantNav} roleLabel="Accountant">
        {children}
      </AppShell>
    </RoleGuard>
  );
}
