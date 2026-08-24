"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { getAccessToken, getDashboardPathForRole, getRoleFromToken } from "@/lib/auth";
import { getWorkspaceRuleForPath } from "@/lib/workspaceRoutes";
import { getNavForRole, getRoleLabel } from "@/lib/navigation";

export default function AccessLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = getAccessToken();
  const role = getRoleFromToken(token);
  const navItems = useMemo(() => getNavForRole(role), [role]);
  const roleLabel = getRoleLabel(role);
  const workspaceRule = useMemo(() => getWorkspaceRuleForPath(pathname), [pathname]);
  const dashboardPath = getDashboardPathForRole(role);

  const allowed = Boolean(workspaceRule?.roles.includes(role));

  // A role with no reachable workspace would otherwise redirect to its own
  // dashboard path and land right back here, never allowed — an infinite
  // "Checking access..." loop. Once we're already at that path and still
  // not allowed, stop redirecting and show a terminal state instead (D7).
  const noWorkspaceAvailable = !allowed && pathname === dashboardPath;

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!allowed && !noWorkspaceAvailable) {
      router.replace(dashboardPath);
    }
  }, [token, allowed, noWorkspaceAvailable, dashboardPath, router]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Checking access...
      </div>
    );
  }

  if (noWorkspaceAvailable) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        No workspace is available for this account yet.
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Checking access...
      </div>
    );
  }

  return (
    <AppShell navItems={navItems} roleLabel={roleLabel}>
      {children}
    </AppShell>
  );
}
