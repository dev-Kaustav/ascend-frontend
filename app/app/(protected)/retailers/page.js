"use client";

import MyRetailersPanel from "@/components/workspaces/MyRetailersPanel";
import RetailersWorkspace from "@/components/workspaces/RetailersWorkspace";
import { useAuth } from "@/components/auth/AuthProvider";

export default function RetailersPage() {
  const { role } = useAuth();
  if (role !== "SALESMAN") return <RetailersWorkspace />;
  return (
    <div className="space-y-6">
      <MyRetailersPanel />
    </div>
  );
}
