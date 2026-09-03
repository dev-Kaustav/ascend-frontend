"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { getDashboardPathForRole } from "@/lib/auth";
import { getWorkspaceRuleForPath } from "@/lib/workspaceRoutes";
import { getNavForRole, getRoleLabel } from "@/lib/navigation";

function Notice({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export default function AccessLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  // From context, resolved in an effect. Reading the token during render happened on the
  // server too, where it is always null, so the server rendered "Checking access..." while
  // the browser rendered the whole app — a guaranteed hydration mismatch on every page.
  const { status, token, role } = useAuth();

  const navItems = useMemo(() => getNavForRole(role), [role]);
  const roleLabel = getRoleLabel(role);
  const workspaceRule = useMemo(() => getWorkspaceRuleForPath(pathname), [pathname]);
  const dashboardPath = getDashboardPathForRole(role);

  const resolved = status !== "loading";
  const allowed = Boolean(workspaceRule?.roles.includes(role));

  // A role with no reachable workspace would otherwise redirect to its own
  // dashboard path and land right back here, never allowed — an infinite
  // "Checking access..." loop. Once we're already at that path and still
  // not allowed, stop redirecting and show a terminal state instead (D7).
  const noWorkspaceAvailable = resolved && !allowed && pathname === dashboardPath;

  useEffect(() => {
    // Nothing to decide until the token has actually been read.
    if (!resolved) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!allowed && !noWorkspaceAvailable) {
      router.replace(dashboardPath);
    }
  }, [resolved, token, allowed, noWorkspaceAvailable, dashboardPath, router]);

  // The server renders this branch, and so does the browser's first render, so the two
  // agree and React can hydrate cleanly.
  if (!resolved) {
    return <Notice>Checking access...</Notice>;
  }

  if (!token) {
    return <Notice>Checking access...</Notice>;
  }

  if (noWorkspaceAvailable) {
    return <Notice>No workspace is available for this account yet.</Notice>;
  }

  if (!allowed) {
    return <Notice>Checking access...</Notice>;
  }

  return (
    <AppShell navItems={navItems} roleLabel={roleLabel}>
      {children}
    </AppShell>
  );
}
