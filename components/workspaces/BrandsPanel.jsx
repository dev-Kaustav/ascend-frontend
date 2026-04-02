"use client";

import { useMemo } from "react";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import { formatNumber } from "@/lib/format";
import useAdminLookups from "@/lib/hooks/useAdminLookups";

const formatPhone = (value) => {
  if (!value && value !== 0) return "—";
  const raw = String(value).replace(/\D/g, "");
  if (raw.length === 10) {
    return `${raw.slice(0, 5)} ${raw.slice(5)}`;
  }
  return raw || "—";
};

export default function AdminBrands() {
  const { brands, skus, loading, error } = useAdminLookups({
    errorMessage: "Unable to load brand panel."
  });

  const skuCountByBrand = useMemo(() => {
    const counts = new Map();
    (skus || []).forEach((sku) => {
      if (!sku?.brand_id) return;
      counts.set(sku.brand_id, (counts.get(sku.brand_id) || 0) + 1);
    });
    return counts;
  }, [skus]);

  const brandRows = useMemo(() => {
    return (brands || []).map((brand) => ({
      ...brand,
      sku_count: skuCountByBrand.get(brand.id) || 0
    }));
  }, [brands, skuCountByBrand]);

  const columns = useMemo(
    () => [
      {
        header: "Brand",
        accessorKey: "name",
        cell: ({ row }) => row.original.name || "—"
      },
      {
        header: "POC Name",
        accessorKey: "poc_name",
        cell: ({ row }) => row.original.poc_name || "—"
      },
      {
        header: "POC Email",
        accessorKey: "poc_email",
        cell: ({ row }) => row.original.poc_email || "—"
      },
      {
        header: "POC Phone",
        accessorKey: "poc_phone_number",
        cell: ({ row }) => formatPhone(row.original.poc_phone_number)
      },
      {
        header: "SKUs",
        accessorKey: "sku_count",
        meta: { type: "number" },
        cell: ({ row }) => formatNumber(row.original.sku_count)
      }
    ],
    []
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading brands…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Brands" subtitle={`${brandRows.length} brands`}>
        <DataTable
          columns={columns}
          data={brandRows}
          emptyLabel="No brands found."
          tableClassName="w-max min-w-[900px]"
        />
      </SectionCard>
    </div>
  );
}
