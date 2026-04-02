"use client";

import RemovedRouteNotice from "@/components/layout/RemovedRouteNotice";

export default function RemovedSalesmenPage() {
  return (
    <RemovedRouteNotice
      title="Salesmen moved into Operations"
      description="Sales team visibility is now grouped under the Operations workspace."
      href="/app/operations?tab=salesmen"
      ctaLabel="Open Operations"
    />
  );
}
