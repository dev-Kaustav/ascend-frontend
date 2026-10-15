"use client";

import { useState } from "react";
import Link from "next/link";
import WorkspaceTabs from "@/components/layout/WorkspaceTabs";
import RetailersPanel from "@/components/workspaces/RetailersPanel";
import RetailerRequestsPanel from "@/components/workspaces/RetailerRequestsPanel";
import RetailerBeatsPanel from "@/components/workspaces/RetailerBeatsPanel";
import RetailCoveragePanel from "@/components/workspaces/RetailCoveragePanel";
import OutstandingPanel from "@/components/workspaces/OutstandingPanel";
import CashCollectionPanel from "@/components/workspaces/CashCollectionPanel";
import WarehouseSelector from "@/components/ui/WarehouseSelector";
import { useAuth } from "@/components/auth/AuthProvider";

export default function RetailersWorkspace() {
  const { role } = useAuth();
  const [warehouseId, setWarehouseId] = useState(null);
  const tabs = [
    { key: "directory", label: "Directory", roles: ["ADMIN"], description: "Add and edit retailers, manage contacts, and assign salesmen and beats. Newest retailers appear first.", render: () => <RetailersPanel /> },
    { key: "requests", label: "Requests", roles: ["ADMIN"], description: "Review retailer onboarding requests from the field team.", render: () => <RetailerRequestsPanel /> },
    { key: "beats", label: "Beats", roles: ["ADMIN"], description: "Create coverage beats, then assign retailers from the directory.", render: () => <RetailerBeatsPanel /> },
    { key: "coverage", label: "Coverage", roles: ["ADMIN"], description: "Retailer activity, billing trends, coverage, and top-performing outlets.", render: () => <RetailCoveragePanel /> },
    { key: "outstanding", label: "Outstanding", roles: ["ADMIN", "ACCOUNTANT"], description: "Track retailer balances, recovery, and aging by warehouse.", render: () => <div className="space-y-4"><WarehouseSelector value={warehouseId} onChange={setWarehouseId} /><OutstandingPanel warehouseId={warehouseId} /></div> },
    { key: "collections", label: "Collections", roles: ["ADMIN", "ACCOUNTANT"], description: "Collected payments, receipt trends, and the payment log.", render: () => <CashCollectionPanel /> }
  ];

  return (
    <div className="space-y-4">
      {role === "ADMIN" ? <div className="flex justify-end"><Link href="/app/imports" className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600">Import retailer data</Link></div> : null}
      <WorkspaceTabs title="Retailers" subtitle="Retailer records, onboarding, coverage, outstanding balances, and collections in one workspace." tabs={tabs} />
    </div>
  );
}
