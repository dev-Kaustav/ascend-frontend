"use client";

import RemovedRouteNotice from "@/components/layout/RemovedRouteNotice";

export default function RemovedRetailCoveragePage() {
  return (
    <RemovedRouteNotice
      title="Retail Coverage moved into Operations"
      description="Coverage reporting is now available from the Coverage tab inside Operations."
      href="/app/operations?tab=coverage"
      ctaLabel="Open Operations"
    />
  );
}
