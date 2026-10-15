"use client";

import { useMemo } from "react";
import Link from "next/link";
import QuickCreatePanel from "@/components/admin/QuickCreatePanel";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import useAdminLookups from "@/lib/hooks/useAdminLookups";

const columns = [
  { header: "Beat", accessorKey: "name", meta: { mobilePrimary: true } },
  { header: "Warehouse", accessorKey: "warehouse_name" },
  { header: "Retailers", accessorKey: "retailer_count", meta: { type: "number" } }
];

export default function RetailerBeatsPanel() {
  const { beats, retailers, warehouses, loading, error, refreshLookups } = useAdminLookups({ errorMessage: "Unable to load retailer beats." });
  const rows = useMemo(() => (beats || []).map((beat) => ({
    ...beat,
    warehouse_name: warehouses.find((warehouse) => warehouse.id === beat.warehouse_id)?.name || "Unassigned",
    retailer_count: retailers.filter((retailer) => retailer.beat_id === beat.id).length
  })), [beats, warehouses, retailers]);

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading retailer beats…</div>;
  if (error) return <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</p>;

  return <div className="space-y-6">
    <SectionCard title="Retailer beats" subtitle="Coverage groups and their assigned outlets." actions={<Link href="/app/retailers?tab=directory" className="inline-flex min-h-11 items-center rounded-full border border-slate-200 px-4 text-sm font-semibold">Assign retailers</Link>}>
      <DataTable columns={columns} data={rows} emptyLabel="No beats yet. Create your first beat below." />
    </SectionCard>
    <QuickCreatePanel title="Create a beat" subtitle="Add a coverage group for your retailer network." entities={["beat"]} defaultEntity="beat" warehouses={warehouses} onCreated={refreshLookups} />
  </div>;
}
