"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, getDashboardPathForRole, getRoleFromToken } from "@/lib/auth";

export default function AppIndex() {
  const router = useRouter();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const role = getRoleFromToken(token);
    router.replace(getDashboardPathForRole(role));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
      Redirecting…
    </div>
  );
}
