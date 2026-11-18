"use client";

import { useState } from "react";
import Link from "next/link";
import WorkspaceTabs from "@/components/layout/WorkspaceTabs";
import RetailersPanel from "@/components/workspaces/RetailersPanel";
// Approval workflow disabled — salesmen create retailers directly. Uncomment with the tab below to restore.
// import RetailerRequestsPanel from "@/components/workspaces/RetailerRequestsPanel";
import RetailerBeatsPanel from "@/components/workspaces/RetailerBeatsPanel";
import RetailCoveragePanel from "@/components/workspaces/RetailCoveragePanel";
import OutstandingPanel from "@/components/workspaces/OutstandingPanel";
import WarehouseSelector from "@/components/ui/WarehouseSelector";
import { useAuth } from "@/components/auth/AuthProvider";

export default function RetailersWorkspace() {
  const { role } = useAuth();
  const [warehouseId, setWarehouseId] = useState(null);
  const tabs = [
    { key: "directory", label: "Directory", roles: ["ADMIN"], description: "Add and edit retailers, manage contacts, and assign salesmen and beats. Newest retailers appear first.", render: () => <RetailersPanel /> },
    // { key: "requests", label: "Requests", roles: ["ADMIN"], description: "Review retailer onboarding requests from the field team.", render: () => <RetailerRequestsPanel /> },
    { key: "beats", label: "Beats", roles: ["ADMIN"], description: "Expand beats to see their retailers, edit beat details, or create a new beat.", render: () => <RetailerBeatsPanel /> },
    { key: "coverage", label: "Coverage", roles: ["ADMIN"], description: "Retailer activity, billing trends, coverage, and top-performing outlets.", render: () => <RetailCoveragePanel /> },
    { key: "outstanding", label: "Outstanding", roles: ["ADMIN", "ACCOUNTANT"], description: "Track retailer balances, recovery, and aging by warehouse.", render: () => <div className="space-y-4"><WarehouseSelector value={warehouseId} onChange={setWarehouseId} /><OutstandingPanel warehouseId={warehouseId} /></div> }
  ];

  return (
    <WorkspaceTabs
      title="Retailers"
      subtitle="Shops we supply: their details, beats, coverage, and what they owe."
      tabs={tabs}
      actions={
        role === "ADMIN" ? (
          <Link href="/app/imports" className="inline-flex h-9 items-center rounded-md border border-control bg-white px-3 text-sm font-medium text-ink hover:bg-raised">
            Import retailer data
          </Link>
        ) : null
      }
    />
  );
}
