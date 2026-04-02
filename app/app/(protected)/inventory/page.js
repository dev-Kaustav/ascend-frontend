"use client";

import RemovedRouteNotice from "@/components/layout/RemovedRouteNotice";

export default function RemovedInventoryPage() {
  return (
    <RemovedRouteNotice
      title="Inventory moved into Operations"
      description="Inventory is no longer a standalone sidebar destination. Use the Operations workspace and open the Inventory tab."
      href="/app/operations?tab=inventory"
      ctaLabel="Open Operations"
    />
  );
}
