"use client";

import { useMemo } from "react";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import useAdminLookups from "@/lib/hooks/useAdminLookups";

export default function AdminCatalog() {
  const { skus, brands, loading, error } = useAdminLookups({
    errorMessage: "Unable to load SKU catalog."
  });

  const brandMap = useMemo(() => {
    const map = new Map();
    (brands || []).forEach((brand) => {
      map.set(brand.id, brand.name);
    });
    return map;
  }, [brands]);

  const skuRows = useMemo(() => {
    return (skus || []).map((sku) => {
      const dimensions = [sku.length_cm, sku.width_cm, sku.height_cm]
        .map((value) => (value ? formatNumber(value) : null))
        .filter(Boolean)
        .join(" × ");
      return {
        ...sku,
        brand_name: brandMap.get(sku.brand_id) || "—",
        dimensions: dimensions || "—"
      };
    });
  }, [skus, brandMap]);

  const skuColumns = useMemo(
    () => [
      {
        header: "SKU",
        accessorKey: "name",
        cell: ({ row }) => row.original.name || "—"
      },
      {
        header: "SKU Code",
        accessorKey: "code",
        cell: ({ row }) => row.original.code || "—"
      },
      {
        header: "Brand",
        accessorKey: "brand_name",
        cell: ({ row }) => row.original.brand_name
      },
      {
        header: "HSN Code",
        accessorKey: "hsn_code",
        cell: ({ row }) => row.original.hsn_code || "—"
      },
      {
        header: "MRP",
        accessorKey: "mrp",
        cell: ({ row }) => formatCurrency(row.original.mrp)
      },
      {
        header: "Distributor Landing",
        accessorKey: "distributor_landing_price",
        cell: ({ row }) => formatCurrency(row.original.distributor_landing_price)
      },
      {
        header: "Discount %",
        accessorKey: "discount_percent",
        cell: ({ row }) => formatPercent(row.original.discount_percent)
      },
      {
        header: "Rate",
        accessorKey: "rate",
        cell: ({ row }) => formatCurrency(row.original.rate)
      },
      {
        header: "SGST %",
        accessorKey: "sgst_percent",
        cell: ({ row }) => formatPercent(row.original.sgst_percent)
      },
      {
        header: "CGST %",
        accessorKey: "cgst_percent",
        cell: ({ row }) => formatPercent(row.original.cgst_percent)
      },
      {
        header: "IGST %",
        accessorKey: "igst_percent",
        cell: ({ row }) => formatPercent(row.original.igst_percent)
      },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => formatCurrency(row.original.amount)
      },
      {
        header: "Weight",
        accessorKey: "weight",
        cell: ({ row }) => formatNumber(row.original.weight)
      },
      {
        header: "Dimensions (cm)",
        accessorKey: "dimensions",
        cell: ({ row }) => row.original.dimensions
      }
    ],
    []
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading catalog…
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
      <SectionCard title="SKU Catalog" subtitle={`${skuRows.length} SKUs`}>
        <DataTable
          columns={skuColumns}
          data={skuRows}
          emptyLabel="No SKUs found."
          tableClassName="w-max min-w-[1400px]"
        />
      </SectionCard>
    </div>
  );
}
