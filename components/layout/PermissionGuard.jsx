"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, getDashboardPathForRole, getRoleFromToken } from "@/lib/auth";
import usePermissions from "@/lib/hooks/usePermissions";

export default function PermissionGuard({ required, children }) {
  const router = useRouter();
  const { hasPermission, loading } = usePermissions();
  const requiredList = useMemo(() => (Array.isArray(required) ? required : [required]), [required]);

  const allowed = requiredList.every((code) => hasPermission(code));

  useEffect(() => {
    if (loading) return;
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!allowed) {
      const role = getRoleFromToken(token);
      router.replace(getDashboardPathForRole(role));
    }
  }, [allowed, loading, router]);

  if (loading || !allowed) {
    return (
      <div className="min-h-[240px] flex items-center justify-center text-sm text-slate-500">
        Checking access…
      </div>
    );
  }

  return children;
}
