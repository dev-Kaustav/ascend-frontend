"use client";

import RemovedRouteNotice from "@/components/layout/RemovedRouteNotice";

export default function RemovedInvoicesPage() {
  return (
    <RemovedRouteNotice
      title="Invoices moved into Finance"
      description="Invoices are no longer a standalone page. Open the Invoices tab in the Finance workspace."
      href="/app/finance?tab=invoices"
      ctaLabel="Open Finance"
    />
  );
}
