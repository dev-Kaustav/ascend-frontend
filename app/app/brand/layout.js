"use client";

import RoleGuard from "@/components/layout/RoleGuard";
import AppShell from "@/components/layout/AppShell";
import { brandNav } from "@/lib/navigation";

export default function BrandLayout({ children }) {
  return (
    <RoleGuard allowedRoles={["BRAND"]}>
      <AppShell navItems={brandNav} roleLabel="Brand">
        {children}
      </AppShell>
    </RoleGuard>
  );
}
