"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, getDashboardPathForRole, getRoleFromToken } from "@/lib/auth";

export default function RoleGuard({ allowedRoles, children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const role = getRoleFromToken(token);
    if (allowedRoles && !allowedRoles.includes(role)) {
      router.replace(getDashboardPathForRole(role));
      return;
    }
    setReady(true);
  }, [allowedRoles, router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Checking access…
      </div>
    );
  }

  return children;
}
