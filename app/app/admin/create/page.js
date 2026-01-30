"use client";

import QuickCreatePanel from "@/components/admin/QuickCreatePanel";
import useAdminLookups from "@/lib/hooks/useAdminLookups";

export default function AdminCreate() {
  const { salesmen, warehouseManagers, loading, error } = useAdminLookups({
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
        entities={["warehouse", "retailer", "sku"]}
        salesmen={salesmen}
        warehouseManagers={warehouseManagers}
        headerError={error}
      />
    </div>
  );
}
