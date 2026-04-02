"use client";

import RemovedRouteNotice from "@/components/layout/RemovedRouteNotice";

export default function RemovedCashCollectionPage() {
  return (
    <RemovedRouteNotice
      title="Cash Collection moved into Finance"
      description="Cash collection now lives inside the Finance workspace."
      href="/app/finance?tab=cash-collection"
      ctaLabel="Open Finance"
    />
  );
}
