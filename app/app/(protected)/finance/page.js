"use client";

import { useState } from "react";
import WorkspaceTabs from "@/components/layout/WorkspaceTabs";
import WarehouseSelector from "@/components/ui/WarehouseSelector";
import AccountingPanel from "@/components/workspaces/AccountingPanel";
import InvoicesPanel from "@/components/workspaces/InvoicesPanel";
import CreditNotesPanel from "@/components/workspaces/CreditNotesPanel";
import DailySalesPanel from "@/components/workspaces/DailySalesPanel";

export default function FinanceWorkspacePage() {
  const [warehouseId, setWarehouseId] = useState(null);

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      description: "Accounting summary, payment status, and financial health at a glance.",
      roles: ["ADMIN", "ACCOUNTANT"],
      render: () => <AccountingPanel warehouseId={warehouseId} />
    },
    {
      key: "invoices",
      label: "Invoices",
      description: "Invoice totals, payment state, and order-to-invoice tracking.",
      roles: ["ADMIN", "ACCOUNTANT"],
      render: () => <InvoicesPanel warehouseId={warehouseId} />
    },
    {
      key: "credit-notes",
      label: "Credit Notes",
      description: "Issued credits and adjustments grouped with finance operations.",
      roles: ["ADMIN", "ACCOUNTANT"],
      render: () => <CreditNotesPanel warehouseId={warehouseId} />
    },
    {
      key: "daily-sales",
      label: "Daily Sales",
      description: "Daily sales summary with salesman-level delivery and cancellation breakdown.",
      roles: ["ADMIN", "ACCOUNTANT"],
      render: () => <DailySalesPanel warehouseId={warehouseId} />
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <WarehouseSelector value={warehouseId} onChange={setWarehouseId} />
      </div>
      <WorkspaceTabs
        title="Finance"
        subtitle="Accounting, invoices, credits, and daily sales."
        tabs={tabs}
      />
    </div>
  );
}
