"use client";

import QuickCreatePanel from "@/components/admin/QuickCreatePanel";
import useAdminLookups from "@/lib/hooks/useAdminLookups";

export default function AdminCreate() {
  const { warehouseManagers, warehouses, brands, loading, error, refreshLookups } = useAdminLookups({
    errorMessage: "Unable to load lookups."
  });

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <QuickCreatePanel
        title="Quick create"
        subtitle="Add entities without leaving this page."
        entities={["warehouse", "brand", "sku"]}
        warehouseManagers={warehouseManagers}
        warehouses={warehouses}
        brands={brands}
        headerError={error}
        onCreated={refreshLookups}
      />
    </div>
  );
}
