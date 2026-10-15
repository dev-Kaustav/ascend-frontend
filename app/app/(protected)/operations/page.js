"use client";

import WorkspaceTabs from "@/components/layout/WorkspaceTabs";
import InventoryPanel from "@/components/workspaces/InventoryPanel";
import DriversPanel from "@/components/workspaces/DriversPanel";
import SalesmenPanel from "@/components/workspaces/SalesmenPanel";

export default function OperationsWorkspacePage() {
  const tabs = [
    {
      key: "inventory",
      label: "Inventory",
      description: "Stock visibility, receipts, and warehouse inventory management.",
      roles: ["ADMIN", "WAREHOUSE_MANAGER"],
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
