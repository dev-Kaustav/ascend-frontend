"use client";

import RemovedRouteNotice from "@/components/layout/RemovedRouteNotice";

export default function RemovedInventoryAddPage() {
  return (
    <RemovedRouteNotice
      title="Inventory add moved into Operations"
      description="Inventory receiving now lives under the Inventory tab in Operations."
      href="/app/operations/inventory/add"
      ctaLabel="Open Add Inventory"
    />
  );
}
