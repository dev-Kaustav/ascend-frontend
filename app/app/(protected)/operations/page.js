"use client";

import WorkspaceTabs from "@/components/layout/WorkspaceTabs";
import InventoryPanel from "@/components/workspaces/InventoryPanel";
import DriversPanel from "@/components/workspaces/DriversPanel";
import SalesmenPanel from "@/components/workspaces/SalesmenPanel";
import RetailCoveragePanel from "@/components/workspaces/RetailCoveragePanel";

export default function OperationsWorkspacePage() {
  const tabs = [
    {
      key: "inventory",
      label: "Inventory",
      description: "Stock visibility, receipts, and warehouse inventory management.",
      roles: ["ADMIN", "WAREHOUSE_MANAGER"],
      permissions: ["inventory.view"],
      render: () => <InventoryPanel />
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
    },
    {
      key: "coverage",
      label: "Coverage",
      description: "Retail activity and outlet coverage trends across the network.",
      roles: ["ADMIN"],
      render: () => <RetailCoveragePanel />
    }
  ];

  return (
    <WorkspaceTabs
      title="Operations"
      subtitle="Warehouse and field operations grouped into one workspace."
      tabs={tabs}
    />
  );
}
