"use client";

import RoleGuard from "@/components/layout/RoleGuard";
import AppShell from "@/components/layout/AppShell";
import { adminNav } from "@/lib/navigation";

export default function AdminLayout({ children }) {
  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <AppShell navItems={adminNav} roleLabel="Admin">
        {children}
      </AppShell>
    </RoleGuard>
  );
}
