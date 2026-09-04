"use client";

import { useCallback, useMemo, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import { AddRowButton, InlineNumber, InlineText, RowActions } from "@/components/tables/InlineRowCells";
import { InputBar } from "@/components/ui/InputBars";
import { apiEndpoints } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import useAdminLookups from "@/lib/hooks/useAdminLookups";
import useInlineRowEditor from "@/lib/hooks/useInlineRowEditor";

const formatPhone = (value) => {
  if (!value && value !== 0) return "—";
  const raw = String(value).replace(/\D/g, "");
  if (raw.length === 10) {
    return `${raw.slice(0, 5)} ${raw.slice(5)}`;
  }
  return raw || "—";
};

const asText = (value) => (value === null || value === undefined ? "" : String(value));

export default function AdminBrands() {
  const { brands, skus, loading, error, refreshLookups } = useAdminLookups({
    errorMessage: "Unable to load brand panel."
  });
  const [search, setSearch] = useState("");

  const editor = useInlineRowEditor({
    blank: useCallback(() => ({ name: "", poc_name: "", poc_phone_number: "", poc_email: "" }), []),
    toForm: useCallback(
      (brand) => ({
        name: asText(brand.name),
        poc_name: asText(brand.poc_name),
        poc_phone_number: asText(brand.poc_phone_number),
        poc_email: asText(brand.poc_email)
      }),
      []
    ),
    buildBody: useCallback(
      (values) => ({
        name: values.name,
        poc_name: values.poc_name,
        poc_phone_number: Number(values.poc_phone_number),
        poc_email: values.poc_email || null
      }),
      []
    ),
    createUrl: apiEndpoints.admin.brands,
    updateUrl: apiEndpoints.admin.brandUpdate,
    onSaved: refreshLookups
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

  const filteredBrands = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return brandRows;
    return brandRows.filter((brand) =>
      [brand.name, brand.poc_name, brand.poc_email].filter(Boolean).join(" ").toLowerCase().includes(query)
    );
  }, [brandRows, search]);

  const columns = useMemo(
    () => [
      {
        header: "Brand",
        accessorKey: "name",
        meta: { mobilePrimary: true },
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineText editor={editor} field="name" label="Brand name" placeholder="Brand name" autoFocus />
          ) : (
            row.original.name || "—"
          )
      },
      {
        header: "POC Name",
        accessorKey: "poc_name",
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineText editor={editor} field="poc_name" label="POC name" placeholder="Contact name" />
          ) : (
            row.original.poc_name || "—"
          )
      },
      {
        header: "POC Email",
        accessorKey: "poc_email",
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineText editor={editor} field="poc_email" label="POC email" placeholder="name@example.com" />
          ) : (
            row.original.poc_email || "—"
          )
      },
      {
        header: "POC Phone",
        accessorKey: "poc_phone_number",
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineNumber
              editor={editor}
              field="poc_phone_number"
              label="POC phone"
              digits={10}
              placeholder="10 digits"
            />
          ) : (
            formatPhone(row.original.poc_phone_number)
          )
      },
      {
        header: "SKUs",
        accessorKey: "sku_count",
        meta: { type: "number" },
        cell: ({ row }) => (row.original.__draft ? "—" : formatNumber(row.original.sku_count))
      },
      {
        header: "",
        id: "actions",
        cell: ({ row }) => <RowActions editor={editor} row={row} onEdit={editor.startEdit} />
      }
    ],
    [editor]
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
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">{error}</div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Brands"
        subtitle={`${filteredBrands.length} of ${brandRows.length} brands`}
        actions={<AddRowButton label="+ Add brand" onClick={editor.startCreate} disabled={editor.isActive} />}
      >
        <div className="mb-3 md:max-w-sm">
          <InputBar
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search brand, POC name or email"
          />
        </div>
        {editor.error ? (
          <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {editor.error}
          </p>
        ) : null}
        <DataTable
          columns={columns}
          data={editor.withDraftRow(filteredBrands)}
          emptyLabel="No brands match."
          tableClassName="w-max min-w-[900px]"
        />
      </SectionCard>
    </div>
  );
}
