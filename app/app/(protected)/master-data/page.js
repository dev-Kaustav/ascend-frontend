"use client";

import WorkspaceTabs from "@/components/layout/WorkspaceTabs";
import BrandsPanel from "@/components/workspaces/BrandsPanel";
import CatalogPanel from "@/components/workspaces/CatalogPanel";

export default function MasterDataWorkspacePage() {
  const tabs = [
    {
      key: "brands",
      label: "Brands",
      description: "Brand records and primary contacts maintained from one workspace.",
      roles: ["ADMIN"],
      render: () => <BrandsPanel />
    },
    {
      key: "catalog",
      label: "Catalog",
      description: "SKU catalog, pricing fields, and product dimensions managed together.",
      roles: ["ADMIN"],
      render: () => <CatalogPanel />
    }
  ];

  return (
    <WorkspaceTabs
      title="Master Data"
      subtitle="Core brand and product records grouped together for easier maintenance."
      tabs={tabs}
    />
  );
}
