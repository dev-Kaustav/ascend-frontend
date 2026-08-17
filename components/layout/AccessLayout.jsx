"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { getAccessToken, getDashboardPathForRole, getRoleFromToken } from "@/lib/auth";
import usePermissions from "@/lib/hooks/usePermissions";
import { getAccessRuleForPath } from "@/lib/accessRules";
import { filterNavByPermissions, getNavForRole, getRoleLabel } from "@/lib/navigation";
import useAccessRules from "@/lib/hooks/useAccessRules";

export default function AccessLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { hasPermission, loading } = usePermissions();
  const { rules, loading: rulesLoading, error: rulesError } = useAccessRules();
  const token = getAccessToken();
  const role = getRoleFromToken(token);

  const navItems = useMemo(() => {
    return filterNavByPermissions(getNavForRole(role), { hasPermission, loading });
  }, [role, hasPermission, loading]);
  const roleLabel = getRoleLabel(role);
  const accessRule = useMemo(() => getAccessRuleForPath(rules, pathname), [rules, pathname]);

  const allowed = useMemo(() => {
    if (!accessRule) return false;
    if (accessRule.roles?.length && !accessRule.roles.includes(role)) return false;
    if (!accessRule.permissions?.length) return true;
    if (loading) return false;
    return accessRule.permissions.every((code) => hasPermission(code));
  }, [accessRule, role, loading, hasPermission]);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }
    if (loading || rulesLoading || rulesError) return;
    if (!allowed) {
      router.replace(getDashboardPathForRole(role));
    }
  }, [token, role, loading, rulesLoading, rulesError, allowed, router]);

  if (!token || loading || rulesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Checking access...
      </div>
    );
  }

  if (rulesError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-rose-600">
        {rulesError}
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
