"use client";

import RemovedRouteNotice from "@/components/layout/RemovedRouteNotice";

export default function RemovedDriversPage() {
  return (
    <RemovedRouteNotice
      title="Drivers moved into Operations"
      description="Driver management now lives inside the Operations workspace."
      href="/app/operations?tab=drivers"
      ctaLabel="Open Operations"
    />
  );
}
