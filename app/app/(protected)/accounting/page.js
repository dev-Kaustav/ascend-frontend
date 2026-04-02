"use client";

import RemovedRouteNotice from "@/components/layout/RemovedRouteNotice";

export default function RemovedAccountingPage() {
  return (
    <RemovedRouteNotice
      title="Accounting moved into Finance"
      description="The accounting landing screen is now the Overview tab inside the Finance workspace."
      href="/app/finance?tab=overview"
      ctaLabel="Open Finance"
    />
  );
}
