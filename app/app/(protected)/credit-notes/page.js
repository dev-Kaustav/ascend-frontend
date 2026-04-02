"use client";

import RemovedRouteNotice from "@/components/layout/RemovedRouteNotice";

export default function RemovedCreditNotesPage() {
  return (
    <RemovedRouteNotice
      title="Credit Notes moved into Finance"
      description="Credit Notes are now grouped under the Finance workspace."
      href="/app/finance?tab=credit-notes"
      ctaLabel="Open Finance"
    />
  );
}
