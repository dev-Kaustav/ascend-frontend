"use client";

import { useCallback, useMemo, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import {
  AddRowButton,
  InlineNumber,
  InlineSelect,
  InlineText,
  RowActions
} from "@/components/tables/InlineRowCells";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import { apiEndpoints } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import useAdminLookups from "@/lib/hooks/useAdminLookups";
import useInlineRowEditor from "@/lib/hooks/useInlineRowEditor";
import { applySkuFieldChange, emptySku, toNumber } from "@/lib/skuPricing";

const asText = (value) => (value === null || value === undefined ? "" : String(value));

export default function AdminCatalog() {
  const { skus, brands, loading, error, refreshLookups } = useAdminLookups({
    errorMessage: "Unable to load SKU catalog."
  });
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const editor = useInlineRowEditor({
    blank: emptySku,
    toForm: useCallback((sku) => {
      const form = emptySku();
      Object.keys(form).forEach((key) => {
        if (key === "__lastEdited") return;
        form[key] = asText(sku[key]);
      });
      return form;
    }, []),
    buildBody: useCallback(
      (values) => ({
        name: values.name,
        // Optional, and an empty box means "no code" rather than "".
        code: values.code.trim() || null,
        brand_id: Number(values.brand_id),
        hsn_code: values.hsn_code,
        distributor_landing_price: toNumber(values.distributor_landing_price),
        mrp: toNumber(values.mrp),
        discount_amount: toNumber(values.discount_amount),
        discount_percent: toNumber(values.discount_percent),
        rate: toNumber(values.rate),
        sgst_percent: toNumber(values.sgst_percent),
        sgst_amount: toNumber(values.sgst_amount),
        cgst_percent: toNumber(values.cgst_percent),
        cgst_amount: toNumber(values.cgst_amount),
        igst_percent: toNumber(values.igst_percent),
        igst_amount: toNumber(values.igst_amount),
        amount: toNumber(values.amount),
        weight: toNumber(values.weight),
        length_cm: toNumber(values.length_cm),
        width_cm: toNumber(values.width_cm),
        height_cm: toNumber(values.height_cm)
      }),
      []
    ),
    // The same derivation the Quick Create form runs, so editing MRP inline recomputes
    // discount, rate and the GST pairs identically.
    applyFieldChange: applySkuFieldChange,
    createUrl: apiEndpoints.admin.skus,
    updateUrl: apiEndpoints.admin.skuUpdate,
    onSaved: refreshLookups
  });

  const brandOptions = useMemo(
    () => (brands || []).map((brand) => ({ value: String(brand.id), label: brand.name })),
    [brands]
  );
  const brandMap = useMemo(() => new Map(brandOptions.map((option) => [option.value, option.label])), [brandOptions]);

  const skuRows = useMemo(() => {
    return (skus || []).map((sku) => {
      const dimensions = [sku.length_cm, sku.width_cm, sku.height_cm]
        .map((value) => (value ? formatNumber(value) : null))
        .filter(Boolean)
        .join(" × ");
      return {
        ...sku,
        brand_name: brandMap.get(String(sku.brand_id)) || "—",
        dimensions: dimensions || "—"
      };
    });
  }, [skus, brandMap]);

  const filteredSkus = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return skuRows.filter((sku) => {
      if (brandFilter && String(sku.brand_id) !== brandFilter) return false;
      if (!tokens.length) return true;
      const haystack = [sku.name, sku.code, sku.hsn_code].filter(Boolean).join(" ").toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [skuRows, search, brandFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredSkus.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => filteredSkus.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredSkus, safePage, pageSize]
  );

  // Most catalog columns are a plain number in and a formatted number out, so they share one
  // definition. Derived fields (rate, amount, the GST amounts) stay editable because the
  // pricing rules recompute whichever half of a pair the user is not typing into.
  const numericColumn = useCallback(
    (header, field, format, extra = {}) => ({
      header,
      accessorKey: field,
      meta: { type: "number", ...(extra.meta || {}) },
      cell: ({ row }) =>
        editor.isEditing(row) ? (
          <InlineNumber editor={editor} field={field} label={header} placeholder="0" />
        ) : (
          format(row.original[field])
        )
    }),
    [editor]
  );

  const skuColumns = useMemo(
    () => [
      {
        header: "SKU",
        accessorKey: "name",
        meta: { mobilePrimary: true },
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineText editor={editor} field="name" label="SKU name" placeholder="SKU name" autoFocus />
          ) : (
            row.original.name || "—"
          )
      },
      {
        header: "SKU Code",
        accessorKey: "code",
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineText editor={editor} field="code" label="SKU code" placeholder="Optional" />
          ) : (
            row.original.code || "—"
          )
      },
      {
        header: "Brand",
        accessorKey: "brand_name",
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineSelect editor={editor} field="brand_id" label="Brand" options={brandOptions} placeholder="Select brand" />
          ) : (
            row.original.brand_name
          )
      },
      {
        header: "HSN Code",
        accessorKey: "hsn_code",
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineText editor={editor} field="hsn_code" label="HSN code" placeholder="HSN" />
          ) : (
            row.original.hsn_code || "—"
          )
      },
      numericColumn("MRP", "mrp", formatCurrency),
      numericColumn("Distributor Landing", "distributor_landing_price", formatCurrency),
      numericColumn("Discount %", "discount_percent", formatPercent),
      numericColumn("Rate", "rate", formatCurrency),
      numericColumn("SGST %", "sgst_percent", formatPercent),
      numericColumn("CGST %", "cgst_percent", formatPercent),
      numericColumn("IGST %", "igst_percent", formatPercent),
      numericColumn("Amount", "amount", formatCurrency),
      numericColumn("Weight", "weight", formatNumber),
      {
        header: "Dimensions (cm)",
        accessorKey: "dimensions",
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <div className="flex gap-1">
              <InlineNumber editor={editor} field="length_cm" label="Length cm" placeholder="L" />
              <InlineNumber editor={editor} field="width_cm" label="Width cm" placeholder="W" />
              <InlineNumber editor={editor} field="height_cm" label="Height cm" placeholder="H" />
            </div>
          ) : (
            row.original.dimensions
          )
      },
      {
        header: "",
        id: "actions",
        cell: ({ row }) => <RowActions editor={editor} row={row} onEdit={editor.startEdit} />
      }
    ],
    [editor, brandOptions, numericColumn]
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading catalog…
      </div>
    );
  }

  if (error) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="SKU Catalog"
        subtitle={`${filteredSkus.length} of ${skuRows.length} SKUs`}
        actions={
          <>
            <AddRowButton label="+ Add SKU" onClick={editor.startCreate} disabled={editor.isActive} />
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              aria-label="Rows per page"
              className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </>
        }
      >
        <div className="mb-3 grid gap-2 md:grid-cols-2">
          <InputBar
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search SKU name, code or HSN"
          />
          <SelectBar
            value={brandFilter}
            aria-label="Filter by brand"
            onChange={(event) => {
              setBrandFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All brands</option>
            {brandOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectBar>
        </div>
        {editor.error ? (
          <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {editor.error}
          </p>
        ) : null}
        <DataTable
          columns={skuColumns}
          data={editor.withDraftRow(pageRows)}
          emptyLabel="No SKUs match."
          tableClassName="w-max min-w-[1600px]"
        />
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>
            Page {safePage} of {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage === 1}
              className="cursor-pointer rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
              disabled={safePage >= pageCount}
              className="cursor-pointer rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
