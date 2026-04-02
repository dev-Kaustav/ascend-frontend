"use client";

import RemovedRouteNotice from "@/components/layout/RemovedRouteNotice";

export default function RemovedCreatePage() {
  return (
    <RemovedRouteNotice
      title="Quick Create moved into Admin"
      description="The standalone create page has been retired. Use the Quick Create tab inside Admin."
      href="/app/admin?tab=quick-create"
      ctaLabel="Open Admin"
    />
  );
}
