"use client";

import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

const ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right"
};

function inferValueForColumn(columnDef, data) {
  const key = columnDef.accessorKey;
  if (!key || typeof key !== "string") return undefined;
  if (!Array.isArray(data)) return undefined;
  for (const row of data) {
    if (!row) continue;
    const value = row[key];
    if (value !== null && value !== undefined) return value;
  }
  return undefined;
}

function resolveAlign(columnDef, value) {
  const meta = columnDef?.meta || {};
  if (meta.align) return meta.align;
  if (meta.type === "number") return "right";
  if (meta.type === "string") return "center";
  if (meta.type === "boolean") return "center";
  if (typeof value === "number") return "right";
  if (typeof value === "string") return "center";
  if (typeof value === "boolean") return "center";
  return "left";
}

export default function DataTable({
  columns,
  data,
  emptyLabel = "No records",
  onRowClick,
  tableClassName = "",
  containerClassName = ""
}) {
  const table = useReactTable({
    data: data || [],
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  const headerAlignMap = new Map();
  columns.forEach((columnDef) => {
    const inferred = inferValueForColumn(columnDef, data);
    headerAlignMap.set(columnDef, resolveAlign(columnDef, inferred));
  });

  return (
    <div className={`overflow-x-auto max-w-full ${containerClassName}`}>
      <table className={`w-full min-w-[720px] border-separate border-spacing-y-2 text-sm ${tableClassName}`}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const align = headerAlignMap.get(header.column.columnDef) || "left";
                return (
                  <th
                    key={header.id}
                    className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400 whitespace-normal break-words ${ALIGN_CLASS[align]}`}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-slate-400">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={`rounded-2xl border border-slate-200 bg-white/90 ${
                  onRowClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg" : ""
                }`}
              >
                {row.getVisibleCells().map((cell) => {
                  const align = resolveAlign(cell.column.columnDef, cell.getValue());
                  return (
                    <td key={cell.id} className={`px-4 py-3 text-slate-600 ${ALIGN_CLASS[align]}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
