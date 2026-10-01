"use client";

import { useCallback, useMemo } from "react";
import SectionCard from "@/components/layout/SectionCard";
import DataTable from "@/components/tables/DataTable";
import { AddRowButton, InlineNumber, InlineText, RowActions } from "@/components/tables/InlineRowCells";
import { apiEndpoints } from "@/lib/api";
import useInlineRowEditor from "@/lib/hooks/useInlineRowEditor";

const asText = (value) => (value === null || value === undefined ? "" : String(value));

const blankCategory = () => ({ name: "", sort_order: "0", icon_url: "" });

// The stored URL is only ever an img src, never HTML or an href (T-08-17). A plain img rather
// than next/image because these are hotlinked from arbitrary hosts (D-14).
function IconThumbnail({ url, name }) {
  if (!url) return "—";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name ? `${name} icon` : "Category icon"} loading="lazy" className="h-10 w-10 rounded-lg object-cover" />
  );
}

// Categories are add / rename / reorder / icon only (D-13): there is deliberately no delete,
// because removing one would silently uncategorise every SKU that uses it.
export default function CategoriesSection({ categories, onSaved }) {
  const editor = useInlineRowEditor({
    blank: blankCategory,
    toForm: useCallback(
      (category) => ({
        name: asText(category.name),
        sort_order: asText(category.sort_order),
        icon_url: asText(category.icon_url)
      }),
      []
    ),
    buildBody: useCallback(
      (values) => ({
        name: values.name.trim(),
        sort_order: Number(values.sort_order) || 0,
        // Empty box means "no icon" rather than "", so a cleared field really clears it.
        icon_url: values.icon_url.trim() || null
      }),
      []
    ),
    createUrl: apiEndpoints.admin.categories,
    updateUrl: apiEndpoints.admin.categoryUpdate,
    onSaved
  });

  const columns = useMemo(
    () => [
      {
        header: "Order",
        accessorKey: "sort_order",
        meta: { type: "number" },
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineNumber editor={editor} field="sort_order" label="Sort order" digits={6} placeholder="0" />
          ) : (
            row.original.sort_order
          )
      },
      {
        header: "Name",
        accessorKey: "name",
        meta: { mobilePrimary: true },
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineText editor={editor} field="name" label="Category name" placeholder="Category name" autoFocus />
          ) : (
            row.original.name || "—"
          )
      },
      {
        header: "Icon",
        accessorKey: "icon_url",
        cell: ({ row }) =>
          editor.isEditing(row) ? (
            <InlineText editor={editor} field="icon_url" label="Icon URL" placeholder="https://…" />
          ) : (
            <IconThumbnail url={row.original.icon_url} name={row.original.name} />
          )
      },
      {
        header: "",
        id: "actions",
        cell: ({ row }) => <RowActions editor={editor} row={row} onEdit={editor.startEdit} />
      }
    ],
    [editor]
  );

  return (
    <SectionCard
      title="Categories"
      subtitle={`${categories.length} ${categories.length === 1 ? "category" : "categories"}, listed by order`}
      actions={<AddRowButton label="+ Add category" onClick={editor.startCreate} disabled={editor.isActive} />}
    >
      {editor.error ? (
        <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {editor.error}
        </p>
      ) : null}
      <DataTable columns={columns} data={editor.withDraftRow(categories)} emptyLabel="No categories yet." />
    </SectionCard>
  );
}
