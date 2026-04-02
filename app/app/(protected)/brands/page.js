"use client";

import RemovedRouteNotice from "@/components/layout/RemovedRouteNotice";

export default function RemovedBrandsPage() {
  return (
    <RemovedRouteNotice
      title="Brands moved into Master Data"
      description="Brand maintenance is now grouped into the Master Data workspace."
      href="/app/master-data?tab=brands"
      ctaLabel="Open Master Data"
    />
  );
}
