"use client";

import RoleGuard from "@/components/layout/RoleGuard";
import AppShell from "@/components/layout/AppShell";
import { getAccessToken, getRoleFromToken } from "@/lib/auth";
import { getNavForRole, getRoleLabel } from "@/lib/navigation";

export default function ProfileLayout({ children }) {
  const token = getAccessToken();
  const role = getRoleFromToken(token);
  const navItems = getNavForRole(role);
  const roleLabel = getRoleLabel(role);

  return (
    <RoleGuard>
      <AppShell navItems={navItems} roleLabel={roleLabel}>
        {children}
      </AppShell>
    </RoleGuard>
  );
}
