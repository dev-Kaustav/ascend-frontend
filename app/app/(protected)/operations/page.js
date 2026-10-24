"use client";

import WorkspaceTabs from "@/components/layout/WorkspaceTabs";
import InventoryPanel from "@/components/workspaces/InventoryPanel";
import StockLedgerPanel from "@/components/workspaces/StockLedgerPanel";
import DriversPanel from "@/components/workspaces/DriversPanel";
import SalesmenPanel from "@/components/workspaces/SalesmenPanel";

export default function OperationsWorkspacePage() {
  const tabs = [
    {
      key: "inventory",
      label: "Stock",
      description: "Stock visibility, receipts, and warehouse inventory management.",
      roles: ["ADMIN", "WAREHOUSE_MANAGER"],
      render: () => <InventoryPanel />
    },
    {
      key: "ledger",
      label: "Stock ledger",
      description: "Every stock movement with running balances, a period summary, and an Excel download.",
      roles: ["ADMIN", "WAREHOUSE_MANAGER"],
      render: () => <StockLedgerPanel />
    },
    {
      key: "drivers",
      label: "Drivers",
      description: "Delivery driver status and assignment visibility.",
      roles: ["ADMIN", "WAREHOUSE_MANAGER"],
      render: () => <DriversPanel />
    },
    {
      key: "salesmen",
      label: "Salesmen",
      description: "Field sales coverage, performance snapshots, and roster management.",
      roles: ["ADMIN"],
      render: () => <SalesmenPanel />
    }
  ];

  return (
    <WorkspaceTabs
      title="Inventory"
      subtitle="Stock on hand, the stock movement ledger, and warehouse and field teams."
      tabs={tabs}
    />
  );
}
