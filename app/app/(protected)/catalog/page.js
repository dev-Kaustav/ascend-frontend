"use client";

import RemovedRouteNotice from "@/components/layout/RemovedRouteNotice";

export default function RemovedCatalogPage() {
  return (
    <RemovedRouteNotice
      title="Catalog moved into Master Data"
      description="The SKU catalog now lives inside the Master Data workspace."
      href="/app/master-data?tab=catalog"
      ctaLabel="Open Master Data"
    />
  );
}
